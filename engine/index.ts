// Pif Paf ルールエンジンの公開窓口。
// web/（将来はserver/）はこのバレル経由でのみengineを参照し、
// 個別ファイルへの直接importはしない。実装の置き場所を後から変えられるようにするため。

export type { Card, Suit, Rank } from "./types";
export { RANK_ORDER, rankIndex, nextRank } from "./types";

export type { DealResult } from "./deck";
export { createDoubleDeck, shuffle, dealGame } from "./deck";

export type { Meld, MeldType } from "./melds";
export { isValidTrinca, isValidSequence, classifyAsMelds } from "./melds";

export type { GameState, GameAction, GameActionResult, Phase } from "./gameEngine";
export { createInitialState, applyAction } from "./gameEngine";

export { cardAffinity, chooseDiscard, findBaterAction, decideAction } from "./ai";
