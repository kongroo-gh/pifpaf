import { describe, expect, it } from "vitest";
import { INTRO_TUNE_NAME } from "./ambience";
import { sfx } from "./index";
import { configurePercussionSource } from "./tunes/sunlitBossa";

describe("音響方針", () => {
  it("イントロには完全新規の明るいジャズ・ボサノヴァを使う", () => {
    expect(INTRO_TUNE_NAME).toBe("sunlit-bossa-original");
  });

  it("パーカッションのノイズを途中で切らない", () => {
    const source = { buffer: null, loop: false } as unknown as AudioBufferSourceNode;
    const buffer = {} as AudioBuffer;
    configurePercussionSource(source, buffer);
    expect(source.buffer).toBe(buffer);
    expect(source.loop).toBe(true);
  });

  it("対局中のトランプ効果音を有効にする", () => {
    expect(sfx.card).not.toBe(sfx.chip);
    expect(sfx.card).not.toBe(sfx.turn);
    expect(sfx.bater).not.toBe(sfx.baterMine);
  });
});