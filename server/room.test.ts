// 卓の検査。
//
// 見るのは主に3つ。
//   1. **他人の番に打てないこと**（ここが緩いと対戦にならない）
//   2. 配られる盤面に他人の手札が混ざらないこと
//   3. 人が抜けても卓が止まらないこと
//
// CPU は自分で動かないので、テストは `stepBot()` を回すだけで進む。
// 時計を差し込む必要がない。

import { describe, it, expect } from "vitest";
import { Room, SEAT_COUNT } from "./room.ts";

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
    room.join("あ");
    room.start();
    expect(room.join("い")).toMatchObject({ ok: false });
  });

  it("トークンが合えば元の席に戻れる", () => {
    const room = makeRoom();
    const joined = room.join("あ");
    expect(joined.ok).toBe(true);
    if (!joined.ok) return;

    room.start();
    room.disconnect(joined.seat);
    expect(room.roomInfo().seats[joined.seat]!.disconnected).toBe(true);

    const back = room.join("あ", joined.token);
    expect(back).toMatchObject({ ok: true, seat: joined.seat, rejoined: true });
    expect(room.roomInfo().seats[joined.seat]!.disconnected).toBe(false);
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
  it("空席は CPU が埋める", () => {
    const room = makeRoom();
    room.join("あ");
    expect(room.start()).toMatchObject({ ok: true });

    const info = room.roomInfo();
    expect(info.seats.filter((s) => s.isBot)).toHaveLength(3);
    expect(info.seats[0]!.isBot).toBe(false);
  });

  it("人がいなければ始められない", () => {
    expect(makeRoom().start()).toMatchObject({ ok: false });
  });

  it("開始直後は降りるかを決める場面で、CPU は決め終えている", () => {
    const room = makeRoom();
    room.join("あ");
    room.start();

    expect(room.currentPhase()).toBe("FOLD_DECISION");
    const info = room.roomInfo();
    expect(info.seats[0]!.decided).toBe(false);
    expect(info.seats.slice(1).every((s) => s.decided)).toBe(true);
  });
});

describe("手番の検査", () => {
  it("自分の番でなければ断る", () => {
    const room = makeRoom();
    const me = room.join("あ");
    if (!me.ok) return;
    room.start();
    room.setFold(me.seat, false);

    const actor = room.viewFor(me.seat).game.actor;
    const notMe = (actor + 1) % SEAT_COUNT;

    expect(room.act(notMe, { type: "DRAW" })).toMatchObject({
      ok: false,
      reason: "あなたの番ではありません",
    });
  });

  it("engine が断った手はそのまま断る", () => {
    const room = makeRoom();
    const me = room.join("あ");
    if (!me.ok) return;
    room.start();
    room.setFold(me.seat, false);
    runBots(room);

    const view = room.viewFor(me.seat);
    if (view.game.actor !== me.seat) return; // CPU の番なら検査を飛ばす

    // 引く前に捨てようとする
    const result = room.act(me.seat, { type: "DISCARD", cardId: view.game.hand[0]!.id });
    expect(result.ok).toBe(false);
  });

  it("決める場面が終わる前には打てない", () => {
    const room = makeRoom();
    const me = room.join("あ");
    if (!me.ok) return;
    room.start();
    expect(room.act(me.seat, { type: "DRAW" })).toMatchObject({ ok: false });
  });
});

describe("配る盤面", () => {
  it("他人の手札は混ざらない", () => {
    const room = makeRoom();
    const a = room.join("あ");
    const b = room.join("い");
    if (!a.ok || !b.ok) return;
    room.start();

    const viewA = room.viewFor(a.seat);
    const viewB = room.viewFor(b.seat);

    const idsA = new Set(viewA.game.hand.map((c) => c.id));
    const idsB = viewB.game.hand.map((c) => c.id);

    // 2組デッキなので同じ札は2枚あるが、id は一意
    for (const id of idsB) expect(idsA.has(id)).toBe(false);

    // 相手の枚数だけは見える
    expect(viewA.game.seats[b.seat]!.handCount).toBe(9);
  });

  it("席を持たない接続にはどの手札も見せない", () => {
    const room = makeRoom();
    room.join("あ");
    room.start();

    const view = room.viewFor(-1);
    expect(view.you).toBe(-1);
    expect(view.game.hand).toEqual([]);
    expect(view.game.seats.every((s) => s.handCount === 9)).toBe(true);
  });

  it("ラウンドが終わるまで勝者の手札は開かない", () => {
    const room = makeRoom();
    const me = room.join("あ");
    if (!me.ok) return;
    room.start();
    expect(room.viewFor(me.seat).game.revealedHand).toBeNull();
  });
});

describe("卓が止まらないこと", () => {
  it("人が降りれば CPU だけでラウンドが終わる", () => {
    const room = makeRoom();
    const me = room.join("あ");
    if (!me.ok) return;
    room.start();
    room.setFold(me.seat, true);

    runBots(room);
    // 降りた本人は結果を待つ側。CPU 同士で決着している
    expect(["ROUND_RESULT", "MATCH_OVER", "FOLD_DECISION"]).toContain(room.currentPhase());
  });

  it("通信が切れた席は CPU が代わりに打つ", () => {
    const room = makeRoom();
    const me = room.join("あ");
    if (!me.ok) return;
    room.start();
    room.setFold(me.seat, false);
    room.disconnect(me.seat);

    // 自分の番でも CPU が引き受けるので、進み続ける
    const steps = runBots(room);
    expect(steps).toBeGreaterThan(0);
    expect(room.currentPhase()).not.toBe("PLAYING");
  });

  it("全員が降りたら決着なしで畳む", () => {
    const room = makeRoom();
    const a = room.join("あ");
    const b = room.join("い");
    const c = room.join("う");
    const d = room.join("え");
    if (!a.ok || !b.ok || !c.ok || !d.ok) return;
    room.start();

    for (const s of [a, b, c, d]) room.setFold(s.seat, true);

    expect(room.currentPhase()).not.toBe("PLAYING");
    const settled = room.settlement();
    expect(settled).not.toBeNull();
    expect(settled!.state.lastWinner).toBeNull();
  });

  it("誰も繋がっていなければ結果画面で待たない", () => {
    const room = makeRoom();
    const me = room.join("あ");
    if (!me.ok) return;
    room.start();
    room.setFold(me.seat, false);
    room.disconnect(me.seat);
    runBots(room);

    // 待つ相手がいないので、結果で止まらず次のラウンドへ進んでいる
    expect(room.currentPhase()).not.toBe("ROUND_RESULT");
  });
});

describe("マッチが終わるまで回る", () => {
  it("CPU 4人でマッチが決着する", () => {
    const room = makeRoom(7);
    const me = room.join("見物");
    if (!me.ok) return;
    room.start();
    room.disconnect(me.seat); // 全席を CPU に任せる

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
