// Pif Paf ルールエンジン - デッキ生成 / シャッフル / 配札

import type { Card, Suit, Wild } from "./types.ts";
import { RANK_ORDER, nextRank } from "./types.ts";

const SUITS: Suit[] = ["S", "H", "D", "C"];
const CARDS_PER_PLAYER = 9;

/** ジョーカーなし52枚 x 2組 = 104枚のダブルデッキを生成する */
export function createDoubleDeck(): Card[] {
  const cards: Card[] = [];
  for (let deckNo = 1; deckNo <= 2; deckNo++) {
    for (const suit of SUITS) {
      for (const rank of RANK_ORDER) {
        cards.push({ id: `${suit}-${rank}-d${deckNo}`, suit, rank });
      }
    }
  }
  return cards;
}

/**
 * Fisher-Yatesシャッフル。
 * rngを外部から注入できるようにしているのは、後で「サーバー側で決定的に検証したい」
 * 「テストで再現したい」というニーズに対応するため。
 */
export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

export interface DealResult {
  /** hands[playerIndex] = そのプレイヤーの手札9枚 */
  hands: Card[][];
  /** 場に表向きで置かれたヴィラカード */
  vira: Card;
  /** ヴィラの次のランク かつ ヴィラと同じスート。この1種類だけがワイルド。 */
  wild: Wild;
  /** 残りの伏せ山札 */
  stock: Card[];
}

/**
 * 4人固定でのゲーム開始処理。
 * 1. シャッフル
 * 2. 時計回りに1枚ずつ、各プレイヤーに9枚配布
 * 3. 次の1枚をヴィラとして表向きに公開し、ワイルドを決定
 *    （ヴィラの次のランク かつ ヴィラと同じスートの1種類だけ）
 * 4. 残りを山札とする
 */
export function dealGame(playerCount: number, rng: () => number = Math.random): DealResult {
  const deck = shuffle(createDoubleDeck(), rng);
  const hands: Card[][] = Array.from({ length: playerCount }, () => []);

  let cursor = 0;
  for (let round = 0; round < CARDS_PER_PLAYER; round++) {
    for (let p = 0; p < playerCount; p++) {
      hands[p]!.push(deck[cursor++]!);
    }
  }

  const vira = deck[cursor++]!;
  const wild: Wild = { rank: nextRank(vira.rank), suit: vira.suit };
  const stock = deck.slice(cursor);

  return { hands, vira, wild, stock };
}
