// 簡易動作確認スクリプト（npm install なしで素早く確かめたいとき用）
//   node --experimental-strip-types engine/sanity-check.ts
// 本番の検証は Vitest（npm test）が担当する。こちらは目視用。

import type { Card, Suit, Rank, Wild } from "./types";
import { dealGame } from "./deck";
import { isValidTrinca, isValidSequence, classifyAsMelds } from "./melds";

function c(id: string, suit: Suit, rank: Rank): Card {
  return { id, suit, rank };
}

// ヴィラが 7♠ のとき、ワイルドは 8♠ の1種類だけ（8♥8♦8♣ は普通の札）
const wild: Wild = { rank: "8", suit: "S" };

function check(label: string, actual: boolean, expected: boolean): void {
  console.log(`${actual === expected ? "ok  " : "FAIL"} ${label}`);
}

// --- ワイルドはスートまで一致したときだけ ---
check(
  "8♠ を代用にしたトリンカは成立",
  isValidTrinca([c("a", "S", "7"), c("b", "H", "7"), c("c", "S", "8")], wild),
  true
);
check(
  "8♥ は代用にならない（同ランクでもスートが違う）",
  isValidTrinca([c("a", "S", "7"), c("b", "H", "7"), c("c", "H", "8")], wild),
  false
);

// --- トリンカ ---
check(
  "同ランク異スート3枚",
  isValidTrinca([c("a", "S", "7"), c("b", "H", "7"), c("c", "D", "7")], wild),
  true
);
check(
  "同スート重複は不成立",
  isValidTrinca([c("a", "S", "7"), c("b", "S", "7"), c("c", "D", "7")], wild),
  false
);

// --- シーケンス ---
check(
  "同スート連番3枚",
  isValidSequence([c("a", "S", "5"), c("b", "S", "6"), c("c", "S", "7")], wild),
  true
);
check(
  "8♠ が 6♠ の代わりに入る",
  isValidSequence([c("a", "S", "5"), c("b", "S", "8"), c("c", "S", "7")], wild),
  true
);
check(
  "Q-K-A のまたぎ",
  isValidSequence([c("a", "H", "Q"), c("b", "H", "K"), c("c", "H", "A")], wild),
  true
);

// --- 手札全体の分類 ---
const hand: Card[] = [
  c("1", "S", "5"), c("2", "S", "6"), c("3", "S", "7"),
  c("4", "H", "9"), c("5", "D", "9"), c("6", "C", "9"),
  c("7", "H", "J"), c("8", "H", "Q"), c("9", "H", "K"),
];
const classified = classifyAsMelds(hand, wild);
check("9枚が3役に分類できる", classified !== null && classified.length === 3, true);

// --- 配札 ---
const deal = dealGame(4, () => 0.42);
check(
  "4人 x 9枚、山札は 104 - 36 - 1",
  deal.hands.length === 4 &&
    deal.hands.every((h) => h.length === 9) &&
    deal.stock.length === 104 - 4 * 9 - 1,
  true
);
check("ワイルドのスートはヴィラと同じ", deal.wild.suit === deal.vira.suit, true);
console.log("vira:", deal.vira, "wild:", deal.wild);
