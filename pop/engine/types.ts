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

/**
 * シーケンス（階段）で使うランクの並び。**軸が2本ある。**
 *
 * A は一番上にも一番下にも使えるが、**A をまたぐことはできない**。
 * つまり Q-K-A も A-2-3 も成立するが、**K-A-2 は成立しない**。
 *
 * 1本の循環軸で判定すると、またぎ（K-A-2）まで通ってしまう。
 * かといって A を上だけに固定すると A-2-3 が落ちる。
 * そこで「折り返さない軸」を2本用意し、どちらかに収まるかで見る。
 *
 * RANK_ORDER とは別物である点に注意。あちらは循環で、
 * ヴィラの「次のランク」を決めるためだけに使う。
 */
export const SEQUENCE_AXES: Rank[][] = [
  // A を一番上として使う軸（…, Q, K, A）
  ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"],
  // A を一番下として使う軸（A, 2, 3, …）
  ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"],
];

/**
 * 手札の表示・整列に使う並び。A を上とみなす側の軸。
 *
 * 判定用ではなく見た目用。A は両端で使えるので1列には並べきれず、
 * どちらかに決め打つしかない（並べ替えは手で自由にできる）。
 */
export const SEQUENCE_ORDER: Rank[] = SEQUENCE_AXES[0]!;

/** SEQUENCE_ORDER 上の位置。2 が 0、A が 12。 */
export function sequenceIndex(rank: Rank): number {
  return SEQUENCE_ORDER.indexOf(rank);
}

/**
 * 階段の並びで見た2つのランクの距離。近いほうの軸で測る。
 *
 * A は両端で使えるので、A と 2 も K と A も隣どうし（距離1）。
 * ただし折り返しは無いので、2 と K は隣にならない（距離11）。
 */
export function sequenceDistance(a: Rank, b: Rank): number {
  let best = Number.POSITIVE_INFINITY;
  for (const axis of SEQUENCE_AXES) {
    best = Math.min(best, Math.abs(axis.indexOf(a) - axis.indexOf(b)));
  }
  return best;
}

export function rankIndex(rank: Rank): number {
  return RANK_ORDER.indexOf(rank);
}

/** ランクの循環上の「次」。K の次は A、A の次は 2。ヴィラ→ワイルド決定に使用。 */
export function nextRank(rank: Rank): Rank {
  const i = rankIndex(rank);
  // 剰余で必ず範囲内に収まるため undefined にはならない
  return RANK_ORDER[(i + 1) % RANK_ORDER.length]!;
}
