import { describe, expect, it } from "vitest";
import { INTRO_TUNE_NAME } from "./ambience";
import { sfx } from "./index";

describe("音響方針", () => {
  it("イントロにはボサノヴァを使う", () => {
    expect(INTRO_TUNE_NAME).toBe("bossa");
  });

  it("対局中の効果音はすべて無効にする", () => {
    expect(new Set(Object.values(sfx)).size).toBe(1);
  });
});