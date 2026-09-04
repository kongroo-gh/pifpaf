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

  it("トークンが合えば元の席に戻れる", () => {
    const room = makeRoom();
    const first = room.join("あ");
    room.join("い");
    room.join("う");
    room.join("え");
    if (!first.ok) return;
    room.start();

    room.disconnect(first.seat);
    expect(room.roomInfo().seats[first.seat]!.disconnected).toBe(true);

    const back = room.join("あ", first.token);
    expect(back).toMatchObject({ ok: true, seat: first.seat, rejoined: true });
    expect(room.roomInfo().seats[first.seat]!.disconnected).toBe(false);
  });

  it("始まる前に抜けたら席は空く", () => {
    const room = makeRoom();
    const joined = room.join("あ");
    if (!joined.ok) return;
    room.disconnect(joined.seat);
    expect(room.roomInfo().seats[0]!.name).toBeNull();
    expect(room.roomInfo().hostSeat).toBe(-1);
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

  it("対局中に切断すると、降りるか否かの判断を代わりに決める", () => {
    const room = makeRoom();
    const seats = joinAll(room);
    room.start();

    room.disconnect(seats[0]!);
    const info = room.roomInfo();
    expect(info.seats[seats[0]!]!.decided).toBe(true);
    expect(seats.slice(1).every((s) => info.seats[s]!.decided === false)).toBe(true);
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
  it("残り全員が切断していれば、1人が降りるだけで決着する", () => {
    const room = makeRoom();
    const seats = joinAll(room);
    room.start();
    // 自分以外を切断してCPU任せにする
    for (const s of seats.slice(1)) room.disconnect(s);
    room.setFold(seats[0]!, true);

    runBots(room);
    // 降りた本人は結果を待つ側。CPU 同士で決着している
    expect(["ROUND_RESULT", "MATCH_OVER", "FOLD_DECISION"]).toContain(room.currentPhase());
  });

  it("通信が切れた席は CPU が代わりに打つ", () => {
    const room = makeRoom();
    const seats = joinAll(room);
    room.start();
    foldAll(room, seats, false);

    // ちょうどその席の番になったところで切る
    const actor = room.viewFor(seats[0]!).game.actor;
    room.disconnect(actor);

    // 自分の番でも CPU が代わりに打つので、少なくとも1手は進む
    const steps = runBots(room);
    expect(steps).toBeGreaterThan(0);
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

  it("誰も繋がっていなければ結果画面で待たない", () => {
    const room = makeRoom();
    const seats = joinAll(room);
    room.start();
    foldAll(room, seats, false);
    for (const s of seats) room.disconnect(s);
    runBots(room);

    // 待つ相手がいないので、結果で止まらず次のラウンドへ進んでいる
    expect(room.currentPhase()).not.toBe("ROUND_RESULT");
  });
});

describe("マッチが終わるまで回る", () => {
  it("卓が丸ごと放棄されても、CPUだけで決着まで進む", () => {
    const room = makeRoom(7);
    const seats = joinAll(room);
    room.start();
    for (const s of seats) room.disconnect(s); // 全席をCPUに任せる

    // 1マッチはおよそ6ラウンド × 40手。余裕を持って上限を置く
    let steps = 0;
    while (room.currentPhase() !== "MATCH_OVER" && steps < 5000) {
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
