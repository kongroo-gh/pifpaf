// Pif Paf ルールエンジン - ターンの状態遷移（reducerスタイル）
// deck.ts / melds.ts と同じ方針で、副作用なし・DOM/React/通信に非依存の純粋関数のみで構成する。

import type { Card, Rank } from "./types";
import type { DealResult } from "./deck";
import { classifyAsMelds } from "./melds";

export type Phase = "AWAITING_DRAW" | "AWAITING_DISCARD" | "ROUND_OVER";

export interface GameState {
  /** hands[playerIndex] = そのプレイヤーの手札 */
  hands: Card[][];
  /** 伏せ山札。末尾を「山の一番上」として扱う（pop/pushでO(1)にするため） */
  stock: Card[];
  /** 捨て札置き場。末尾が最新（一番上）の捨て札 */
  discard: Card[];
  /** 現在手番のプレイヤー番号 */
  currentPlayer: number;
  /** ヴィラの次のランク＝全スート共通のワイルドランク */
  wildRank: Rank;
  phase: Phase;
  /**
   * 上がったプレイヤー番号。
   * ラウンド進行中はnull。phase==="ROUND_OVER"かつnullなら山札切れの引き分け。
   */
  winner: number | null;
}

export type GameAction =
  | { type: "DRAW" }
  | { type: "DISCARD"; cardId: string }
  | { type: "BATER"; cardId?: string };

export type GameActionResult =
  | { ok: true; state: GameState }
  | { ok: false; error: string };

/** dealGame()の結果から、最初の手番のプレイヤーを指定してゲーム開始状態を作る */
export function createInitialState(deal: DealResult, firstPlayer = 0): GameState {
  return {
    hands: deal.hands.map((hand) => [...hand]),
    stock: [...deal.stock],
    discard: [],
    currentPlayer: firstPlayer,
    wildRank: deal.wildRank,
    phase: "AWAITING_DRAW",
    winner: null,
  };
}

/**
 * 現在の状態にアクションを適用し、次の状態を返す（純粋関数、引数の状態は変更しない）。
 * 手番違反・カード不在・上がり条件不成立などの不正な操作はok:falseで理由を返す。
 */
export function applyAction(state: GameState, action: GameAction): GameActionResult {
  switch (action.type) {
    case "DRAW":
      return applyDraw(state);
    case "DISCARD":
      return applyDiscard(state, action.cardId);
    case "BATER":
      return applyBater(state, action.cardId);
  }
}

function applyDraw(state: GameState): GameActionResult {
  if (state.phase === "ROUND_OVER") {
    return { ok: false, error: "ラウンドは終了しています" };
  }
  if (state.phase !== "AWAITING_DRAW") {
    return { ok: false, error: "今はドローできません（先に捨て札が必要です）" };
  }
  // 仮定：山札が尽きたらラウンドは勝者なしで終了する（rules.md参照）。
  // 捨て札を切り直して続行する流用ルールもあるが、シャッフルには乱数が要り
  // applyActionの純粋性が崩れるため、まずは引き分けとして扱う。
  if (state.stock.length === 0) {
    return {
      ok: true,
      state: { ...state, phase: "ROUND_OVER", winner: null },
    };
  }

  const stock = [...state.stock];
  const drawn = stock.pop()!;
  const hands = state.hands.map((hand, i) =>
    i === state.currentPlayer ? [...hand, drawn] : hand
  );

  return {
    ok: true,
    state: { ...state, hands, stock, phase: "AWAITING_DISCARD" },
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

  const discardedCard = hand[cardIndex]!;
  const nextHand = [...hand.slice(0, cardIndex), ...hand.slice(cardIndex + 1)];
  const hands = state.hands.map((h, i) => (i === state.currentPlayer ? nextHand : h));
  const discard = [...state.discard, discardedCard];
  const currentPlayer = nextPlayer(state.currentPlayer, state.hands.length);

  return {
    ok: true,
    state: { ...state, hands, discard, currentPlayer, phase: "AWAITING_DRAW" },
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
    if (classifyAsMelds(hand, state.wildRank) === null) {
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

  const remaining = [...hand.slice(0, cardIndex), ...hand.slice(cardIndex + 1)];
  if (classifyAsMelds(remaining, state.wildRank) === null) {
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

function nextPlayer(current: number, playerCount: number): number {
  return (current + 1) % playerCount;
}
