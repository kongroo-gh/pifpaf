// 簡易動作確認スクリプト（Vitest導入前の手早い検証用）
import { Card, Rank } from "./types";
import { dealGame } from "./deck";
import { isValidTrinca, isValidSequence, classifyAsMelds } from "./melds";

function c(id: string, suit: Card["suit"], rank: Rank): Card {
  return { id, suit, rank };
}

const wildRank: Rank = "8"; // ヴィラが7のとき

// トリンカ: 7,7,7 異なるスート
console.log(
  "trinca 7x3 differing suits:",
  isValidTrinca([c("a", "S", "7"), c("b", "H", "7"), c("c", "D", "7")], wildRank) === true
);

// トリンカ: ワイルド(8)を1枚使って7,7,wild
console.log(
  "trinca 7,7,wild:",
  isValidTrinca([c("a", "S", "7"), c("b", "H", "7"), c("c", "D", "8")], wildRank) === true
);

// トリンカ: 同スート重複はNG
console.log(
  "trinca same suit twice should fail:",
  isValidTrinca([c("a", "S", "7"), c("b", "S", "7"), c("c", "D", "7")], wildRank) === false
);

// シーケンス: 5,6,7 同スート
console.log(
  "sequence 5-6-7 same suit:",
  isValidSequence([c("a", "S", "5"), c("b", "S", "6"), c("c", "S", "7")], wildRank) === true
);

// シーケンス: 5, wild, 7 (wildが6の代わり)
console.log(
  "sequence 5, wild(8 as 6-sub isn't valid, need wildRank card):",
  isValidSequence([c("a", "S", "5"), c("b", "S", "8"), c("c", "S", "7")], wildRank) === true
);

// シーケンス: Q-K-A またぎ
console.log(
  "sequence Q-K-A wraps:",
  isValidSequence([c("a", "H", "Q"), c("b", "H", "K"), c("c", "H", "A")], wildRank) === true
);

// 手札全体の役分類: 9枚が綺麗に3役に分かれるケース
const hand: Card[] = [
  c("1", "S", "5"), c("2", "S", "6"), c("3", "S", "7"),
  c("4", "H", "9"), c("5", "D", "9"), c("6", "C", "9"),
  c("7", "H", "J"), c("8", "H", "Q"), c("9", "H", "K"),
];
const classified = classifyAsMelds(hand, wildRank);
console.log("classifyAsMelds 9-card clean hand found melds:", classified !== null, classified?.length);

// dealGame の基本チェック（4人・9枚ずつ・ヴィラ1枚・残り山札）
const deal = dealGame(4, () => 0.42);
console.log(
  "dealGame hands=4x9, stock size correct:",
  deal.hands.length === 4 &&
    deal.hands.every((h) => h.length === 9) &&
    deal.stock.length === 104 - 4 * 9 - 1
);
console.log("vira:", deal.vira, "wildRank:", deal.wildRank);
