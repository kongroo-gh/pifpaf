import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LanguageProvider } from "../i18n";
import { PlayerCountSelector } from "./PlayerCountSelector";

describe("プレイ人数選択", () => {
  it("選択肢は言語別の長い単位を付けず数字だけ表示する", () => {
    const html = renderToStaticMarkup(
      <LanguageProvider>
        <PlayerCountSelector value={4} onChange={() => {}} />
      </LanguageProvider>
    );

    expect(html).toContain(">3</button>");
    expect(html).toContain(">4</button>");
    expect(html).toContain(">5</button>");
    expect(html).toContain(">6</button>");
    expect(html).not.toMatch(/>\d+(人| players| jogadores)<\/button>/);
  });
});
