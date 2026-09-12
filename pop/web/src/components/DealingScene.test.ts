import { describe, expect, it } from "vitest";
import { dealAnimationDuration } from "./DealingScene";

describe("配札演出のアクセシビリティ", () => {
  it("動きを減らす設定では待ち時間を残さない", () => {
    expect(dealAnimationDuration(1.5, true)).toBe(0);
    expect(dealAnimationDuration(1.5, false)).toBeGreaterThan(0);
  });
});
