// Pif Paf ルールエンジン - 役（メルド）判定
// トリンカ（組札）とシーケンス（階段）の判定を、ヴィラによるワイルドカードを
// 考慮した上で行う。UIやゲーム進行から独立した純粋関数群。

import type { Card, Rank, Suit, Wild } from "./types";
import { RANK_ORDER, isWildCard } from "./types";

export type MeldType = "TRINCA" | "SEQUENCE";

export interface Meld {
  type: MeldType;
  cards: Card[];
}

/**
 * トリンカ：同じランクの3〜5枚。
 *
 * **重複すべき記号の数 = 枚数 − 3**（ユーザー指定）。
 *
 * | 枚数 | 記号の条件 | 例 |
 * |---|---|---|
 * | 3枚 | 全て異なる | 7♠7♥7♦ ○ ／ 7♠7♠7♥ ✕ |
 * | 4枚 | 1つ重複 | 7♠7♣7♥7♥ ○ ／ 7♠7♥7♦7♣ ✕ |
 * | 5枚 | 2つ重複 | 7♠7♠7♣7♣7♥ ○ ／ 7♠7♠7♣7♥7♦ ✕ |
 *
 * 6枚組は無い。同ランク6枚は3枚組が2つになる（classifyAsMelds が
 * 小さい役から順に試すので自然にそう割れる）。
 *
 * 同じ記号は2枚まで（2組デッキに同じ札は2枚しかない）。
 * ワイルドは任意の札の代役なので、記号の割り当てを総当たりして
 * 条件を満たせる組み合わせがあるかを見る。
 */
export function isValidTrinca(cards: Card[], wild: Wild): boolean {
  if (cards.length < 3 || cards.length > 5) return false;

  const naturals = cards.filter((c) => !isWildCard(c, wild));
  const wildCount = cards.length - naturals.length;

  // 仮定：全部ワイルドのトリンカは許容する（rules.md参照）。
  // ただしワイルドはヴィラと同スートの1種類＝2組デッキで2枚しかないため、
  // 3枚以上を全てワイルドで揃えることは実際には起こり得ない。
  if (naturals.length === 0) return true;

  const rank = naturals[0]!.rank;
  if (!naturals.every((c) => c.rank === rank)) return false;

  return suitsSatisfyTrinca(naturals.map((c) => c.suit), wildCount, cards.length);
}

const ALL_SUITS: Suit[] = ["S", "H", "D", "C"];

/**
 * 記号の配り方が枚数別の条件を満たせるか。
 * ワイルドの記号は自由に決められるので、割り当てを総当たりする
 * （ワイルドは高々2枚なので探索は小さい）。
 */
function suitsSatisfyTrinca(naturalSuits: Suit[], wildCount: number, size: number): boolean {
  const base = new Map<Suit, number>();
  for (const s of naturalSuits) base.set(s, (base.get(s) ?? 0) + 1);
  // 同じ札は2枚までしか存在しない
  for (const n of base.values()) if (n > 2) return false;

  const ok = (counts: Map<Suit, number>): boolean => {
    const distinct = counts.size;
    const dups = [...counts.values()].filter((n) => n >= 2).length;
    // 3枚組だけは「重複ゼロ」＝全て異なることを要求する
    if (size === 3) return distinct === size;
    return dups >= size - 3;
  };

  const place = (remaining: number, counts: Map<Suit, number>): boolean => {
    if (remaining === 0) return ok(counts);
    for (const s of ALL_SUITS) {
      const have = counts.get(s) ?? 0;
      if (have >= 2) continue;
      const next = new Map(counts);
      next.set(s, have + 1);
      if (place(remaining - 1, next)) return true;
    }
    return false;
  };

  return place(wildCount, base);
}

/**
 * シーケンス：同じスートの連続ランク3枚以上。ランク重複不可。
 * Q-K-A、K-A-2 のまたぎも許可。ワイルドは任意ランク代わりとして使える。
 */
export function isValidSequence(cards: Card[], wild: Wild): boolean {
  if (cards.length < 3) return false;

  const naturals = cards.filter((c) => !isWildCard(c, wild));
  const wildCount = cards.length - naturals.length;

  // 仮定：全部ワイルドのシーケンスは不許可（rules.md参照）
  if (naturals.length === 0) return false;

  const suit = naturals[0]!.suit;
  if (!naturals.every((c) => c.suit === suit)) return false;

  const rankSet = new Set(naturals.map((c) => c.rank));
  if (rankSet.size !== naturals.length) return false; // ランク重複不可

  return canFitInSomeRun(naturals.map((c) => c.rank), cards.length, wildCount);
}

/**
 * 自然カードのランク群が、長さtotalLenの「あり得る連続ランク列」のどれかに
 * 過不足なく収まるかを判定する。
 *
 * ポイント：cards.length（=totalLen）は naturals.length + wildCount と常に一致するため、
 * 「naturalsが全員totalLen長の窓に収まる窓が1つでも存在する」ことだけを確認すればよい
 * （収まれば、残りの空き枠は自動的にちょうどwildCount枚のワイルドで埋まる）。
 */
function canFitInSomeRun(naturalRanks: Rank[], totalLen: number, _wildCount: number): boolean {
  const windows = buildRankWindows(totalLen);
  for (const window of windows) {
    const windowSet = new Set(window);
    if (naturalRanks.every((r) => windowSet.has(r))) {
      return true;
    }
  }
  return false;
}

/**
 * 長さlenの「あり得る連続ランク列」を全列挙する。
 * 通常の A-2-3-... に加え、K-A、K-A-2 のような循環またぎにも対応するため、
 * 末尾に "A","2" を継ぎ足した拡張ランク軸からスライドウィンドウを取る。
 * （len <= 13 の間はこの拡張軸内で同じランクが2回登場する窓は発生しない）
 */
function buildRankWindows(len: number): Rank[][] {
  const extended: Rank[] = [...RANK_ORDER, "A", "2"];
  const windows: Rank[][] = [];
  for (let start = 0; start + len <= extended.length; start++) {
    windows.push(extended.slice(start, start + len));
  }
  return windows;
}

/** 手札全体が指定のワイルドのもとで「全て役に分類できるか」を検証するヘルパー。 */
export function classifyAsMelds(cards: Card[], wild: Wild): Meld[] | null {
  // シンプルな全探索。9〜10枚程度の手札を想定しており、実用上十分な速度で動く。
  if (cards.length === 0) return [];

  for (let size = 3; size <= cards.length; size++) {
    const combos = combinations(cards, size);
    for (const combo of combos) {
      const rest = cards.filter((c) => !combo.includes(c));
      if (isValidTrinca(combo, wild)) {
        const restResult = classifyAsMelds(rest, wild);
        if (restResult !== null) return [{ type: "TRINCA", cards: combo }, ...restResult];
      }
      if (isValidSequence(combo, wild)) {
        const restResult = classifyAsMelds(rest, wild);
        if (restResult !== null) return [{ type: "SEQUENCE", cards: combo }, ...restResult];
      }
    }
  }
  return null;
}

function combinations<T>(arr: T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (arr.length < size) return [];
  const first = arr[0]!;
  const rest = arr.slice(1);
  const withFirst = combinations(rest, size - 1).map((c) => [first, ...c]);
  const withoutFirst = combinations(rest, size);
  return [...withFirst, ...withoutFirst];
}
