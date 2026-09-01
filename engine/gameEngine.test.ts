import { describe, it, expect } from "vitest";
import type { Card, Rank, Wild } from "./types.ts";
import { createInitialState, applyAction, currentActor, GameState } from "./gameEngine.ts";

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
    vira: overrides.vira ?? null,
    pendingCard: overrides.pendingCard ?? null,
    folded: overrides.folded ?? overrides.hands.map(() => false),
    interceptQueue: overrides.interceptQueue ?? [],
  };
}

describe("createInitialState", () => {
  it("dealGameの結果から、一番手の特別な手番で始まる状態を作る", () => {
    const deal = {
      hands: [[c("1", "S", "5")], [c("2", "H", "6")], [c("3", "D", "7")], [c("4", "C", "8")]],
      vira: c("v", "S", "7"),
      wild,
      stock: [c("5", "S", "9")],
    };
    const state = createInitialState(deal);
    expect(state.phase).toBe("AWAITING_FIRST_DRAW");
    expect(state.currentPlayer).toBe(0);
    expect(state.winner).toBeNull();
    expect(state.hands).toEqual(deal.hands);
    // ヴィラは場に出ている（一番手だけが買える）
    expect(state.vira).toEqual(deal.vira);
    expect(state.pendingCard).toBeNull();
  });
});

// 一番手だけの特権。ヴィラを買う／引いた札を1回だけ選び直せる。
describe("一番手の最初の手番", () => {
  const viraCard = c("vira", "S", "7");

  function firstTurnState(overrides: Partial<GameState> = {}) {
    return makeState({
      hands: [[c("mine", "H", "3")], [], [], []],
      stock: [c("s2", "C", "4"), c("s1", "D", "5")], // 末尾が一番上
      phase: "AWAITING_FIRST_DRAW",
      vira: viraCard,
      ...overrides,
    });
  }

  it("ヴィラを買うと手札に入り、場から消えて捨てる場面へ進む", () => {
    const result = applyAction(firstTurnState(), { type: "TAKE_VIRA" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.hands[0]).toEqual([c("mine", "H", "3"), viraCard]);
    expect(result.state.vira).toBeNull();
    expect(result.state.phase).toBe("AWAITING_DISCARD");
    // 山札には手を付けない
    expect(result.state.stock).toHaveLength(2);
  });

  it("ヴィラを買えるのは一番手の最初の手番だけ", () => {
    const later = makeState({
      hands: [[], [], [], []],
      phase: "AWAITING_DRAW",
      vira: viraCard,
    });
    expect(applyAction(later, { type: "TAKE_VIRA" }).ok).toBe(false);
  });

  it("一度買ったヴィラは二度は買えない", () => {
    const taken = firstTurnState({ vira: null });
    expect(applyAction(taken, { type: "TAKE_VIRA" }).ok).toBe(false);
  });

  it("最初の手番にはまだ捨て札が無いので、捨て札からは引けない", () => {
    const result = applyAction(firstTurnState(), { type: "DRAW", from: "DISCARD" });
    expect(result.ok).toBe(false);
  });

  it("山札から引くと、手札に入れずまず表向きで見せる", () => {
    const result = applyAction(firstTurnState(), { type: "DRAW" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.pendingCard).toEqual(c("s1", "D", "5"));
    expect(result.state.phase).toBe("AWAITING_KEEP_DECISION");
    // まだ手札には入っていない
    expect(result.state.hands[0]).toHaveLength(1);
    expect(result.state.stock).toHaveLength(1);
  });

  it("KEEP で見せられた札が手札に入る", () => {
    const shown = firstTurnState({
      phase: "AWAITING_KEEP_DECISION",
      pendingCard: c("p", "D", "5"),
    });

    const result = applyAction(shown, { type: "KEEP" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.hands[0]).toEqual([c("mine", "H", "3"), c("p", "D", "5")]);
    expect(result.state.pendingCard).toBeNull();
    expect(result.state.phase).toBe("AWAITING_DISCARD");
    expect(result.state.discard).toEqual([]);
  });

  it("REJECT すると、その札は手札に入らず捨てられ、山札から引き直す", () => {
    const rejected = c("p", "D", "5");
    const shown = firstTurnState({
      phase: "AWAITING_KEEP_DECISION",
      pendingCard: rejected,
    });

    const result = applyAction(shown, { type: "REJECT" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 捨てた札は捨て札へ（次のプレイヤーが拾える）
    expect(result.state.discard).toEqual([rejected]);
    // 引き直した札は無条件で手札に入る
    expect(result.state.hands[0]).toEqual([c("mine", "H", "3"), c("s1", "D", "5")]);
    expect(result.state.pendingCard).toBeNull();
    // 選び直せるのは1回だけ。もう採否は訊かれない
    expect(result.state.phase).toBe("AWAITING_DISCARD");
  });

  it("見せている札が無いのに KEEP / REJECT はできない", () => {
    const s = firstTurnState();
    expect(applyAction(s, { type: "KEEP" }).ok).toBe(false);
    expect(applyAction(s, { type: "REJECT" }).ok).toBe(false);
  });

  it("特権は最初の手番限り。捨てた後は通常のドローに戻る", () => {
    const afterTake = applyAction(firstTurnState(), { type: "TAKE_VIRA" });
    expect(afterTake.ok).toBe(true);
    if (!afterTake.ok) return;

    const afterDiscard = applyAction(afterTake.state, { type: "DISCARD", cardId: "mine" });
    expect(afterDiscard.ok).toBe(true);
    if (!afterDiscard.ok) return;
    expect(afterDiscard.state.phase).toBe("AWAITING_DRAW");
    expect(afterDiscard.state.currentPlayer).toBe(1);
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

  it("5枚組x2の10枚は、捨てずにそのまま上がれる", () => {
    const fiveAndFive = [
      c("1", "S", "7"), c("2", "S", "7"), c("3", "C", "7"), c("4", "C", "7"), c("5", "H", "7"),
      c("6", "S", "9"), c("7", "S", "9"), c("8", "D", "9"), c("9", "D", "9"), c("10", "H", "9"),
    ];
    const state = makeState({
      hands: [fiveAndFive, [], [], []],
      currentPlayer: 0,
      phase: "AWAITING_DISCARD",
    });

    const result = applyAction(state, { type: "BATER" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.phase).toBe("ROUND_OVER");
    expect(result.state.winner).toBe(0);
    // 10枚のまま＝bater com 10（相手は3チップ失う）
    expect(result.state.hands[0]).toHaveLength(10);
    expect(result.state.discard).toEqual([]);
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

// 手番外で捨て札を拾って上がるルール（本家の「捨て札で上がる」）
describe("捨て札への割り込み", () => {
  // 5-6-7♠ / 9のトリンカ / J-Q♥ + 余り。K♥ が来れば J-Q-K♥ が揃って上がれる
  const oneAway = [
    c("1", "S", "5"), c("2", "S", "6"), c("3", "S", "7"),
    c("4", "H", "9"), c("5", "D", "9"), c("6", "C", "9"),
    c("7", "H", "J"), c("8", "H", "Q"), c("9", "C", "2"),
  ];
  // 何を拾っても上がれないバラバラの9枚
  const hopeless = [
    c("h1", "S", "2"), c("h2", "H", "5"), c("h3", "D", "9"),
    c("h4", "C", "Q"), c("h5", "S", "10"), c("h6", "H", "4"),
    c("h7", "D", "A"), c("h8", "C", "7"), c("h9", "S", "K"),
  ];
  const discarder = [c("d1", "H", "K"), c("d2", "D", "3")];

  function stateBeforeDiscard(hands: Card[][]) {
    return makeState({ hands, currentPlayer: 0, phase: "AWAITING_DISCARD" });
  }

  it("上がれる札が捨てられたら割り込みの局面になる", () => {
    const s = stateBeforeDiscard([discarder, oneAway, hopeless, hopeless]);
    const r = applyAction(s, { type: "DISCARD", cardId: "d1" });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.phase).toBe("AWAITING_INTERCEPT");
    expect(r.state.interceptQueue).toEqual([1]);
    expect(currentActor(r.state)).toBe(1);
  });

  it("誰も上がれなければ通常どおり次の手番へ進む", () => {
    const s = stateBeforeDiscard([discarder, hopeless, hopeless, hopeless]);
    const r = applyAction(s, { type: "DISCARD", cardId: "d1" });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.phase).toBe("AWAITING_DRAW");
    expect(r.state.interceptQueue).toEqual([]);
  });

  it("同時に成立したら、捨てた人の次の席から順に優先される", () => {
    const s = stateBeforeDiscard([discarder, oneAway, hopeless, oneAway]);
    const r = applyAction(s, { type: "DISCARD", cardId: "d1" });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.interceptQueue).toEqual([1, 3]);
  });

  it("捨てた本人は自分の捨て札で割り込めない", () => {
    const s = stateBeforeDiscard([[...oneAway, c("x", "H", "K")], hopeless, hopeless, hopeless]);
    const r = applyAction(s, { type: "DISCARD", cardId: "x" });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.interceptQueue).not.toContain(0);
  });

  it("降りている者は割り込めない", () => {
    const s = makeState({
      hands: [discarder, oneAway, hopeless, hopeless],
      currentPlayer: 0,
      phase: "AWAITING_DISCARD",
      folded: [false, true, false, false],
    });
    const r = applyAction(s, { type: "DISCARD", cardId: "d1" });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.interceptQueue).toEqual([]);
  });

  it("INTERCEPT で拾って上がる。余った1枚は捨て札へ戻る", () => {
    const s = stateBeforeDiscard([discarder, oneAway, hopeless, hopeless]);
    const afterDiscard = applyAction(s, { type: "DISCARD", cardId: "d1" });
    expect(afterDiscard.ok).toBe(true);
    if (!afterDiscard.ok) return;

    const r = applyAction(afterDiscard.state, { type: "INTERCEPT" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.phase).toBe("ROUND_OVER");
    expect(r.state.winner).toBe(1);
    expect(r.state.hands[1]).toHaveLength(9);
    expect(r.state.hands[1]!.some((x) => x.id === "d1")).toBe(true);
  });

  it("PASS_INTERCEPT で見送ると次の候補に回る", () => {
    const s = stateBeforeDiscard([discarder, oneAway, hopeless, oneAway]);
    const afterDiscard = applyAction(s, { type: "DISCARD", cardId: "d1" });
    expect(afterDiscard.ok).toBe(true);
    if (!afterDiscard.ok) return;

    const passed = applyAction(afterDiscard.state, { type: "PASS_INTERCEPT" });
    expect(passed.ok).toBe(true);
    if (!passed.ok) return;
    expect(passed.state.phase).toBe("AWAITING_INTERCEPT");
    expect(currentActor(passed.state)).toBe(3);
  });

  it("全員が見送ると通常の手番に戻る", () => {
    const s = stateBeforeDiscard([discarder, oneAway, hopeless, hopeless]);
    const afterDiscard = applyAction(s, { type: "DISCARD", cardId: "d1" });
    expect(afterDiscard.ok).toBe(true);
    if (!afterDiscard.ok) return;

    const passed = applyAction(afterDiscard.state, { type: "PASS_INTERCEPT" });
    expect(passed.ok).toBe(true);
    if (!passed.ok) return;
    expect(passed.state.phase).toBe("AWAITING_DRAW");
    expect(passed.state.currentPlayer).toBe(1);
  });

  it("割り込みの場面でないのに INTERCEPT はできない", () => {
    const s = makeState({ hands: [oneAway, [], [], []], phase: "AWAITING_DRAW" });
    expect(applyAction(s, { type: "INTERCEPT" }).ok).toBe(false);
    expect(applyAction(s, { type: "PASS_INTERCEPT" }).ok).toBe(false);
  });
});
