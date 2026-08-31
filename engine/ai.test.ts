import { describe, it, expect } from "vitest";
import type { Card, Rank, Wild } from "./types";
import { GameState, createInitialState, applyAction } from "./gameEngine";
import { dealGame } from "./deck";
import {
  cardAffinity,
  chooseDiscard,
  shouldTakeDiscard,
  findBaterAction,
  decideAction,
} from "./ai";

/** 再現性のある擬似乱数（mulberry32）。シードを変えて多数の局を回すために使う。 */
function seededRng(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const c = (id: string, suit: Card["suit"], rank: Rank): Card => ({ id, suit, rank });
const wild: Wild = { rank: "8", suit: "S" }; // ヴィラが 7♠ のとき。8♠ だけがワイルド

function makeState(overrides: Partial<GameState> & { hands: Card[][] }): GameState {
  return {
    hands: overrides.hands,
    stock: overrides.stock ?? [c("stock", "C", "2")],
    discard: overrides.discard ?? [],
    currentPlayer: overrides.currentPlayer ?? 0,
    wild: overrides.wild ?? wild,
    phase: overrides.phase ?? "AWAITING_DRAW",
    winner: overrides.winner ?? null,
    takenFromDiscard: overrides.takenFromDiscard ?? null,
    recycles: overrides.recycles ?? 0,
    vira: overrides.vira ?? null,
    pendingCard: overrides.pendingCard ?? null,
  };
}

describe("cardAffinity", () => {
  it("ワイルドは無限大の価値を持つ（絶対に捨てない）", () => {
    const hand = [c("w", "S", "8"), c("a", "H", "2")];
    expect(cardAffinity(c("w", "S", "8"), hand, wild)).toBe(Number.POSITIVE_INFINITY);
  });

  it("同ランクの相方がいる札は孤立札より高く評価される", () => {
    const hand = [c("a", "S", "9"), c("b", "H", "9"), c("lonely", "D", "3")];
    const paired = cardAffinity(c("a", "S", "9"), hand, wild);
    const lonely = cardAffinity(c("lonely", "D", "3"), hand, wild);
    expect(paired).toBeGreaterThan(lonely);
  });

  it("同スートで隣接する札は孤立札より高く評価される", () => {
    const hand = [c("a", "S", "5"), c("b", "S", "6"), c("lonely", "D", "K")];
    expect(cardAffinity(c("a", "S", "5"), hand, wild)).toBeGreaterThan(
      cardAffinity(c("lonely", "D", "K"), hand, wild)
    );
  });

  it("K と A は循環上で隣接として扱われる（K-A-2のまたぎがあるため）", () => {
    const hand = [c("k", "S", "K"), c("a", "S", "A")];
    expect(cardAffinity(c("k", "S", "K"), hand, wild)).toBeGreaterThan(0);
  });
});

describe("chooseDiscard", () => {
  it("役に絡んでいない孤立札を捨てる", () => {
    const hand = [
      c("1", "S", "5"), c("2", "S", "6"), c("3", "S", "7"),
      c("4", "H", "9"), c("5", "D", "9"), c("6", "C", "9"),
      c("lonely", "D", "2"),
    ];
    expect(chooseDiscard(hand, wild)?.id).toBe("lonely");
  });

  it("孤立札があってもワイルドは捨てない", () => {
    const hand = [c("w", "S", "8"), c("lonely", "D", "2"), c("lonely2", "H", "5")];
    expect(chooseDiscard(hand, wild)?.id).not.toBe("w");
  });

  it("空の手札ではnullを返す", () => {
    expect(chooseDiscard([], wild)).toBeNull();
  });
});

describe("shouldTakeDiscard", () => {
  // 実戦どおり9枚。5-6-7♠ と 9のトリンカで6枚ぶんは揃っているが、
  // J♥Q♥ は2枚で役にならず 3♣ が浮いているので、まだ上がれない手。
  // 枚数の少ない手札で試すと「何を拾っても上がれる」状態になり、
  // 拾うかどうかの判断そのものを検証できなくなる。
  const nine: Card[] = [
    c("1", "S", "5"), c("2", "S", "6"), c("3", "S", "7"),
    c("4", "H", "9"), c("5", "D", "9"), c("6", "C", "9"),
    c("7", "H", "J"), c("8", "H", "Q"), c("9", "C", "3"),
  ];

  it("捨て札が無ければ拾わない", () => {
    expect(shouldTakeDiscard(nine, undefined, wild)).toBe(false);
  });

  it("ワイルドは必ず拾う", () => {
    expect(shouldTakeDiscard(nine, c("t", "S", "8"), wild)).toBe(true);
  });

  it("シーケンスが伸びる札は拾う", () => {
    // 4♠ は 5-6-7♠ にくっつく
    expect(shouldTakeDiscard(nine, c("t", "S", "4"), wild)).toBe(true);
  });

  it("どこにも絡まない札は拾わない（山札を引いたほうがまし）", () => {
    // K♦ は同ランクの相方も同スートの近隣もいない
    expect(shouldTakeDiscard(nine, c("t", "D", "K"), wild)).toBe(false);
  });

  it("拾えばそのまま上がれる札は拾う", () => {
    const meldedNine = [
      c("1", "S", "5"), c("2", "S", "6"), c("3", "S", "7"),
      c("4", "H", "9"), c("5", "D", "9"), c("6", "C", "9"),
      c("7", "H", "J"), c("8", "H", "Q"), c("9", "H", "K"),
    ];
    // 9枚が既に揃っているので、何を拾っても余らせて上がれる
    expect(shouldTakeDiscard(meldedNine, c("t", "D", "2"), wild)).toBe(true);
  });
});

describe("findBaterAction", () => {
  const meldedNine: Card[] = [
    c("1", "S", "5"), c("2", "S", "6"), c("3", "S", "7"),
    c("4", "H", "9"), c("5", "D", "9"), c("6", "C", "9"),
    c("7", "H", "J"), c("8", "H", "Q"), c("9", "H", "K"),
  ];

  it("10枚全てが役なら捨てなしのBATERを返す", () => {
    const tenCardHand = [
      c("1", "S", "5"), c("2", "S", "6"), c("3", "S", "7"), c("w", "S", "8"),
      c("4", "H", "9"), c("5", "D", "9"), c("6", "C", "9"),
      c("7", "H", "J"), c("8", "H", "Q"), c("9", "H", "K"),
    ];
    expect(findBaterAction(tenCardHand, wild)).toEqual({ type: "BATER" });
  });

  it("9枚が役なら余りを捨てるBATERを返す", () => {
    const extra = c("extra", "D", "2");
    const action = findBaterAction([...meldedNine, extra], wild);
    expect(action).toEqual({ type: "BATER", cardId: "extra" });
  });

  it("上がれない手札ではnullを返す", () => {
    const badHand: Card[] = [
      c("1", "S", "5"), c("2", "H", "2"), c("3", "D", "K"),
      c("4", "C", "3"), c("5", "S", "10"), c("6", "H", "6"),
      c("7", "D", "J"), c("8", "C", "4"), c("9", "S", "9"),
      c("10", "H", "7"),
    ];
    expect(findBaterAction(badHand, wild)).toBeNull();
  });
});

describe("decideAction", () => {
  it("捨て札が無ければ山札から引く", () => {
    const state = makeState({ hands: [[], [], [], []], discard: [], phase: "AWAITING_DRAW" });
    expect(decideAction(state)).toEqual({ type: "DRAW", from: "STOCK" });
  });

  it("役に絡む捨て札があれば拾いにいく", () => {
    const hand = [c("a", "S", "5"), c("b", "S", "6"), c("lonely", "D", "K")];
    const state = makeState({
      hands: [hand, [], [], []],
      discard: [c("top", "S", "7")], // 5-6-7 が揃う
      phase: "AWAITING_DRAW",
    });
    expect(decideAction(state)).toEqual({ type: "DRAW", from: "DISCARD" });
  });

  it("拾った札は捨て札に選ばない（engineが弾くので手が詰まる）", () => {
    // 上がれない10枚。捨てる番になっても拾った札は選べない
    const taken = c("taken", "D", "2");
    const hand = [
      c("1", "S", "5"), c("2", "S", "6"), c("3", "S", "7"),
      c("4", "H", "9"), c("5", "D", "9"), c("6", "C", "9"),
      c("7", "H", "J"), c("8", "H", "Q"), c("9", "C", "3"),
      taken,
    ];
    const state = makeState({
      hands: [hand, [], [], []],
      phase: "AWAITING_DISCARD",
      takenFromDiscard: "taken",
    });
    const action = decideAction(state);
    expect(action?.type).toBe("DISCARD");
    if (action?.type !== "DISCARD") return;
    expect(action.cardId).not.toBe("taken");
  });

  it("上がれる手ならDISCARDよりBATERを優先する", () => {
    const hand = [
      c("1", "S", "5"), c("2", "S", "6"), c("3", "S", "7"),
      c("4", "H", "9"), c("5", "D", "9"), c("6", "C", "9"),
      c("7", "H", "J"), c("8", "H", "Q"), c("9", "H", "K"),
      c("extra", "D", "2"),
    ];
    const state = makeState({ hands: [hand, [], [], []], phase: "AWAITING_DISCARD" });
    expect(decideAction(state)?.type).toBe("BATER");
  });

  it("上がれないならDISCARDを返す", () => {
    const hand = [c("a", "S", "5"), c("b", "S", "6"), c("lonely", "D", "K")];
    const state = makeState({ hands: [hand, [], [], []], phase: "AWAITING_DISCARD" });
    expect(decideAction(state)).toEqual({ type: "DISCARD", cardId: "lonely" });
  });

  it("ラウンド終了後はnullを返す", () => {
    const state = makeState({ hands: [[], [], [], []], phase: "ROUND_OVER", winner: 0 });
    expect(decideAction(state)).toBeNull();
  });
});

describe("decideAction（一番手の最初の手番）", () => {
  // 上がりには遠く、5-6♠ だけが繋がっている手
  const hand = [
    c("1", "S", "5"), c("2", "S", "6"), c("3", "H", "2"),
    c("4", "D", "10"), c("5", "C", "K"), c("6", "H", "4"),
    c("7", "D", "J"), c("8", "C", "3"), c("9", "H", "9"),
  ];

  it("役に絡むヴィラなら買う", () => {
    const state = makeState({
      hands: [hand, [], [], []],
      phase: "AWAITING_FIRST_DRAW",
      vira: c("v", "S", "7"), // 5-6♠ に繋がる
    });
    expect(decideAction(state)).toEqual({ type: "TAKE_VIRA" });
  });

  it("使えないヴィラなら買わず山札から引く", () => {
    const state = makeState({
      hands: [hand, [], [], []],
      phase: "AWAITING_FIRST_DRAW",
      vira: c("v", "C", "7"), // どこにも絡まない
    });
    expect(decideAction(state)).toEqual({ type: "DRAW", from: "STOCK" });
  });

  it("見せられた札が使えるなら KEEP", () => {
    const state = makeState({
      hands: [hand, [], [], []],
      phase: "AWAITING_KEEP_DECISION",
      pendingCard: c("p", "S", "7"),
    });
    expect(decideAction(state)).toEqual({ type: "KEEP" });
  });

  it("見せられた札が使えないなら REJECT して引き直す", () => {
    const state = makeState({
      hands: [hand, [], [], []],
      phase: "AWAITING_KEEP_DECISION",
      pendingCard: c("p", "C", "7"),
    });
    expect(decideAction(state)).toEqual({ type: "REJECT" });
  });

  it("ワイルドのヴィラは必ず買う", () => {
    const state = makeState({
      hands: [hand, [], [], []],
      phase: "AWAITING_FIRST_DRAW",
      vira: c("v", "S", "8"), // wild = 8♠
    });
    expect(decideAction(state)).toEqual({ type: "TAKE_VIRA" });
  });
});

// AI同士に最後まで打たせて、engineが破綻せず必ず決着することを確認する。
// UI側で無限ループやカード消失が起きないための土台になるので、
// 単体テストより先にここで潰しておく。
describe("CPU4人による通しプレイ（統合）", () => {
  const SEEDS = [1, 2, 3, 7, 42, 99, 123, 2024, 31337, 65535];

  for (const seed of SEEDS) {
    it(`seed=${seed} でラウンドが正常に終了する`, () => {
      const deal = dealGame(4, seededRng(seed));
      let state = createInitialState(deal);

      // 山札67枚。1手番=1ドローなので、これを大きく超えたら進行不能とみなす
      let guard = 0;
      while (state.phase !== "ROUND_OVER") {
        const action = decideAction(state);
        expect(action).not.toBeNull();
        const result = applyAction(state, action!);
        if (!result.ok) throw new Error(`不正な手が選ばれた: ${result.error}`);
        state = result.state;

        guard++;
        if (guard > 500) throw new Error("ラウンドが終了しない（進行不能）");
      }

      // 決着後の不変条件：カードが増減していないこと
      const inHands = state.hands.flat().length;
      // ヴィラは一番手に買われて手札へ入ることがあるので、場に残っていれば足す
      const onTable = state.vira === null ? 0 : 1;
      const pending = state.pendingCard === null ? 0 : 1;
      const total = inHands + state.stock.length + state.discard.length + onTable + pending;
      expect(total).toBe(104);

      // 勝者がいるなら、その手札は実際に役として成立しているはず
      if (state.winner !== null) {
        const hand = state.hands[state.winner]!;
        expect(hand.length === 9 || hand.length === 10).toBe(true);
        expect(findBaterAction(hand, state.wild)).not.toBeNull();
      }
    });
  }
});
