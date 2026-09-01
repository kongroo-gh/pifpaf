// Pif Paf ルールエンジン - CPU用の簡易AI（貪欲法）
// deck.ts / melds.ts / gameEngine.ts と同じく、副作用ゼロ・フレームワーク非依存。
//
// 方針は「役になりそうな札を残し、最も孤立した札を捨てる」だけの素朴なもの。
// 強さの調整（相手の捨て札を読む、ワイルドの温存判断など）は後のフェーズで行う。

import type { Card, Rank, Wild } from "./types";
import { sequenceDistance, isWildCard } from "./types";
import { classifyAsMelds } from "./melds";
import type { GameState, GameAction } from "./gameEngine";

/**
 * 階段の並びでの距離。types.ts の判定と同じ軸で測る。
 * A は両端で使えるので A-2 も K-A も隣。折り返しは無いので 2 と K は遠い。
 */
function rankDistance(a: Rank, b: Rank): number {
  return sequenceDistance(a, b);
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
    const distance = rankDistance(card.rank, other.rank);
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
 * 表向きで見えている1枚を、手札に入れる価値があるか。
 *
 * 比較対象は「山札から引く未知の1枚」なので、
 * 「確実に役に絡む」と言えるときだけ取る、という消極的な判断にしている。
 *
 * 捨て札を拾うか・ヴィラを買うか・引いた札を採るか、いずれも
 * 「見えている1枚を取るか否か」で同じ形なので、判断はここに集約する。
 */
export function isCardWorthTaking(hand: Card[], card: Card | undefined, wild: Wild): boolean {
  if (card === undefined) return false;

  // 取ればそのまま上がれるなら迷う必要がない
  if (findBaterAction([...hand, card], wild) !== null) return true;

  // ワイルドは何にでも化けるので常に取る
  if (isWildCard(card, wild)) return true;

  const gain = cardAffinity(card, [...hand, card], wild);

  // 手札で最も孤立している札より明確に良く、かつ単独で役に絡んでいること。
  // 8 = 同スートの隣接1枚ぶん。これ未満なら山札を引いたほうがまし。
  const worst = Math.min(...hand.map((c) => cardAffinity(c, hand, wild)));
  return gain >= 8 && gain > worst;
}

/**
 * 手札の「役への絡み具合」を枚数で測る。
 * 8 は同スート隣接1枚ぶんの点なので、これ以上ある札を「使える札」とみなす。
 */
export function handStrength(hand: Card[], wild: Wild): number {
  return hand.filter((c) => cardAffinity(c, hand, wild) >= 8).length;
}

/**
 * ラウンド開始時に降りるべきか（Cachetãoの fold）。
 * 降りれば失点は軽いが勝つ権利を失うので、勝ち目が薄いときだけ降りる。
 *
 * しきい値5は、9枚のうち5枚も噛み合っていない手を「見込み薄」とする線。
 * 手の強さの中央値がちょうど5なので、下位およそ3割が降りになる。
 * 下げると降りが減って fold の意味が薄れ、上げると降りすぎてマッチが延びる。
 */
export function shouldFold(hand: Card[], wild: Wild): boolean {
  // ワイルドを持っているなら勝負する価値がある
  if (hand.some((c) => isWildCard(c, wild))) return false;
  return handStrength(hand, wild) < 5;
}

/** 捨て札の一番上を拾うべきか。拾わないなら山札から引く。 */
export function shouldTakeDiscard(
  hand: Card[],
  topDiscard: Card | undefined,
  wild: Wild
): boolean {
  return isCardWorthTaking(hand, topDiscard, wild);
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

  // 捨て札への割り込み。上がれるなら拾わない理由がないので必ず拾う。
  // 判断するのは手番の持ち主ではなく、割り込みの順番が回ってきた人。
  if (state.phase === "AWAITING_INTERCEPT") {
    return { type: "INTERCEPT" };
  }

  const hand = state.hands[state.currentPlayer];
  if (hand === undefined) return null;

  // 一番手の最初の手番：ヴィラが使えるなら買う。使えないなら山札から引いて見る。
  if (state.phase === "AWAITING_FIRST_DRAW") {
    if (isCardWorthTaking(hand, state.vira ?? undefined, state.wild)) {
      return { type: "TAKE_VIRA" };
    }
    return { type: "DRAW", from: "STOCK" };
  }

  // 引いた札を見て採否を決める。要らなければ捨てて引き直す。
  if (state.phase === "AWAITING_KEEP_DECISION") {
    return isCardWorthTaking(hand, state.pendingCard ?? undefined, state.wild)
      ? { type: "KEEP" }
      : { type: "REJECT" };
  }

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
