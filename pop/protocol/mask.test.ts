// マスクの検査。
//
// **ここが破れるとオンライン対戦が成立しない**ので、
// 「見えてはいけないものが入っていないこと」を素朴に、しつこく確かめる。
// 型では守れない（JSON にすれば型は消える）ので、実物を覗いて確認する。

import { describe, it, expect } from "vitest";
import { dealGame, createInitialState, createMatch, applyAction } from "@pifpaf/engine";
import type { GameState } from "@pifpaf/engine";
import { maskFor, maskForSpectator } from "./mask.ts";

/** 決まった並びのデッキを作るための、種を固定した乱数。 */
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function setup(seed = 1) {
  const deal = dealGame(4, rng(seed));
  const state = createInitialState(deal);
  const match = createMatch(4);
  return { state, match };
}

/** JSON にしたときに現れるカードIDを全部拾う。 */
function idsIn(value: unknown): string[] {
  const found: string[] = [];
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    if (typeof v === "object" && v !== null) {
      const o = v as Record<string, unknown>;
      // カードは { id, suit, rank } の形
      if (typeof o["id"] === "string" && typeof o["suit"] === "string") {
        found.push(o["id"]);
      }
      Object.values(o).forEach(walk);
    }
  };
  walk(value);
  return found;
}

describe("maskFor", () => {
  it("自分の手札は入る", () => {
    const { state, match } = setup();
    const view = maskFor(2, state, match);
    expect(view.you).toBe(2);
    expect(view.game.hand.map((c) => c.id)).toEqual(state.hands[2]!.map((c) => c.id));
  });

  it("他人の手札は1枚も入らない", () => {
    const { state, match } = setup();
    const view = maskFor(2, state, match);
    const leaked = idsIn(view);

    for (const seat of [0, 1, 3]) {
      for (const card of state.hands[seat]!) {
        // 同じ札が自分の手札にもある場合（2組デッキ）を避けるため id で見る
        const mine = state.hands[2]!.some((c) => c.id === card.id);
        if (mine) continue;
        expect(leaked).not.toContain(card.id);
      }
    }
  });

  it("山札の中身は入らない。枚数だけ", () => {
    const { state, match } = setup();
    const view = maskFor(0, state, match);
    expect(view.game.stockCount).toBe(state.stock.length);

    const leaked = idsIn(view);
    for (const card of state.stock) {
      expect(leaked).not.toContain(card.id);
    }
  });

  it("捨て札は一番上の1枚だけ", () => {
    const { state, match } = setup();
    // 何手か進めて捨て札を積む
    let s: GameState = state;
    const first = applyAction(s, { type: "TAKE_VIRA" });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    s = first.state;
    const disc = applyAction(s, { type: "DISCARD", cardId: s.hands[s.currentPlayer]![0]!.id });
    expect(disc.ok).toBe(true);
    if (!disc.ok) return;
    s = disc.state;

    const view = maskFor(3, s, match);
    expect(view.game.discardCount).toBe(s.discard.length);
    expect(view.game.topDiscard?.id).toBe(s.discard[s.discard.length - 1]!.id);
  });

  it("採否を決めている札は本人にだけ入る", () => {
    const { state, match } = setup();
    const drawn = applyAction(state, { type: "DRAW" });
    expect(drawn.ok).toBe(true);
    if (!drawn.ok) return;
    const s = drawn.state;
    expect(s.phase).toBe("AWAITING_KEEP_DECISION");
    expect(s.pendingCard).not.toBeNull();

    const mine = maskFor(s.currentPlayer, s, match);
    expect(mine.game.pendingCard?.id).toBe(s.pendingCard!.id);

    // 他人からは、それが何の札かは見えない
    for (const seat of [0, 1, 2, 3].filter((i) => i !== s.currentPlayer)) {
      const other = maskFor(seat, s, match);
      expect(other.game.pendingCard).toBeNull();
      expect(idsIn(other)).not.toContain(s.pendingCard!.id);
    }
  });

  it("ヴィラは表向きなので全員に見える", () => {
    const { state, match } = setup();
    for (const seat of [0, 1, 2, 3]) {
      expect(maskFor(seat, state, match).game.vira?.id).toBe(state.vira!.id);
    }
  });

  it("枚数とチップは全員ぶん入る", () => {
    const { state, match } = setup();
    const view = maskFor(1, state, match);
    expect(view.game.seats.map((s) => s.handCount)).toEqual(state.hands.map((h) => h.length));
    expect(view.game.seats.map((s) => s.chips)).toEqual(match.chips);
  });

  it("公開を指定した席の手札だけが revealedHand に入る", () => {
    const { state, match } = setup();
    const view = maskFor(0, state, match, 2);
    expect(view.game.revealedHand).not.toBeNull();
    expect(view.game.revealedHand!.seat).toBe(2);
    expect(view.game.revealedHand!.cards.map((c) => c.id)).toEqual(
      state.hands[2]!.map((c) => c.id)
    );
  });

  it("公開を指定しなければ revealedHand は null", () => {
    const { state, match } = setup();
    expect(maskFor(0, state, match).game.revealedHand).toBeNull();
  });

  it("返すのは複製で、engine の状態とは繋がっていない", () => {
    const { state, match } = setup();
    const originalRank = state.hands[0]![0]!.rank;
    const view = maskFor(0, state, match);

    view.game.hand[0]!.rank = originalRank === "A" ? "2" : "A";
    view.match.chips[0] = 999;

    expect(state.hands[0]![0]!.rank).toBe(originalRank);
    expect(match.chips[0]).not.toBe(999);
  });
});

describe("maskForSpectator", () => {
  it("どの手札も見えない", () => {
    const { state, match } = setup();
    const view = maskForSpectator(state, match);
    expect(view.you).toBe(-1);
    expect(view.game.hand).toEqual([]);

    const leaked = idsIn(view);
    for (const hand of state.hands) {
      for (const card of hand) expect(leaked).not.toContain(card.id);
    }
  });

  it("枚数と場は見える", () => {
    const { state, match } = setup();
    const view = maskForSpectator(state, match);
    expect(view.game.seats.map((s) => s.handCount)).toEqual([9, 9, 9, 9]);
    expect(view.game.stockCount).toBe(state.stock.length);
  });
});
