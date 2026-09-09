import { it, expect } from "vitest";
import { supportsRequestedCapacity } from "./messages.ts";

it("旧サーバーの4席への黙った変更を拒否する", () => {
  for (const requested of [3, 5, 6]) expect(supportsRequestedCapacity(requested, undefined)).toBe(false);
  expect(supportsRequestedCapacity(4, undefined)).toBe(true);
  for (const requested of [3, 4, 5, 6]) expect(supportsRequestedCapacity(requested, requested)).toBe(true);
  expect(supportsRequestedCapacity(6, 5)).toBe(false);
});
