import { describe, expect, it } from "vitest";
import { INTRO_TUNE_NAME } from "./ambience";
import { sfx } from "./index";

describe("音響方針", () => {
  it("イントロにはボサノヴァを使う", () => {
    expect(INTRO_TUNE_NAME).toBe("bossa");
  });

  it("対局中のトランプ効果音を有効にする", () => {
    expect(sfx.card).not.toBe(sfx.chip);
    expect(sfx.card).not.toBe(sfx.turn);
    expect(sfx.bater).not.toBe(sfx.baterMine);
  });
});