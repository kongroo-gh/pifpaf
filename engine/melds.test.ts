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

  // A は上にも下にも使えるが、またぐことだけはできない。
  it("K-A-2 は成立しない（A をまたげない）", () => {
    expect(isValidSequence([c("a", "H", "K"), c("b", "H", "A"), c("c", "H", "2")], wild)).toBe(
      false
    );
  });

  it("A-2-3 は成立する（A は下でも使える）", () => {
    expect(isValidSequence([c("a", "H", "A"), c("b", "H", "2"), c("c", "H", "3")], wild)).toBe(true);
  });

  it("A-2-3-4 の4枚も成立する", () => {
    expect(
      isValidSequence(
        [c("a", "H", "A"), c("b", "H", "2"), c("c", "H", "3"), c("d", "H", "4")],
        wild
      )
    ).toBe(true);
  });

  it("Q-K-A-2 は成立しない（Aで折り返せない）", () => {
    expect(
      isValidSequence(
        [c("a", "H", "Q"), c("b", "H", "K"), c("c", "H", "A"), c("d", "H", "2")],
        wild
      )
    ).toBe(false);
  });

  it("2-3-4 は成立する", () => {
    expect(isValidSequence([c("a", "H", "2"), c("b", "H", "3"), c("c", "H", "4")], wild)).toBe(true);
  });

  it("10-J-Q-K-A の5枚も成立する", () => {
    expect(
      isValidSequence(
        [c("a", "S", "10"), c("b", "S", "J"), c("c", "S", "Q"), c("d", "S", "K"), c("e", "S", "A")],
        wild
      )
    ).toBe(true);
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

// 4枚組は「記号の重複が必要」（ユーザー指定）。3枚組は従来どおり全て異なる記号。
describe("トリンカの枚数別ルール", () => {
  it("3枚組は記号が全て異なれば成立する", () => {
    expect(isValidTrinca([c("a", "S", "7"), c("b", "H", "7"), c("d", "D", "7")], wild)).toBe(true);
  });

  it("3枚組で記号が重複すると不成立", () => {
    expect(isValidTrinca([c("a", "S", "7"), c("b", "S", "7"), c("d", "D", "7")], wild)).toBe(false);
  });

  it("4枚組は記号が重複していれば成立する（♠♣♥♥）", () => {
    expect(
      isValidTrinca(
        [c("a", "S", "7"), c("b", "C", "7"), c("d", "H", "7"), c("e", "H", "7")],
        wild
      )
    ).toBe(true);
  });

  it("4枚すべて違う記号は4枚組として認めない（♠♥♦♣）", () => {
    expect(
      isValidTrinca(
        [c("a", "S", "7"), c("b", "H", "7"), c("d", "D", "7"), c("e", "C", "7")],
        wild
      )
    ).toBe(false);
  });

  it("4枚組にワイルドが混じっていれば、それが重複ぶんを担える", () => {
    // 7♠7♥7♦ + 8♠(ワイルド) → ワイルドが重複する記号の代役になる
    expect(
      isValidTrinca(
        [c("a", "S", "7"), c("b", "H", "7"), c("d", "D", "7"), c("w", "S", "8")],
        wild
      )
    ).toBe(true);
  });

  it("同じ記号が3枚以上は不成立（2組デッキに2枚しかない）", () => {
    expect(
      isValidTrinca(
        [c("a", "S", "7"), c("b", "S", "7"), c("d", "S", "7"), c("e", "H", "7")],
        wild
      )
    ).toBe(false);
  });

  it("5枚組は記号が2つ重複していれば成立する（♠♠♣♣♥）", () => {
    expect(
      isValidTrinca(
        [c("a", "S", "7"), c("b", "S", "7"), c("d", "C", "7"), c("e", "C", "7"), c("f", "H", "7")],
        wild
      )
    ).toBe(true);
  });

  it("5枚組で重複が1つだけなら不成立（♠♠♣♥♦）", () => {
    expect(
      isValidTrinca(
        [c("a", "S", "7"), c("b", "S", "7"), c("d", "C", "7"), c("e", "H", "7"), c("f", "D", "7")],
        wild
      )
    ).toBe(false);
  });

  it("5枚組にワイルドが混じっていれば、足りない重複を担える", () => {
    // 7♠7♠7♣7♥ + 8♠(ワイルド) → ワイルドが♣か♥の2枚目になれば2つ重複になる
    expect(
      isValidTrinca(
        [c("a", "S", "7"), c("b", "S", "7"), c("d", "C", "7"), c("e", "H", "7"), c("w", "S", "8")],
        wild
      )
    ).toBe(true);
  });

  it("6枚組は無い（同ランク6枚は3枚組が2つになる）", () => {
    const six = [
      c("a", "S", "7"), c("b", "S", "7"), c("d", "C", "7"),
      c("e", "C", "7"), c("f", "H", "7"), c("g", "H", "7"),
    ];
    expect(isValidTrinca(six, wild)).toBe(false);
    // 3枚組2つには分類できる
    const m = classifyAsMelds(six, wild);
    expect(m).not.toBeNull();
    expect(m?.map((x) => x.cards.length)).toEqual([3, 3]);
  });

  it("5枚組x2の10枚で上がれる", () => {
    const hand = [
      // 7 の5枚組（♠♠♣♣♥）
      c("1", "S", "7"), c("2", "S", "7"), c("3", "C", "7"), c("4", "C", "7"), c("5", "H", "7"),
      // 9 の5枚組（♠♠♦♦♥）
      c("6", "S", "9"), c("7", "S", "9"), c("8", "D", "9"), c("9", "D", "9"), c("10", "H", "9"),
    ];
    const m = classifyAsMelds(hand, wild);
    expect(m).not.toBeNull();
    expect(m?.map((x) => x.cards.length)).toEqual([5, 5]);
  });

  it("4枚組+5枚組の9枚で上がれる", () => {
    const hand = [
      // 4枚組（♠♣♥♥）
      c("1", "S", "7"), c("2", "C", "7"), c("3", "H", "7"), c("4", "H", "7"),
      // 5枚組（♠♠♣♣♥）
      c("5", "S", "9"), c("6", "S", "9"), c("7", "C", "9"), c("8", "C", "9"), c("9", "H", "9"),
    ];
    const m = classifyAsMelds(hand, wild);
    expect(m).not.toBeNull();
    expect(m?.map((x) => x.cards.length).sort()).toEqual([4, 5]);
  });
});
