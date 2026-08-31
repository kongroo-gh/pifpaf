// Pif Paf ルールエンジン - 基本型定義
// このファイルはUI/通信/フレームワークに一切依存しない純粋なドメイン型です。

export type Suit = "S" | "H" | "D" | "C"; // Spade, Heart, Diamond, Club

export type Rank =
  | "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10"
  | "J" | "Q" | "K";

export interface Card {
  /** デッキ内で一意なID（同ランク同スートが2枚あるため、区別用にdeck番号を含む） */
  id: string;
  suit: Suit;
  rank: Rank;
}

/**
 * そのゲームのワイルド札。
 * ヴィラの「次のランク」かつ「ヴィラと同じスート」の1種類だけがワイルドになる。
 * 例：ヴィラが 7♠ なら 8♠ だけがワイルドで、8♥8♦8♣ は普通の札。
 *
 * ランクとスートを別々の引数で持ち回るとどちらも文字列型で取り違えやすいので、
 * 1つの型にまとめて渡す。
 */
export interface Wild {
  rank: Rank;
  suit: Suit;
}

/** そのカードがワイルドか。ランクとスートの両方が一致したときだけ真。 */
export function isWildCard(card: Card, wild: Wild): boolean {
  return card.rank === wild.rank && card.suit === wild.suit;
}

export const RANK_ORDER: Rank[] = [
  "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K",
];

export function rankIndex(rank: Rank): number {
  return RANK_ORDER.indexOf(rank);
}

/** ランクの循環上の「次」。K の次は A、A の次は 2。ヴィラ→ワイルド決定に使用。 */
export function nextRank(rank: Rank): Rank {
  const i = rankIndex(rank);
  // 剰余で必ず範囲内に収まるため undefined にはならない
  return RANK_ORDER[(i + 1) % RANK_ORDER.length]!;
}
