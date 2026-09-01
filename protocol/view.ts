// 各プレイヤーに見せてよい状態（マスク済みの盤面）。
//
// **これがオンライン化の肝**。engine の `GameState` は全員の手札を持っているので、
// そのまま配るとカードゲームとして成立しない。サーバーは席ごとに削ってから配る。
//
// 「削り忘れ」を型で防ぐため、`PublicGameState` は `GameState` を拡張せず**別の型**に
// してある。共通の親から派生させると、後から engine に伏せ札を足したときに
// 黙って漏れる。ここに書いていないものは配られない、という関係を保つ。

import type { Card, Wild, Phase, MatchState } from "@pifpaf/engine";

/** 相手の席について、見えてよい情報だけ。 */
export interface SeatView {
  seat: number;
  /** 手札の枚数。中身は見せない */
  handCount: number;
  /** 残りチップ */
  chips: number;
  /** このラウンドを降りたか */
  folded: boolean;
  /** 脱落したか（チップ0） */
  out: boolean;
}

/** 1人のプレイヤーから見た盤面。 */
export interface PublicGameState {
  /** 自分の手札。**自分のぶんだけ** */
  hand: Card[];
  /** 全員ぶんの見えてよい情報。添字は席番号 */
  seats: SeatView[];

  /** 山札の残り枚数。中身は見せない */
  stockCount: number;
  /** 捨て札の枚数 */
  discardCount: number;
  /** 捨て札の一番上。表向きなのはこの1枚だけ */
  topDiscard: Card | null;

  currentPlayer: number;
  /** いま行動する番の席。割り込み中は currentPlayer と異なる */
  actor: number;
  wild: Wild;
  phase: Phase;
  winner: number | null;
  takenFromDiscard: string | null;
  vira: Card | null;

  /**
   * 一番手が採否を決めている札。**その本人にだけ入る**。
   * 他人に見せると、断られた札が何だったか分かってしまう。
   */
  pendingCard: Card | null;

  /** 割り込みの待ち行列。誰に権利があるかは全員に見えてよい */
  interceptQueue: number[];

  /**
   * ラウンドが終わったときだけ、勝者の手札を入れる。
   * 進行中は null。UI がここから役を分類して見せる。
   */
  revealedHand: { seat: number; cards: Card[] } | null;
}

/** クライアントが受け取る一式。 */
export interface PlayerView {
  /** 自分の席番号 */
  you: number;
  game: PublicGameState;
  match: MatchState;
}
