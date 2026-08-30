// Pif Paf ルールエンジン - CPU用の簡易AI（貪欲法）
// deck.ts / melds.ts / gameEngine.ts と同じく、副作用ゼロ・フレームワーク非依存。
//
// 方針は「役になりそうな札を残し、最も孤立した札を捨てる」だけの素朴なもの。
// 強さの調整（相手の捨て札を読む、ワイルドの温存判断など）は後のフェーズで行う。

import type { Card, Rank } from "./types";
import { RANK_ORDER, rankIndex } from "./types";
import { classifyAsMelds } from "./melds";
import type { GameState, GameAction } from "./gameEngine";

/** 循環ランク上の距離。A-K間は1として扱う（K-A-2のまたぎがあるため） */
function circularRankDistance(a: Rank, b: Rank): number {
  const raw = Math.abs(rankIndex(a) - rankIndex(b));
  return Math.min(raw, RANK_ORDER.length - raw);
}

/**
 * 1枚のカードが「手札の中でどれだけ役に絡んでいるか」を点数化する。
 * 値が小さいほど孤立していて、捨てる候補になる。
 */
export function cardAffinity(card: Card, hand: Card[], wildRank: Rank): number {
  // ワイルドは何にでも化けるので絶対に捨てない
  if (card.rank === wildRank) return Number.POSITIVE_INFINITY;

  const others = hand.filter((c) => c.id !== card.id);
  let score = 0;

  // トリンカ候補：同ランクで異なるスートの相方が何種類いるか
  const mateSuits = new Set(
    others.filter((c) => c.rank === card.rank && c.suit !== card.suit).map((c) => c.suit)
  );
  score += mateSuits.size * 10;

  // シーケンス候補：同スートでランクが近い札
  for (const other of others) {
    if (other.suit !== card.suit) continue;
    const distance = circularRankDistance(card.rank, other.rank);
    if (distance === 1) score += 8; // 隣接（5-6）
    else if (distance === 2) score += 4; // 1つ飛び（5-7。ワイルドや引きで繋がる）
  }

  return score;
}

/**
 * 捨てるべき1枚を選ぶ。最も孤立した（affinityが最小の）カードを返す。
 * 同点の場合は手札の並び順で先に来たものを選び、挙動を決定的に保つ。
 */
export function chooseDiscard(hand: Card[], wildRank: Rank): Card | null {
  let best: Card | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const card of hand) {
    const score = cardAffinity(card, hand, wildRank);
    if (score < bestScore) {
      bestScore = score;
      best = card;
    }
  }
  return best;
}

/**
 * 今の手札で上がれるなら、その BATER アクションを返す（上がれなければ null）。
 * 10枚すべてが役なら捨てなしの上がり、9枚が役なら余り1枚を捨てての上がり。
 *
 * CPUだけでなく、人間側UIの「バテル」ボタンの活性判定にも使う。
 * ルール判定をweb側に持たせないための入口。
 */
export function findBaterAction(hand: Card[], wildRank: Rank): GameAction | null {
  // 捨てずに上がれるならそれが最良（bater com 10）
  if (classifyAsMelds(hand, wildRank) !== null) {
    return { type: "BATER" };
  }
  // 1枚捨てて9枚で上がれるか
  for (const card of hand) {
    const rest = hand.filter((c) => c.id !== card.id);
    if (classifyAsMelds(rest, wildRank) !== null) {
      return { type: "BATER", cardId: card.id };
    }
  }
  return null;
}

/**
 * 現在手番のプレイヤーが取るべき手を1つ返す。ラウンド終了後は null。
 * 呼び出し側（web/server）はこれを applyAction に渡すだけでよい。
 */
export function decideAction(state: GameState): GameAction | null {
  if (state.phase === "ROUND_OVER") return null;
  if (state.phase === "AWAITING_DRAW") return { type: "DRAW" };

  const hand = state.hands[state.currentPlayer];
  if (hand === undefined || hand.length === 0) return null;

  const bater = findBaterAction(hand, state.wildRank);
  if (bater !== null) return bater;

  const discard = chooseDiscard(hand, state.wildRank);
  if (discard === null) return null;
  return { type: "DISCARD", cardId: discard.id };
}
