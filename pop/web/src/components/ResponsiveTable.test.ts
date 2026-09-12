import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

describe("大人数卓のモバイル表示", () => {
  it("CPU席でもチップ画像を隠さない", () => {
    expect(css).not.toMatch(/\.tableRing \.seat__chips \.chipStack\s*\{\s*display:\s*none/);
  });

  it("5〜6人卓のヴィラ・山札・捨て札を手札に近い大きさに保つ", () => {
    expect(css).toMatch(/tableRing:is\(\[data-count="5"\], \[data-count="6"\]\)[^}]*\.card--md[^}]*\{\s*width:\s*48px;\s*height:\s*68px;/s);
    expect(css).toMatch(/tableRing:is\(\[data-count="5"\], \[data-count="6"\]\)[^}]*topbar__vira[^}]*card--sm[^}]*\{\s*width:\s*48px;\s*height:\s*68px;/s);
  });
});
