// Pif Paf ルールエンジンの公開窓口。
// web/（将来はserver/）はこのバレル経由でのみengineを参照し、
// 個別ファイルへの直接importはしない。実装の置き場所を後から変えられるようにするため。

export type { Card, Suit, Rank, Wild } from "./types";
export { RANK_ORDER, SEQUENCE_ORDER, rankIndex, sequenceIndex, nextRank, isWildCard } from "./types";

export type { DealResult } from "./deck";
export { createDoubleDeck, shuffle, dealGame } from "./deck";

export type { Meld, MeldType } from "./melds";
export { isValidTrinca, isValidSequence, classifyAsMelds } from "./melds";

export type { GameState, GameAction, GameActionResult, Phase, DrawSource } from "./gameEngine";
export { createInitialState, applyAction, currentActor, findInterceptors } from "./gameEngine";

export {
  cardAffinity,
  chooseDiscard,
  isCardWorthTaking,
  shouldTakeDiscard,
  handStrength,
  shouldFold,
  findBaterAction,
  decideAction,
} from "./ai";

export type { MatchState, RoundResult, RoundSettlement } from "./match";
export {
  createMatch,
  settleRound,
  alivePlayers,
  isAlive,
  payoutMultiplier,
  payoutBreakdown,
  DEFAULT_CHIPS,
  LOSS_PLAY,
  LOSS_FOLD,
  LOSS_COM10,
} from "./match";
