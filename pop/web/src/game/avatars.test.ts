import { describe, expect, it } from "vitest";
import { AVATARS, avatarForSeat } from "./avatars";

describe("人物アバター", () => {
  it("8体あり男女比率が4対4", () => {
    expect(AVATARS).toHaveLength(8);
    expect(AVATARS.filter((avatar) => avatar.gender === "male")).toHaveLength(4);
    expect(AVATARS.filter((avatar) => avatar.gender === "female")).toHaveLength(4);
  });

  it("各アバターのIDと見た目の組み合わせが重複しない", () => {
    expect(new Set(AVATARS.map((avatar) => avatar.id)).size).toBe(8);
    expect(new Set(AVATARS.map((avatar) => `${avatar.hair}:${avatar.accent}`)).size).toBe(8);
  });

  it("旧サーバーや空席には席番号から既定アバターを選ぶ", () => {
    expect(avatarForSeat(undefined, 0).id).toBe(0);
    expect(avatarForSeat(undefined, 7).id).toBe(7);
    expect(avatarForSeat(undefined, 9).id).toBe(1);
  });
});
