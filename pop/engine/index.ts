// Pif Paf ルールエンジンの公開窓口。
// web/（将来はserver/）はこのバレル経由でのみengineを参照し、
// 個別ファイルへの直接importはしない。実装の置き場所を後から変えられるようにするため。

export type { Card, Suit, Rank, Wild } from "./types.ts";
export {
  RANK_ORDER,
  SEQUENCE_ORDER,
  SEQUENCE_AXES,
  rankIndex,
  sequenceIndex,
  sequenceDistance,
  nextRank,
  isWildCard,
} from "./types.ts";

export type { DealResult } from "./deck.ts";
export { createDoubleDeck, shuffle, dealGame } from "./deck.ts";

export type { Meld, MeldType } from "./melds.ts";
export { isValidTrinca, isValidSequence, classifyAsMelds } from "./melds.ts";

export type { GameState, GameAction, GameActionResult, Phase, DrawSource } from "./gameEngine.ts";
export { createInitialState, applyAction, currentActor, findInterceptors } from "./gameEngine.ts";

export {
  cardAffinity,
  chooseDiscard,
  isCardWorthTaking,
  shouldTakeDiscard,
  handStrength,
  shouldFold,
  findBaterAction,
  decideAction,
} from "./ai.ts";

export type { MatchState, RoundResult, RoundSettlement } from "./match.ts";
export {
  createMatch,
  settleRound,
  alivePlayers,
  contenders,
  walkoverWinner,
  isAlive,
  payoutMultiplier,
  payoutBreakdown,
  DEFAULT_CHIPS,
  LOSS_PLAY,
  LOSS_FOLD,
  LOSS_COM10,
} from "./match.ts";
