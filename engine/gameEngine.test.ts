import { describe, it, expect } from "vitest";
import type { Card, Rank, Wild } from "./types";
import { createInitialState, applyAction, GameState } from "./gameEngine";

const c = (id: string, suit: Card["suit"], rank: Rank): Card => ({ id, suit, rank });
const wild: Wild = { rank: "8", suit: "S" }; // ヴィラが 7♠ のとき。8♠ だけがワイルド

/** テスト用に手札・山札・捨て札を直接指定して状態を組み立てるヘルパー */
function makeState(overrides: Partial<GameState> & { hands: Card[][] }): GameState {
  return {
    hands: overrides.hands,
    stock: overrides.stock ?? [],
    discard: overrides.discard ?? [],
    currentPlayer: overrides.currentPlayer ?? 0,
    wild: overrides.wild ?? wild,
    phase: overrides.phase ?? "AWAITING_DRAW",
    winner: overrides.winner ?? null,
    takenFromDiscard: overrides.takenFromDiscard ?? null,
    recycles: overrides.recycles ?? 0,
  };
}

describe("createInitialState", () => {
  it("dealGameの結果からAWAITING_DRAWの初期状態を作る", () => {
    const deal = {
      hands: [[c("1", "S", "5")], [c("2", "H", "6")], [c("3", "D", "7")], [c("4", "C", "8")]],
      vira: c("v", "S", "7"),
      wild,
      stock: [c("5", "S", "9")],
    };
    const state = createInitialState(deal);
    expect(state.phase).toBe("AWAITING_DRAW");
    expect(state.currentPlayer).toBe(0);
    expect(state.winner).toBeNull();
    expect(state.hands).toEqual(deal.hands);
  });
});

describe("DRAW", () => {
  it("山札の一番上を現在プレイヤーの手札に加え、AWAITING_DISCARDへ遷移する", () => {
    const drawnCard = c("stock1", "S", "9");
    const state = makeState({
      hands: [[c("1", "S", "5")], [], [], []],
      stock: [c("stock0", "S", "2"), drawnCard],
      phase: "AWAITING_DRAW",
    });

    const result = applyAction(state, { type: "DRAW" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.hands[0]).toEqual([c("1", "S", "5"), drawnCard]);
    expect(result.state.stock).toEqual([c("stock0", "S", "2")]);
    expect(result.state.phase).toBe("AWAITING_DISCARD");
  });

  it("AWAITING_DISCARD中のDRAWは拒否される", () => {
    const state = makeState({ hands: [[], [], [], []], phase: "AWAITING_DISCARD" });
    const result = applyAction(state, { type: "DRAW" });
    expect(result.ok).toBe(false);
  });

  it("山札も捨て札も尽きていたら勝者なしでラウンド終了する", () => {
    const state = makeState({
      hands: [[], [], [], []],
      stock: [],
      discard: [],
      phase: "AWAITING_DRAW",
    });
    const result = applyAction(state, { type: "DRAW" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe("ROUND_OVER");
    expect(result.state.winner).toBeNull();
  });

  it("山札が尽きたら捨て札をそのままの順で山札に組み直す", () => {
    const oldest = c("old", "S", "2");
    const middle = c("mid", "H", "3");
    const newest = c("new", "D", "4");
    const state = makeState({
      hands: [[], [], [], []],
      stock: [],
      // 末尾が最新の捨て札
      discard: [oldest, middle, newest],
      phase: "AWAITING_DRAW",
    });

    const result = applyAction(state, { type: "DRAW" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 最初に引かれるのは一番古い捨て札
    expect(result.state.hands[0]).toEqual([oldest]);
    // 最後に捨てられた札が新しい山札の最後（＝最後に引かれる）に来る
    expect(result.state.stock).toEqual([newest, middle]);
    expect(result.state.discard).toEqual([]);
    expect(result.state.recycles).toBe(1);
  });

  it("組み直しの上限に達したら勝者なしで終了する（無限に続かないための安全弁）", () => {
    const state = makeState({
      hands: [[], [], [], []],
      stock: [],
      discard: [c("a", "S", "2"), c("b", "H", "3")],
      recycles: 3,
      phase: "AWAITING_DRAW",
    });
    const result = applyAction(state, { type: "DRAW" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe("ROUND_OVER");
    expect(result.state.winner).toBeNull();
  });
});

describe("DRAW（捨て札から拾う）", () => {
  it("捨て札の一番上を手札に加え、拾った札として記録する", () => {
    const buried = c("buried", "S", "2");
    const top = c("top", "H", "9");
    const state = makeState({
      hands: [[c("mine", "S", "5")], [], [], []],
      discard: [buried, top],
      phase: "AWAITING_DRAW",
    });

    const result = applyAction(state, { type: "DRAW", from: "DISCARD" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.hands[0]).toEqual([c("mine", "S", "5"), top]);
    // 拾えるのは一番上の1枚だけ。下は残る
    expect(result.state.discard).toEqual([buried]);
    expect(result.state.takenFromDiscard).toBe("top");
    expect(result.state.phase).toBe("AWAITING_DISCARD");
    // 山札には手を付けない
    expect(result.state.stock).toEqual(state.stock);
  });

  it("捨て札が空なら拒否される", () => {
    const state = makeState({ hands: [[], [], [], []], discard: [], phase: "AWAITING_DRAW" });
    const result = applyAction(state, { type: "DRAW", from: "DISCARD" });
    expect(result.ok).toBe(false);
  });

  it("拾った札をその手番で捨て直すことはできない", () => {
    const taken = c("taken", "H", "9");
    const state = makeState({
      hands: [[c("other", "S", "5"), taken], [], [], []],
      phase: "AWAITING_DISCARD",
      takenFromDiscard: "taken",
    });
    const result = applyAction(state, { type: "DISCARD", cardId: "taken" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("拾った札");
  });

  it("拾った札以外なら捨てられ、手番が移るときに記録はクリアされる", () => {
    const taken = c("taken", "H", "9");
    const other = c("other", "S", "5");
    const state = makeState({
      hands: [[other, taken], [], [], []],
      phase: "AWAITING_DISCARD",
      takenFromDiscard: "taken",
    });

    const result = applyAction(state, { type: "DISCARD", cardId: "other" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.takenFromDiscard).toBeNull();
    expect(result.state.currentPlayer).toBe(1);
  });

  it("ROUND_OVER後のDRAWは拒否される", () => {
    const state = makeState({
      hands: [[], [], [], []],
      stock: [c("s", "S", "2")],
      phase: "ROUND_OVER",
      winner: 0,
    });
    const result = applyAction(state, { type: "DRAW" });
    expect(result.ok).toBe(false);
  });
});

describe("DISCARD", () => {
  it("指定したカードを手札から捨て札へ移し、次のプレイヤーのAWAITING_DRAWへ遷移する", () => {
    const keep = c("keep", "H", "3");
    const discardMe = c("discard-me", "S", "4");
    const state = makeState({
      hands: [[keep, discardMe], [], [], []],
      currentPlayer: 0,
      phase: "AWAITING_DISCARD",
    });

    const result = applyAction(state, { type: "DISCARD", cardId: "discard-me" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.hands[0]).toEqual([keep]);
    expect(result.state.discard).toEqual([discardMe]);
    expect(result.state.currentPlayer).toBe(1);
    expect(result.state.phase).toBe("AWAITING_DRAW");
  });

  it("4人目の次は最初のプレイヤーへ手番が巡回する", () => {
    const state = makeState({
      hands: [[], [], [], [c("last", "S", "4")]],
      currentPlayer: 3,
      phase: "AWAITING_DISCARD",
    });
    const result = applyAction(state, { type: "DISCARD", cardId: "last" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.currentPlayer).toBe(0);
  });

  it("手札に無いカードIDを指定すると拒否される", () => {
    const state = makeState({
      hands: [[c("a", "S", "4")], [], [], []],
      phase: "AWAITING_DISCARD",
    });
    const result = applyAction(state, { type: "DISCARD", cardId: "not-in-hand" });
    expect(result.ok).toBe(false);
  });

  it("AWAITING_DRAW中のDISCARDは拒否される", () => {
    const state = makeState({
      hands: [[c("a", "S", "4")], [], [], []],
      phase: "AWAITING_DRAW",
    });
    const result = applyAction(state, { type: "DISCARD", cardId: "a" });
    expect(result.ok).toBe(false);
  });
});

describe("BATER", () => {
  // 9枚が綺麗に3役へ分類できる手 + 余分な1枚
  const meldedNine: Card[] = [
    c("1", "S", "5"), c("2", "S", "6"), c("3", "S", "7"),
    c("4", "H", "9"), c("5", "D", "9"), c("6", "C", "9"),
    c("7", "H", "J"), c("8", "H", "Q"), c("9", "H", "K"),
  ];

  it("9枚が役成立・1枚捨てて上がれる場合、ROUND_OVERになり捨てたカードが捨て札に入る", () => {
    const extra = c("extra", "D", "2");
    const state = makeState({
      hands: [[...meldedNine, extra], [], [], []],
      currentPlayer: 0,
      phase: "AWAITING_DISCARD",
    });

    const result = applyAction(state, { type: "BATER", cardId: "extra" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe("ROUND_OVER");
    expect(result.state.winner).toBe(0);
    expect(result.state.hands[0]).toEqual(meldedNine);
    expect(result.state.discard).toEqual([extra]);
  });

  it("10枚全てが役成立する場合、cardIdなしで何も捨てずに上がれる（bater com 10）", () => {
    // meldedNineの5-6-7シーケンスを5-6-7-8(ワイルド)に伸ばして10枚全部役にする
    const tenCardHand: Card[] = [
      c("1", "S", "5"), c("2", "S", "6"), c("3", "S", "7"), c("w", "S", "8"),
      c("4", "H", "9"), c("5", "D", "9"), c("6", "C", "9"),
      c("7", "H", "J"), c("8", "H", "Q"), c("9", "H", "K"),
    ];
    const state = makeState({
      hands: [tenCardHand, [], [], []],
      currentPlayer: 0,
      phase: "AWAITING_DISCARD",
    });

    const result = applyAction(state, { type: "BATER" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe("ROUND_OVER");
    expect(result.state.winner).toBe(0);
    expect(result.state.hands[0]).toEqual(tenCardHand);
    expect(result.state.discard).toEqual([]);
  });

  it("役に分類しきれない手札でのBATERは拒否される", () => {
    const badHand: Card[] = [
      c("1", "S", "5"), c("2", "H", "2"), c("3", "D", "K"),
      c("4", "C", "3"), c("5", "S", "10"), c("6", "H", "6"),
      c("7", "D", "J"), c("8", "C", "4"), c("9", "S", "9"),
      c("10", "H", "2"),
    ];
    const state = makeState({
      hands: [badHand, [], [], []],
      currentPlayer: 0,
      phase: "AWAITING_DISCARD",
    });

    const result = applyAction(state, { type: "BATER", cardId: "10" });
    expect(result.ok).toBe(false);
  });

  it("拾った札を余らせての上がりは許される（捨て直しの禁止は上がりには及ばない）", () => {
    const taken = c("taken", "D", "2");
    const state = makeState({
      hands: [[...meldedNine, taken], [], [], []],
      currentPlayer: 0,
      phase: "AWAITING_DISCARD",
      takenFromDiscard: "taken",
    });

    const result = applyAction(state, { type: "BATER", cardId: "taken" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.winner).toBe(0);
    expect(result.state.hands[0]).toEqual(meldedNine);
  });

  it("AWAITING_DRAW中（9枚保持時）のBATERは拒否される", () => {
    const state = makeState({
      hands: [meldedNine, [], [], []],
      currentPlayer: 0,
      phase: "AWAITING_DRAW",
    });
    const result = applyAction(state, { type: "BATER" });
    expect(result.ok).toBe(false);
  });
});
