import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { RoomInfo, RoomSeat } from "@pifpaf/protocol";
import { LanguageProvider } from "../i18n";
import { AwayOverlay, onlineDealKey, onlineDealPending, onlineSeatName } from "./OnlineTable";

describe("オンライン卓の表示", () => {
  it("旧サーバーのCPU番号表記を人物名へ置き換える", () => {
    const cpu5 = { name: "CPU 5", avatarId: 5, isBot: true } as RoomSeat;
    const cpu6 = { name: "CPU 6", avatarId: 6, isBot: true } as RoomSeat;
    expect(onlineSeatName(cpu5, "空席")).toBe("Luna");
    expect(onlineSeatName(cpu6, "空席")).toBe("Bia Falcão");
  });

  it("新ラウンドの盤面が届いてからラウンド別の配札演出キーを作る", () => {
    expect(onlineDealKey("FOLD_DECISION", "ROUND_OVER", 2, "7S")).toBeNull();
    expect(onlineDealKey("FOLD_DECISION", "AWAITING_FIRST_DRAW", 2, "7S")).toBe("2-7S");
    expect(onlineDealKey("FOLD_DECISION", "AWAITING_FIRST_DRAW", 3, "KH")).toBe("3-KH");
    expect(onlineDealKey("ROUND_RESULT", "ROUND_OVER", 3, "KH")).toBeNull();
    expect(onlineDealPending("2-7S", "1-KH")).toBe(true);
    expect(onlineDealPending("2-7S", "2-7S")).toBe(false);
  });

  it("切断待機画面に復帰用ルームコードを表示する", () => {
    const room = {
      roomId: "7K3M",
      awaiting: [1],
      awaitingUntil: Date.now() + 60_000,
      seats: [{ seat: 1, name: "Luna" }],
    } as RoomInfo;
    const html = renderToStaticMarkup(<LanguageProvider><AwayOverlay room={room} /></LanguageProvider>);
    expect(html).toContain("7K3M");
  });
});