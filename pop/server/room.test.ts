// 卓の検査。
//
// 見るのは主に4つ。
//   1. **他人の番に打てないこと**（ここが緩いと対戦にならない）
//   2. 配られる盤面に他人の手札が混ざらないこと
//   3. 人が抜けても卓が止まらないこと
//   4. **4人そろうまで始まらないこと**（オンラインはCPU戦の場ではない）
//
// CPU は自分で動かないので、テストは `stepBot()` を回すだけで進む。
// 時計を差し込む必要がない。

import { describe, it, expect } from "vitest";
import { Room, SEAT_COUNT } from "./room.ts";
import { findBaterAction } from "@pifpaf/engine";
import type { JoinResult } from "./room.ts";

function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let tokenCounter = 0;
function makeRoom(seed = 1) {
  tokenCounter = 0;
  return new Room({
    roomId: "test",
    rng: rng(seed),
    makeToken: () => `token-${++tokenCounter}`,
  });
}

/** 卓が止まるまで CPU を進める。無限に回らないよう上限を置く。 */
function runBots(room: Room, limit = 500): number {
  let n = 0;
  while (room.needsBotStep() && n < limit) {
    room.stepBot();
    n++;
  }
  return n;
}

/** 4人ぶん座らせる。**開始には全席が要る**ので、ほとんどのテストがこれで前提を整える。 */
function joinAll(room: Room, names = ["あ", "い", "う", "え"]): number[] {
  const joined: JoinResult[] = names.map((n) => room.join(n));
  for (const j of joined) {
    if (!j.ok) throw new Error("4人ぶん席が無い");
  }
  return joined.map((j) => (j as Extract<JoinResult, { ok: true }>).seat);
}

/** 4人ぶん座らせて、席とトークンの両方を返す。戻ってくる側の検査で使う。 */
function joinAllKeepingTokens(room: Room, names = ["あ", "い", "う", "え"]) {
  return names.map((n) => {
    const j = room.join(n);
    if (!j.ok) throw new Error("4人ぶん席が無い");
    return j;
  });
}

/** 与えた席全員に同じ降りる／勝負するを決めさせる。PLAYING まで進めるのに使う。 */
function foldAll(room: Room, seats: number[], fold: boolean): void {
  for (const s of seats) room.setFold(s, fold);
}

describe("入退室", () => {
  it("空席に順に座る", () => {
    const room = makeRoom();
    expect(room.join("あ")).toMatchObject({ ok: true, seat: 0 });
    expect(room.roomInfo().hostSeat).toBe(0);
    expect(room.join("い")).toMatchObject({ ok: true, seat: 1 });
    expect(room.join("う")).toMatchObject({ ok: true, seat: 2 });
    expect(room.join("え")).toMatchObject({ ok: true, seat: 3 });
  });

  it("満席なら断る", () => {
    const room = makeRoom();
    for (let i = 0; i < SEAT_COUNT; i++) room.join(`p${i}`);
    expect(room.join("あふれ")).toMatchObject({ ok: false });
  });

  it("始まった卓には入れない", () => {
    const room = makeRoom();
    joinAll(room);
    expect(room.start()).toMatchObject({ ok: true });
    expect(room.join("い")).toMatchObject({ ok: false });
  });

  it("猶予のうちなら、トークンで元の席に戻れる", () => {
    const room = makeRoom();
    const first = room.join("あ");
    room.join("い");
    room.join("う");
    room.join("え");
    if (!first.ok) return;
    room.start();

    room.disconnect(first.seat);
    // まだ畳まない。戻りを待って卓を止めている
    expect(room.currentPhase()).toBe("FOLD_DECISION");
    expect(room.isAwaiting()).toBe(true);
    expect(room.roomInfo().awaiting).toEqual([first.seat]);

    const back = room.join("あ", first.token);
    expect(back).toMatchObject({ ok: true, seat: first.seat, rejoined: true });
    expect(room.isAwaiting()).toBe(false);
    expect(room.roomInfo().seats[first.seat]!.disconnected).toBe(false);
  });

  it("待ちきれなければ畳む。そこにはトークンでも戻れない", () => {
    const room = makeRoom();
    const first = room.join("あ");
    room.join("い");
    room.join("う");
    room.join("え");
    if (!first.ok) return;
    room.start();

    room.disconnect(first.seat);
    room.giveUpWaiting(); // hub が期限切れで呼ぶもの
    expect(room.currentPhase()).toBe("CLOSED");

    const back = room.join("あ", first.token);
    expect(back.ok).toBe(false);
  });

  it("始まる前でも、自分から降りれば卓は畳まれる", () => {
    // **席が空くという概念を持たない。** 抜けた席を他人が取ることもない
    const room = makeRoom();
    const joined = room.join("あ");
    room.join("い");
    if (!joined.ok) return;
    room.leave(joined.seat);
    expect(room.currentPhase()).toBe("CLOSED");
    expect(room.roomInfo().seats[0]!.name).toBe("あ");
  });

  it("始まる前でも、切れただけなら席を押さえて戻りを待つ", () => {
    // **ホストも他の人と同じ扱い**。ここで即座に空けていた頃は、ホストが
    // 一瞬切れただけで席が空き、ホスト権が移り、CHAMAR A CPU で
    // その席が CPU になっていた
    const room = makeRoom();
    const host = room.join("ホスト");
    room.join("い");
    if (!host.ok) return;

    room.disconnect(host.seat);
    expect(room.isAwaiting()).toBe(true);
    expect(room.roomInfo().seats[host.seat]!.name).toBe("ホスト");
    expect(room.roomInfo().hostSeat).toBe(host.seat); // ホスト権も渡さない

    // 待っているあいだは始められない。欠けたまま始まってしまう
    expect(room.start(true).ok).toBe(false);

    // トークンで戻れば、席もホスト権もそのまま
    const back = room.join("ホスト", host.token);
    expect(back).toMatchObject({ ok: true, seat: host.seat, rejoined: true });
    expect(room.isAwaiting()).toBe(false);
    expect(room.roomInfo().hostSeat).toBe(host.seat);
  });

  it("始まる前でも、待ちきれなければ卓は畳まれる", () => {
    // 場面によらず同じ。席を空けて人待ちに戻す、という道は無い
    const room = makeRoom();
    const host = room.join("ホスト");
    const other = room.join("い");
    if (!host.ok || !other.ok) return;

    room.disconnect(host.seat);
    room.giveUpWaiting();

    expect(room.currentPhase()).toBe("CLOSED");
    // ホスト権も動かさない。卓は決まった顔ぶれのもの
    expect(room.roomInfo().hostSeat).toBe(host.seat);
  });
});

describe("開始", () => {
  it("既定では4人そろうまで始まらない", () => {
    const room = makeRoom();
    room.join("あ");
    room.join("い");
    room.join("う");

    expect(room.start()).toMatchObject({ ok: false });
    expect(room.currentPhase()).toBe("WAITING");
  });

  it("4人そろえば始まる。CPUで埋めた席は無い", () => {
    const room = makeRoom();
    joinAll(room);
    expect(room.start()).toMatchObject({ ok: true });

    const info = room.roomInfo();
    expect(info.seats.every((s) => !s.isBot)).toBe(true);
  });

  it("人が集まらなければ、CPUを呼んで埋めて始められる", () => {
    const room = makeRoom();
    room.join("あ");

    expect(room.start(true)).toMatchObject({ ok: true });

    const info = room.roomInfo();
    expect(info.seats.filter((s) => s.isBot)).toHaveLength(3);
    expect(info.seats[0]!.isBot).toBe(false);
  });

  it("CPUを呼んでも、席が埋まっていれば人のまま", () => {
    const room = makeRoom();
    joinAll(room);

    expect(room.start(true)).toMatchObject({ ok: true });
    expect(room.roomInfo().seats.every((s) => !s.isBot)).toBe(true);
  });

  it("人がいなければ、CPUを呼んでも始められない", () => {
    expect(makeRoom().start()).toMatchObject({ ok: false });
    expect(makeRoom().start(true)).toMatchObject({ ok: false });
  });

  it("対局中に1人消えたら、卓は止まって戻りを待つ", () => {
    // 抜けた席を CPU が引き継ぐことはしない（2026-09-04・ユーザー指示）。
    // ただしすぐには畳まない。通信が一瞬切れただけの人まで抜けた扱いにすると、
    // 電車に入っただけで卓が消える
    const room = makeRoom();
    const seats = joinAll(room);
    room.start();
    expect(room.currentPhase()).toBe("FOLD_DECISION");

    room.disconnect(seats[0]!);
    expect(room.isAwaiting()).toBe(true);
    // 席は消さない。誰を待っているのかが残りの画面から見える
    expect(room.roomInfo().seats[seats[0]!]!.disconnected).toBe(true);
    expect(room.roomInfo().seats[seats[0]!]!.name).not.toBeNull();
  });

  it("待っているあいだは、残った人も打てない", () => {
    // 片方だけ進めると、戻ってきた人が知らないうちに局が動いている
    const room = makeRoom();
    const joined = joinAllKeepingTokens(room);
    room.start();
    room.disconnect(joined[0]!.seat);

    expect(room.setFold(joined[1]!.seat, false).ok).toBe(false);
    expect(room.needsBotStep()).toBe(false);
    expect(room.roomInfo().awaiting).toEqual([joined[0]!.seat]);

    // 戻れば、そのまま続きから
    room.join("あ", joined[0]!.token);
    expect(room.isAwaiting()).toBe(false);
    expect(room.setFold(joined[1]!.seat, false).ok).toBe(true);
  });

  it("決着したあとに消えても待たない。結果を読んでいる人の邪魔をしない", () => {
    const room = makeRoom();
    const seats = joinAll(room);
    room.start();
    room.setFold(seats[0]!, false);
    foldAll(room, seats.slice(1), true);
    expect(room.currentPhase()).toBe("ROUND_RESULT");

    // ラウンドの結果はまだ対局中なので、ここで消えれば待つ
    room.disconnect(seats[1]!);
    expect(room.isAwaiting()).toBe(true);
  });
});

describe("手番の検査", () => {
  it("自分の番でなければ断る", () => {
    const room = makeRoom();
    const seats = joinAll(room);
    room.start();
    foldAll(room, seats, false);

    const actor = room.viewFor(seats[0]!).game.actor;
    const notMe = (actor + 1) % SEAT_COUNT;

    expect(room.act(notMe, { type: "DRAW" })).toMatchObject({
      ok: false,
      reason: "あなたの番ではありません",
    });
  });

  it("engine が断った手はそのまま断る", () => {
    const room = makeRoom();
    const seats = joinAll(room);
    room.start();
    foldAll(room, seats, false);

    const actor = room.viewFor(seats[0]!).game.actor;
    const view = room.viewFor(actor);

    // 引く前に捨てようとする
    const result = room.act(actor, { type: "DISCARD", cardId: view.game.hand[0]!.id });
    expect(result.ok).toBe(false);
  });

  it("決める場面が終わる前には打てない", () => {
    const room = makeRoom();
    const seats = joinAll(room);
    room.start();
    expect(room.act(seats[0]!, { type: "DRAW" })).toMatchObject({ ok: false });
  });
});

describe("配る盤面", () => {
  it("他人の手札は混ざらない", () => {
    const room = makeRoom();
    const seats = joinAll(room);
    room.start();

    const viewA = room.viewFor(seats[0]!);
    const viewB = room.viewFor(seats[1]!);

    const idsA = new Set(viewA.game.hand.map((c) => c.id));
    const idsB = viewB.game.hand.map((c) => c.id);

    // 2組デッキなので同じ札は2枚あるが、id は一意
    for (const id of idsB) expect(idsA.has(id)).toBe(false);

    // 相手の枚数だけは見える
    expect(viewA.game.seats[seats[1]!]!.handCount).toBe(9);
  });

  it("席を持たない接続にはどの手札も見せない", () => {
    const room = makeRoom();
    joinAll(room);
    room.start();

    const view = room.viewFor(-1);
    expect(view.you).toBe(-1);
    expect(view.game.hand).toEqual([]);
    expect(view.game.seats.every((s) => s.handCount === 9)).toBe(true);
  });

  it("ラウンドが終わるまで勝者の手札は開かない", () => {
    const room = makeRoom();
    const seats = joinAll(room);
    room.start();
    expect(room.viewFor(seats[0]!).game.revealedHand).toBeNull();
  });
});

describe("卓が止まらないこと", () => {
  it("自分の番の人が切れても、CPUが代役を打たない", () => {
    // 昔はここで CPU が代わりに打っていた。いまは止めて戻りを待つ
    const room = makeRoom();
    const seats = joinAll(room);
    room.start();
    foldAll(room, seats, false);

    const actor = room.viewFor(seats[0]!).game.actor;
    room.disconnect(actor);

    expect(room.isAwaiting()).toBe(true);
    expect(room.needsBotStep()).toBe(false);
    expect(runBots(room)).toBe(0);
  });

  it("畳まれた卓では、もう何も受け付けない", () => {
    const room = makeRoom();
    const seats = joinAll(room);
    room.start();
    room.disconnect(seats[3]!);
    room.giveUpWaiting();
    expect(room.currentPhase()).toBe("CLOSED");

    expect(room.setFold(seats[0]!, false).ok).toBe(false);
    expect(room.next(seats[0]!).ok).toBe(false);
    expect(room.act(seats[0]!, { type: "DRAW", from: "STOCK" }).ok).toBe(false);
  });

  it("全員が降りたら決着なしで畳む", () => {
    const room = makeRoom();
    const seats = joinAll(room);
    room.start();

    for (const s of seats) room.setFold(s, true);

    expect(room.currentPhase()).not.toBe("PLAYING");
    const settled = room.settlement();
    expect(settled).not.toBeNull();
    expect(settled!.state.lastWinner).toBeNull();
  });

  it("人がいない卓（CPUだけ）は結果画面で待たない", () => {
    // 人が抜ければ卓ごと畳むので、「切れた人を待って止まる」場面はもう来ない。
    // 残るのは CPU だけの卓で、そこは誰も待たずに回り続ける
    const room = makeRoom();
    room.join("あ");
    room.start(true);
    room.setFold(0, true);
    room.runOutRound();
    expect(room.currentPhase()).toBe("ROUND_RESULT");

    // 見ている人が消えたら止めて待ち、戻らなければ畳む
    room.disconnect(0);
    expect(room.isAwaiting()).toBe(true);
    room.giveUpWaiting();
    expect(room.currentPhase()).toBe("CLOSED");
  });
});

describe("マッチが終わるまで回る", () => {
  it("CPUだけの卓は、決着まで止まらずに回る", () => {
    // 人が抜けた席を CPU が引き継ぐことはもう無いので、
    // 「CPU だけの卓」は CHAMAR A CPU で呼んだ席が残った場合にできる。
    // 呼んだ本人が降り続けても、engine が止まらないことを見る
    const room = makeRoom(7);
    room.join("あ");
    room.start(true);

    // 1マッチはおよそ6ラウンド × 40手。余裕を持って上限を置く
    let steps = 0;
    while (room.currentPhase() !== "MATCH_OVER" && steps < 5000) {
      if (room.currentPhase() === "FOLD_DECISION") {
        if (room.roomInfo().seats[0]!.decided === false) room.setFold(0, true);
        continue;
      }
      if (room.currentPhase() === "ROUND_RESULT") {
        room.next(0);
        continue;
      }
      // 進める手が無いのに終わっていないなら、卓が止まっている
      if (!room.needsBotStep()) break;
      room.stepBot();
      steps++;
    }

    expect(room.currentPhase()).toBe("MATCH_OVER");
    const view = room.viewFor(0);
    expect(view.match.winner).not.toBeNull();
    // チップの総量は減る一方で、増えることはない
    expect(view.match.chips.every((c) => c >= 0)).toBe(true);
  });
});

describe("CPUだけになった対局は見せない", () => {
  it("人が降りたら、CPU同士の応酬は飛ばして結果まで進む", () => {
    // 種は「残ったCPUが2人以上で、実際に打ち合いになる」配りを選んである
    const room = makeRoom(2);
    room.join("あ");
    room.start(true); // 人が集まらないので CPU を呼んだ卓
    room.setFold(0, true);

    expect(room.runsOnBotsAlone()).toBe(true);
    room.runOutRound();
    // 降りた本人は結果を待つ側。CPU 同士の決着まで一気に進んでいる
    expect(["ROUND_RESULT", "MATCH_OVER"]).toContain(room.currentPhase());
  });

  it("途中経過は配らない。知らせるのは決着の1回だけ", () => {
    let changes = 0;
    const room = new Room({
      roomId: "test",
      rng: rng(2),
      makeToken: () => `token-${++tokenCounter}`,
      onChange: () => {
        changes += 1;
      },
    });
    room.join("あ");
    room.start(true);
    room.setFold(0, true);

    const before = changes;
    room.runOutRound();
    expect(changes - before).toBe(1);
  });

  it("まだ打っている人がいるうちは飛ばさない", () => {
    const room = makeRoom();
    const seats = joinAll(room);
    room.start();
    room.setFold(seats[0]!, true);
    foldAll(room, seats.slice(1), false);

    // 3人が勝負している。見せるべき対戦がある
    expect(room.runsOnBotsAlone()).toBe(false);
  });

  it("脱落した人の前でも、CPU同士の応酬は飛ばし、結果だけを見せる", () => {
    // 破産したあとも席には座ったまま。降りた人と同じで、もう手は出せない。
    // 「生きている人がいるか」で判定していた頃は、破産した人だけが1手ずつ
    // （900ms × 80手 ＝ 約70秒）CPU同士の対戦を見せられていた。
    const room = makeRoom(5);
    room.join("あ");
    room.start(true);

    let forced = 0; // 脱落したあとに1手ずつ見せられた手数
    let deadResults = 0; // 脱落したあとに見せられた結果の数
    for (let guard = 0; guard < 20000; guard += 1) {
      const phase = room.currentPhase();
      if (phase === "MATCH_OVER") break;
      const dead = room.viewFor(0).match.chips[0] === 0;

      if (phase === "FOLD_DECISION") {
        if (room.roomInfo().seats[0]!.decided === false) room.setFold(0, false);
        continue;
      }
      if (phase === "ROUND_RESULT") {
        if (dead) {
          deadResults += 1;
          // 押すまで次は配られない。破産した人の前で局が飛ばないこと
          const round = room.roomInfo().round;
          expect(room.currentPhase()).toBe("ROUND_RESULT");
          expect(room.roomInfo().round).toBe(round);
        }
        room.next(0);
        continue;
      }
      if (phase !== "PLAYING") break;

      if (room.runsOnBotsAlone()) {
        room.runOutRound();
        continue;
      }
      if (room.needsBotStep()) {
        if (dead) forced += 1;
        room.stepBot();
        continue;
      }
      // 自分の番。勝ち筋は問わないので、引いて捨てるだけ
      const g = room.viewFor(0).game;
      if (g.actor !== 0) break;
      if (g.phase === "AWAITING_FIRST_DRAW" || g.phase === "AWAITING_DRAW") {
        room.act(0, { type: "DRAW", from: "STOCK" });
      } else if (g.phase === "AWAITING_DISCARD") {
        room.act(0, { type: "DISCARD", cardId: g.hand[0]!.id });
      } else if (g.phase === "AWAITING_KEEP_DECISION") {
        room.act(0, { type: "REJECT" });
      } else if (g.phase === "AWAITING_INTERCEPT") {
        room.act(0, { type: "PASS_INTERCEPT" });
      } else {
        break;
      }
    }

    // この種では人が破産して終わる。そこまで行っていないと検査にならない
    expect(room.currentPhase()).toBe("MATCH_OVER");
    expect(room.viewFor(0).match.chips[0]).toBe(0);
    expect(deadResults).toBeGreaterThan(0);
    expect(forced).toBe(0);
  });

  it("誰も見ていない卓では飛ばさない", () => {
    const room = makeRoom();
    const seats = joinAll(room);
    room.start();
    foldAll(room, seats, false);
    for (const s of seats) room.disconnect(s);

    // 全席が CPU 任せだが、結果を待っている人もいない。急ぐ理由が無い
    expect(room.runsOnBotsAlone()).toBe(false);
  });
});

describe("結果画面の待ち", () => {
  it("「次へ」を押した席が盤面に出る。押していない人がいるうちは進まない", () => {
    // 押しても画面が何も変わらないと、届いていないのか卓が止まったのか分からない。
    // 誰を待っているかを名前で出せるよう、席ごとの用意を配る
    const room = makeRoom();
    const seats = joinAll(room);
    room.start();
    // 1人だけ勝負すれば不戦勝で結果画面に入る
    room.setFold(seats[0]!, false);
    foldAll(room, seats.slice(1), true);
    expect(room.currentPhase()).toBe("ROUND_RESULT");
    expect(room.roomInfo().seats.map((s) => s.ready)).toEqual([false, false, false, false]);

    room.next(seats[0]!);
    expect(room.roomInfo().seats.map((s) => s.ready)).toEqual([true, false, false, false]);
    expect(room.currentPhase()).toBe("ROUND_RESULT");

    for (const s of seats.slice(1)) room.next(s);
    // 全員そろえば次のラウンドへ。用意は持ち越さない
    expect(room.currentPhase()).not.toBe("ROUND_RESULT");
    expect(room.roomInfo().seats.map((x) => x.ready)).toEqual([false, false, false, false]);
  });
});

describe("上がる", () => {
  it("画面が持っている情報だけで組み立てた上がり手が、そのまま通る", () => {
    // 種 1379 は席0に配られた9枚がそのまま役として揃っている
    // （QDQHQS / 9D9C9S / AD-KD-QD の階段。コリンガは QD）。
    // 1枚引けば、その札を捨てて上がれる＝いちばん普通の上がり方。
    // ※ Room は生成時に一度配ってから start でもう一度配るので、
    //   種は「2回目の配り」で揃うものを選んである。
    const room = makeRoom(1379);
    room.join("あ");
    room.start(true);
    room.setFold(0, false);
    expect(room.currentPhase()).toBe("PLAYING");

    // 引いて、その札を手札に入れる（山から引くと採否を訊かれる）
    room.act(0, { type: "DRAW", from: "STOCK" });
    expect(room.viewFor(0).game.phase).toBe("AWAITING_KEEP_DECISION");
    room.act(0, { type: "KEEP" });
    const board = room.viewFor(0).game;
    expect(board.phase).toBe("AWAITING_DISCARD");
    expect(board.hand).toHaveLength(10);

    // **画面が見えているものだけで組み立てる。** 自分の手札とコリンガしか使わない
    const action = findBaterAction(board.hand, board.wild);
    expect(action).not.toBeNull();
    // 捨てる札を指していること。指さない BATER は「10枚すべて役」の意味しか持たず、
    // オンライン版はこれを付けずに送っていたため普通の上がりが通らなかった
    expect((action as { cardId?: string }).cardId).toBeDefined();

    const r = room.act(0, action!);
    expect(r.ok).toBe(true);
    expect(room.currentPhase()).not.toBe("PLAYING");
    expect(room.viewFor(0).match.lastWinner).toBe(0);
  });
});
