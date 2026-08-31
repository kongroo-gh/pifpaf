// Pif Paf ルールエンジン - ターンの状態遷移（reducerスタイル）
// deck.ts / melds.ts と同じ方針で、副作用なし・DOM/React/通信に非依存の純粋関数のみで構成する。

import type { Card, Wild } from "./types";
import type { DealResult } from "./deck";
import { classifyAsMelds } from "./melds";

export type Phase =
  /**
   * 一番手の最初の手番だけの局面。ここでだけヴィラを買える。
   * 山札から引くと AWAITING_KEEP_DECISION に移り、見てから採否を決められる。
   */
  | "AWAITING_FIRST_DRAW"
  /** 引いた札を表向きで見せている。手札に入れる（KEEP）か、捨てて引き直す（REJECT）か。 */
  | "AWAITING_KEEP_DECISION"
  | "AWAITING_DRAW"
  | "AWAITING_DISCARD"
  | "ROUND_OVER";

export interface GameState {
  /** hands[playerIndex] = そのプレイヤーの手札 */
  hands: Card[][];
  /** 伏せ山札。末尾を「山の一番上」として扱う（pop/pushでO(1)にするため） */
  stock: Card[];
  /** 捨て札置き場。末尾が最新（一番上）の捨て札 */
  discard: Card[];
  /** 現在手番のプレイヤー番号 */
  currentPlayer: number;
  /** そのゲームのワイルド（ヴィラの次のランク かつ ヴィラと同じスート）。 */
  wild: Wild;
  phase: Phase;
  /**
   * 上がったプレイヤー番号。
   * ラウンド進行中はnull。phase==="ROUND_OVER"かつnullなら決着なしの引き分け。
   */
  winner: number | null;
  /**
   * この手番で捨て札から拾ったカードのid（拾っていなければnull）。
   * そのまま捨て直すと手番が無為に流れて千日手になり得るため、DISCARDでは弾く。
   * 手番が移るときにクリアする。
   */
  takenFromDiscard: string | null;
  /** 捨て札から山札を組み直した回数。無限に続かないための安全弁に使う。 */
  recycles: number;
  /**
   * 場に表向きで置かれたヴィラ。一番手が買うと null になる。
   * 買われなければ最後まで場に残る（山札にも捨て札にも混ぜない）。
   */
  vira: Card | null;
  /**
   * 一番手が山札から引いて、採否を決めている最中の札。
   * AWAITING_KEEP_DECISION のときだけ入っている。
   */
  pendingCard: Card | null;
  /**
   * このラウンドを降りたプレイヤー。手番を飛ばす。
   * 降りるかどうかはラウンド開始前に決まるので、engineは結果だけ受け取る。
   */
  folded: boolean[];
}

/** ドロー元。捨て札から取れるのは一番上の1枚だけ（表向きなのはその1枚だけのため）。 */
export type DrawSource = "STOCK" | "DISCARD";

export type GameAction =
  | { type: "DRAW"; from?: DrawSource }
  /** 一番手だけの特権。場のヴィラを手札に入れる。 */
  | { type: "TAKE_VIRA" }
  /** 見せられている札を手札に入れる */
  | { type: "KEEP" }
  /** 見せられている札を手札に入れず捨て、山札から引き直す */
  | { type: "REJECT" }
  | { type: "DISCARD"; cardId: string }
  | { type: "BATER"; cardId?: string };

/**
 * 捨て札を山札に組み直せる回数の上限。
 * 実際のルールに上限は無いが、engineが必ず停止することを保証したいので安全弁を置く。
 * CPU同士で回した範囲では山札切れ自体が起きないため、通常は到達しない。
 */
const MAX_RECYCLES = 3;

export type GameActionResult =
  | { ok: true; state: GameState }
  | { ok: false; error: string };

/**
 * dealGame()の結果から、最初の手番のプレイヤーを指定してゲーム開始状態を作る。
 *
 * @param folded このラウンドを降りたプレイヤー。手番を飛ばす。
 *   指定した firstPlayer が降りていた場合は、次の降りていない者から始める。
 */
export function createInitialState(
  deal: DealResult,
  firstPlayer = 0,
  folded: boolean[] = deal.hands.map(() => false)
): GameState {
  const starter = folded[firstPlayer] ? nextPlayer(firstPlayer, folded) : firstPlayer;
  return {
    hands: deal.hands.map((hand) => [...hand]),
    stock: [...deal.stock],
    discard: [],
    currentPlayer: starter,
    wild: deal.wild,
    // 一番手の最初の手番だけ、ヴィラを買う／引いた札を選び直す特権がある
    phase: "AWAITING_FIRST_DRAW",
    winner: null,
    takenFromDiscard: null,
    recycles: 0,
    vira: deal.vira,
    pendingCard: null,
    folded: [...folded],
  };
}

/**
 * 現在の状態にアクションを適用し、次の状態を返す（純粋関数、引数の状態は変更しない）。
 * 手番違反・カード不在・上がり条件不成立などの不正な操作はok:falseで理由を返す。
 */
export function applyAction(state: GameState, action: GameAction): GameActionResult {
  switch (action.type) {
    case "DRAW":
      return applyDraw(state, action.from ?? "STOCK");
    case "TAKE_VIRA":
      return applyTakeVira(state);
    case "KEEP":
      return applyKeep(state);
    case "REJECT":
      return applyReject(state);
    case "DISCARD":
      return applyDiscard(state, action.cardId);
    case "BATER":
      return applyBater(state, action.cardId);
  }
}

/** 手札に1枚加えた hands を作る */
function handsWith(state: GameState, card: Card): Card[][] {
  return state.hands.map((hand, i) => (i === state.currentPlayer ? [...hand, card] : hand));
}

/**
 * 一番手の特権：場のヴィラを手札に入れる。
 * 買ったあとは通常どおり1枚捨てて手番を終える。
 */
function applyTakeVira(state: GameState): GameActionResult {
  if (state.phase !== "AWAITING_FIRST_DRAW") {
    return { ok: false, error: "ヴィラを買えるのは一番手の最初の手番だけです" };
  }
  if (state.vira === null) {
    return { ok: false, error: "ヴィラはもう場にありません" };
  }

  return {
    ok: true,
    state: {
      ...state,
      hands: handsWith(state, state.vira),
      vira: null,
      phase: "AWAITING_DISCARD",
    },
  };
}

/** 見せられている札を手札に入れる */
function applyKeep(state: GameState): GameActionResult {
  if (state.phase !== "AWAITING_KEEP_DECISION" || state.pendingCard === null) {
    return { ok: false, error: "いま採否を決める札はありません" };
  }

  return {
    ok: true,
    state: {
      ...state,
      hands: handsWith(state, state.pendingCard),
      pendingCard: null,
      phase: "AWAITING_DISCARD",
    },
  };
}

/**
 * 見せられている札を手札に入れずに捨て、山札から引き直す。
 * 引き直した札は無条件で手札に入る（選び直せるのは1回だけ）。
 */
function applyReject(state: GameState): GameActionResult {
  if (state.phase !== "AWAITING_KEEP_DECISION" || state.pendingCard === null) {
    return { ok: false, error: "いま採否を決める札はありません" };
  }

  const discard = [...state.discard, state.pendingCard];

  // 引き直そうとして山札が尽きているなら、捨てた札だけ確定させて捨てる場面へ進む。
  // 配りたての67枚では起こり得ないが、状態としては潰しておく。
  if (state.stock.length === 0) {
    return {
      ok: true,
      state: { ...state, discard, pendingCard: null, phase: "AWAITING_DISCARD" },
    };
  }

  const stock = [...state.stock];
  const drawn = stock.pop()!;

  return {
    ok: true,
    state: {
      ...state,
      hands: handsWith(state, drawn),
      stock,
      discard,
      pendingCard: null,
      phase: "AWAITING_DISCARD",
    },
  };
}

function applyDraw(state: GameState, from: DrawSource): GameActionResult {
  if (state.phase === "ROUND_OVER") {
    return { ok: false, error: "ラウンドは終了しています" };
  }

  // 一番手の最初の引きは、手札に入れる前に表向きで見せて採否を決めさせる
  if (state.phase === "AWAITING_FIRST_DRAW") {
    if (from === "DISCARD") {
      return { ok: false, error: "最初の手番にはまだ捨て札がありません" };
    }
    return revealFromStock(state);
  }

  if (state.phase !== "AWAITING_DRAW") {
    return { ok: false, error: "今はドローできません（先に捨て札が必要です）" };
  }

  return from === "DISCARD" ? drawFromDiscard(state) : drawFromStock(state);
}

/** 一番手の最初の引き。手札には入れず、まず表向きにして見せる。 */
function revealFromStock(state: GameState): GameActionResult {
  if (state.stock.length === 0) {
    return { ok: true, state: { ...state, phase: "ROUND_OVER", winner: null } };
  }

  const stock = [...state.stock];
  const drawn = stock.pop()!;

  return {
    ok: true,
    state: { ...state, stock, pendingCard: drawn, phase: "AWAITING_KEEP_DECISION" },
  };
}

/** 捨て札の一番上を拾う。表向きなのは最後の1枚だけなので、取れるのもその1枚だけ。 */
function drawFromDiscard(state: GameState): GameActionResult {
  if (state.discard.length === 0) {
    return { ok: false, error: "捨て札がありません" };
  }

  const discard = [...state.discard];
  const drawn = discard.pop()!;
  const hands = state.hands.map((hand, i) =>
    i === state.currentPlayer ? [...hand, drawn] : hand
  );

  return {
    ok: true,
    state: {
      ...state,
      hands,
      discard,
      phase: "AWAITING_DISCARD",
      takenFromDiscard: drawn.id,
    },
  };
}

function drawFromStock(state: GameState): GameActionResult {
  let { stock, discard, recycles } = {
    stock: state.stock,
    discard: state.discard,
    recycles: state.recycles,
  };

  // 山札が尽きたら捨て札をそのままの順で山札にする（シャッフルしない）。
  // 順序を保つので乱数が要らず、applyActionの純粋性を保ったまま実装できる。
  if (stock.length === 0) {
    if (discard.length === 0 || recycles >= MAX_RECYCLES) {
      return { ok: true, state: { ...state, phase: "ROUND_OVER", winner: null } };
    }
    // stockは末尾が「一番上」。最後に捨てた札を新しい山札の最後（＝最後に引かれる）に
    // したいので、捨て札を逆順にして積む。
    stock = [...discard].reverse();
    discard = [];
    recycles += 1;
  }

  const nextStock = [...stock];
  const drawn = nextStock.pop()!;
  const hands = state.hands.map((hand, i) =>
    i === state.currentPlayer ? [...hand, drawn] : hand
  );

  return {
    ok: true,
    state: {
      ...state,
      hands,
      stock: nextStock,
      discard,
      recycles,
      phase: "AWAITING_DISCARD",
      takenFromDiscard: null,
    },
  };
}

function applyDiscard(state: GameState, cardId: string): GameActionResult {
  if (state.phase === "ROUND_OVER") {
    return { ok: false, error: "ラウンドは終了しています" };
  }
  if (state.phase !== "AWAITING_DISCARD") {
    return { ok: false, error: "今は捨てられません（先にドローが必要です）" };
  }

  const hand = state.hands[state.currentPlayer]!;
  const cardIndex = hand.findIndex((c) => c.id === cardId);
  if (cardIndex === -1) {
    return { ok: false, error: "指定したカードは手札にありません" };
  }
  // 拾った札をそのまま戻すと、場が変わらないまま手番だけが流れる。
  // 出典に明記が無いため実装上の仮定として禁じている（rules.md参照）。
  if (cardId === state.takenFromDiscard) {
    return { ok: false, error: "いま拾った札は、この手番では捨てられません" };
  }

  const discardedCard = hand[cardIndex]!;
  const nextHand = [...hand.slice(0, cardIndex), ...hand.slice(cardIndex + 1)];
  const hands = state.hands.map((h, i) => (i === state.currentPlayer ? nextHand : h));
  const discard = [...state.discard, discardedCard];
  const currentPlayer = nextPlayer(state.currentPlayer, state.folded);

  return {
    ok: true,
    state: {
      ...state,
      hands,
      discard,
      currentPlayer,
      phase: "AWAITING_DRAW",
      takenFromDiscard: null,
    },
  };
}

function applyBater(state: GameState, cardId: string | undefined): GameActionResult {
  if (state.phase === "ROUND_OVER") {
    return { ok: false, error: "ラウンドは終了しています" };
  }
  if (state.phase !== "AWAITING_DISCARD") {
    return { ok: false, error: "上がり判定はドロー直後（10枚保持時）のみ行えます" };
  }

  const hand = state.hands[state.currentPlayer]!;

  if (cardId === undefined) {
    // 10枚すべてが役として成立する場合のみ、何も捨てずに上がれる（"bater com 10"）
    if (classifyAsMelds(hand, state.wild) === null) {
      return { ok: false, error: "10枚全てが役として成立していません" };
    }
    return {
      ok: true,
      state: { ...state, phase: "ROUND_OVER", winner: state.currentPlayer },
    };
  }

  const cardIndex = hand.findIndex((c) => c.id === cardId);
  if (cardIndex === -1) {
    return { ok: false, error: "指定したカードは手札にありません" };
  }

  // ここでは takenFromDiscard を弾かない。
  // DISCARDで禁じているのは「場が変わらないまま手番だけ流れる」のを防ぐためであって、
  // 上がりは手番を流す行為ではない。元の9枚が既に役として揃っていて、拾った札が
  // そのまま余る、という正当な上がり方を塞いでしまうので許可する。
  const remaining = [...hand.slice(0, cardIndex), ...hand.slice(cardIndex + 1)];
  if (classifyAsMelds(remaining, state.wild) === null) {
    return { ok: false, error: "残り9枚が役として成立していません" };
  }

  const discardedCard = hand[cardIndex]!;
  const hands = state.hands.map((h, i) => (i === state.currentPlayer ? remaining : h));
  const discard = [...state.discard, discardedCard];

  return {
    ok: true,
    state: { ...state, hands, discard, phase: "ROUND_OVER", winner: state.currentPlayer },
  };
}

/** 降りた者を飛ばして次の手番へ。全員降りていたら自分に戻る。 */
function nextPlayer(current: number, folded: boolean[]): number {
  const count = folded.length;
  for (let step = 1; step <= count; step++) {
    const candidate = (current + step) % count;
    if (!folded[candidate]) return candidate;
  }
  return current;
}
