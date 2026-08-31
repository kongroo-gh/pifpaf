import { describe, it, expect } from "vitest";
import type { Card, Rank, Wild } from "./types";
import { isValidTrinca, isValidSequence, classifyAsMelds } from "./melds";

const c = (id: string, suit: Card["suit"], rank: Rank): Card => ({ id, suit, rank });
const wild: Wild = { rank: "8", suit: "S" }; // ヴィラが 7♠ のとき。8♠ だけがワイルド

// ワイルドはヴィラと同じスートの1種類だけ。同ランクでもスートが違えば普通の札。
// ここが緩むとワイルドが8枚に戻ってゲームが別物になるので、明示的に守る。
describe("ワイルドの範囲（ヴィラと同スートのみ）", () => {
  it("8♠ はトリンカの代用になる", () => {
    expect(isValidTrinca([c("a", "S", "7"), c("b", "H", "7"), c("c", "S", "8")], wild)).toBe(true);
  });

  it("8♥ は代用にならない（同ランクでもスートが違う）", () => {
    expect(isValidTrinca([c("a", "S", "7"), c("b", "H", "7"), c("c", "H", "8")], wild)).toBe(false);
  });

  it("8♠ はシーケンスの穴を埋められる", () => {
    expect(isValidSequence([c("a", "S", "5"), c("b", "S", "8"), c("c", "S", "7")], wild)).toBe(true);
  });

  it("8♦ はシーケンスの穴を埋められない", () => {
    // 5♠ _ 7♠ の穴に 8♦ を置こうとしても、8♦ は普通の札なのでスートが揃わない
    expect(isValidSequence([c("a", "S", "5"), c("b", "D", "8"), c("c", "S", "7")], wild)).toBe(false);
  });

  it("ワイルドは2枚まとめて使える（2組デッキに8♠は2枚ある）", () => {
    expect(isValidSequence([c("a", "S", "5"), c("w1", "S", "8"), c("w2", "S", "8")], wild)).toBe(
      true
    );
  });
});

describe("isValidTrinca", () => {
  it("同ランク異スート3枚は成立する", () => {
    expect(isValidTrinca([c("a", "S", "7"), c("b", "H", "7"), c("c", "D", "7")], wild)).toBe(true);
  });

  it("ワイルドを1枚含んでも成立する", () => {
    expect(isValidTrinca([c("a", "S", "7"), c("b", "H", "7"), c("c", "S", "8")], wild)).toBe(true);
  });

  it("同スート重複は不成立", () => {
    expect(isValidTrinca([c("a", "S", "7"), c("b", "S", "7"), c("c", "D", "7")], wild)).toBe(false);
  });

  it("5枚以上（5スート分）は不成立", () => {
    expect(
      isValidTrinca(
        [c("a", "S", "7"), c("b", "H", "7"), c("c", "D", "7"), c("d", "C", "7"), c("e", "S", "8")],
        wild
      )
    ).toBe(false);
  });
});

describe("isValidSequence", () => {
  it("同スート連番3枚は成立する", () => {
    expect(isValidSequence([c("a", "S", "5"), c("b", "S", "6"), c("c", "S", "7")], wild)).toBe(true);
  });

  it("ワイルドで間を埋めても成立する", () => {
    expect(isValidSequence([c("a", "S", "5"), c("b", "S", "8"), c("c", "S", "7")], wild)).toBe(true);
  });

  it("Q-K-A のまたぎは成立する", () => {
    expect(isValidSequence([c("a", "H", "Q"), c("b", "H", "K"), c("c", "H", "A")], wild)).toBe(true);
  });

  it("K-A-2 のまたぎは成立する", () => {
    expect(isValidSequence([c("a", "H", "K"), c("b", "H", "A"), c("c", "H", "2")], wild)).toBe(true);
  });

  it("異なるスートは不成立", () => {
    expect(isValidSequence([c("a", "S", "5"), c("b", "H", "6"), c("c", "S", "7")], wild)).toBe(false);
  });
});

describe("classifyAsMelds", () => {
  it("9枚が綺麗に3役へ分類できるケースを検出できる", () => {
    const hand: Card[] = [
      c("1", "S", "5"), c("2", "S", "6"), c("3", "S", "7"),
      c("4", "H", "9"), c("5", "D", "9"), c("6", "C", "9"),
      c("7", "H", "J"), c("8", "H", "Q"), c("9", "H", "K"),
    ];
    const result = classifyAsMelds(hand, wild);
    expect(result).not.toBeNull();
    expect(result?.length).toBe(3);
  });

  it("役に分類しきれない手札はnullを返す", () => {
    const hand: Card[] = [
      c("1", "S", "5"), c("2", "H", "2"), c("3", "D", "K"),
      c("4", "C", "3"), c("5", "S", "10"), c("6", "H", "6"),
      c("7", "D", "J"), c("8", "C", "4"), c("9", "S", "9"),
    ];
    expect(classifyAsMelds(hand, wild)).toBeNull();
  });
});
