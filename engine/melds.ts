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
 * トリンカ：同じランクの3枚または4枚。
 *
 * 枚数で条件が変わる（ユーザー指定）:
 * - **3枚組** … 記号は全て異なること（7♠7♥7♦）
 * - **4枚組** … 記号の重複が必要（7♠7♣7♥7♥）。
 *   7♠7♥7♦7♣ のように4種類すべて違う形は4枚組として認めない。
 *
 * 4枚組を作るには同じ札が2枚要るので、2組デッキであることが前提になる。
 * ワイルドは任意の札の代役なので、混じっていれば重複ぶんを担える。
 */
export function isValidTrinca(cards: Card[], wild: Wild): boolean {
  if (cards.length < 3 || cards.length > 4) return false;

  const naturals = cards.filter((c) => !isWildCard(c, wild));
  const wildCount = cards.length - naturals.length;

  // 仮定：全部ワイルドのトリンカは許容する（rules.md参照）。
  // ただしワイルドはヴィラと同スートの1種類＝2組デッキで2枚しかないため、
  // 3枚以上を全てワイルドで揃えることは実際には起こり得ない。
  if (naturals.length === 0) return true;

  const rank = naturals[0]!.rank;
  if (!naturals.every((c) => c.rank === rank)) return false;

  // 同じ札は2組デッキに2枚しかないので、同じ記号は2枚まで
  const perSuit = new Map<Suit, number>();
  for (const c of naturals) perSuit.set(c.suit, (perSuit.get(c.suit) ?? 0) + 1);
  for (const n of perSuit.values()) if (n > 2) return false;

  if (cards.length === 3) {
    // 3枚組は記号が全て異なること
    return perSuit.size === naturals.length;
  }

  // ここから4枚組。記号の重複が要る。
  // ワイルドが混じっていれば、それを重複ぶんに充てられるので成立する。
  if (wildCount > 0) return true;
  return perSuit.size < naturals.length;
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
