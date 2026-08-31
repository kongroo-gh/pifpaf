// Pif Paf ルールエンジン - CPU用の簡易AI（貪欲法）
// deck.ts / melds.ts / gameEngine.ts と同じく、副作用ゼロ・フレームワーク非依存。
//
// 方針は「役になりそうな札を残し、最も孤立した札を捨てる」だけの素朴なもの。
// 強さの調整（相手の捨て札を読む、ワイルドの温存判断など）は後のフェーズで行う。

import type { Card, Rank, Wild } from "./types";
import { RANK_ORDER, rankIndex, isWildCard } from "./types";
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
export function cardAffinity(card: Card, hand: Card[], wild: Wild): number {
  // ワイルドは何にでも化けるので絶対に捨てない
  if (isWildCard(card, wild)) return Number.POSITIVE_INFINITY;

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
 *
 * excludeId には「この手番で捨て札から拾った札」を渡す。engineがその札の
 * 捨て直しを弾くため、AIが選んでしまうと手が詰まる。
 */
export function chooseDiscard(
  hand: Card[],
  wild: Wild,
  excludeId: string | null = null
): Card | null {
  let best: Card | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const card of hand) {
    if (card.id === excludeId) continue;
    const score = cardAffinity(card, hand, wild);
    if (score < bestScore) {
      bestScore = score;
      best = card;
    }
  }
  return best;
}

/**
 * 捨て札の一番上を拾うべきか。拾わないなら山札から引く。
 *
 * 見えている1枚と山札の未知の1枚を比べることになるので、
 * 「確実に役に絡む」と言えるときだけ拾う、という消極的な判断にしている。
 */
export function shouldTakeDiscard(
  hand: Card[],
  topDiscard: Card | undefined,
  wild: Wild
): boolean {
  if (topDiscard === undefined) return false;

  // 拾えばそのまま上がれるなら迷う必要がない
  if (findBaterAction([...hand, topDiscard], wild) !== null) return true;

  // ワイルドは何にでも化けるので常に拾う
  if (isWildCard(topDiscard, wild)) return true;

  const prospective = [...hand, topDiscard];
  const gain = cardAffinity(topDiscard, prospective, wild);

  // 手札で最も孤立している札より明確に良く、かつ単独で役に絡んでいること。
  // 8 = 同スートの隣接1枚ぶん。これ未満なら山札を引いたほうがまし。
  const worst = Math.min(...hand.map((c) => cardAffinity(c, hand, wild)));
  return gain >= 8 && gain > worst;
}

/**
 * 今の手札で上がれるなら、その BATER アクションを返す（上がれなければ null）。
 * 10枚すべてが役なら捨てなしの上がり、9枚が役なら余り1枚を捨てての上がり。
 *
 * CPUだけでなく、人間側UIの「バテル」ボタンの活性判定にも使う。
 * ルール判定をweb側に持たせないための入口。
 */
export function findBaterAction(hand: Card[], wild: Wild): GameAction | null {
  // 捨てずに上がれるならそれが最良（bater com 10）
  if (classifyAsMelds(hand, wild) !== null) {
    return { type: "BATER" };
  }
  // 1枚捨てて9枚で上がれるか
  for (const card of hand) {
    const rest = hand.filter((c) => c.id !== card.id);
    if (classifyAsMelds(rest, wild) !== null) {
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

  const hand = state.hands[state.currentPlayer];
  if (hand === undefined) return null;

  if (state.phase === "AWAITING_DRAW") {
    const top = state.discard[state.discard.length - 1];
    const from = shouldTakeDiscard(hand, top, state.wild) ? "DISCARD" : "STOCK";
    return { type: "DRAW", from };
  }

  if (hand.length === 0) return null;

  const bater = findBaterAction(hand, state.wild);
  if (bater !== null) return bater;

  const discard = chooseDiscard(hand, state.wild, state.takenFromDiscard);
  if (discard === null) return null;
  return { type: "DISCARD", cardId: discard.id };
}
