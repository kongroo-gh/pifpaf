import { describe, it, expect } from "vitest";
import { Card, Rank } from "./types";
import { isValidTrinca, isValidSequence, classifyAsMelds } from "./melds";

const c = (id: string, suit: Card["suit"], rank: Rank): Card => ({ id, suit, rank });
const wildRank: Rank = "8"; // ヴィラが7のとき

describe("isValidTrinca", () => {
  it("同ランク異スート3枚は成立する", () => {
    expect(isValidTrinca([c("a", "S", "7"), c("b", "H", "7"), c("c", "D", "7")], wildRank)).toBe(true);
  });

  it("ワイルドを1枚含んでも成立する", () => {
    expect(isValidTrinca([c("a", "S", "7"), c("b", "H", "7"), c("c", "D", "8")], wildRank)).toBe(true);
  });

  it("同スート重複は不成立", () => {
    expect(isValidTrinca([c("a", "S", "7"), c("b", "S", "7"), c("c", "D", "7")], wildRank)).toBe(false);
  });

  it("5枚以上（5スート分）は不成立", () => {
    expect(
      isValidTrinca(
        [c("a", "S", "7"), c("b", "H", "7"), c("c", "D", "7"), c("d", "C", "7"), c("e", "S", "8")],
        wildRank
      )
    ).toBe(false);
  });
});

describe("isValidSequence", () => {
  it("同スート連番3枚は成立する", () => {
    expect(isValidSequence([c("a", "S", "5"), c("b", "S", "6"), c("c", "S", "7")], wildRank)).toBe(true);
  });

  it("ワイルドで間を埋めても成立する", () => {
    expect(isValidSequence([c("a", "S", "5"), c("b", "S", "8"), c("c", "S", "7")], wildRank)).toBe(true);
  });

  it("Q-K-A のまたぎは成立する", () => {
    expect(isValidSequence([c("a", "H", "Q"), c("b", "H", "K"), c("c", "H", "A")], wildRank)).toBe(true);
  });

  it("K-A-2 のまたぎは成立する", () => {
    expect(isValidSequence([c("a", "H", "K"), c("b", "H", "A"), c("c", "H", "2")], wildRank)).toBe(true);
  });

  it("異なるスートは不成立", () => {
    expect(isValidSequence([c("a", "S", "5"), c("b", "H", "6"), c("c", "S", "7")], wildRank)).toBe(false);
  });
});

describe("classifyAsMelds", () => {
  it("9枚が綺麗に3役へ分類できるケースを検出できる", () => {
    const hand: Card[] = [
      c("1", "S", "5"), c("2", "S", "6"), c("3", "S", "7"),
      c("4", "H", "9"), c("5", "D", "9"), c("6", "C", "9"),
      c("7", "H", "J"), c("8", "H", "Q"), c("9", "H", "K"),
    ];
    const result = classifyAsMelds(hand, wildRank);
    expect(result).not.toBeNull();
    expect(result?.length).toBe(3);
  });

  it("役に分類しきれない手札はnullを返す", () => {
    const hand: Card[] = [
      c("1", "S", "5"), c("2", "H", "2"), c("3", "D", "K"),
      c("4", "C", "3"), c("5", "S", "10"), c("6", "H", "6"),
      c("7", "D", "J"), c("8", "C", "4"), c("9", "S", "9"),
    ];
    expect(classifyAsMelds(hand, wildRank)).toBeNull();
  });
});
