import { describe, expect, it } from "vitest";
import { parseClientMessage, PROTOCOL_VERSION } from "./messages.ts";

describe("オンラインプロフィール", () => {
  it.each([0, 1, 2, 3, 4, 5, 6, 7])("CREATE はアバター %i を保持する", (avatarId) => {
    expect(parseClientMessage({
      t: "CREATE",
      version: PROTOCOL_VERSION,
      name: "旅人",
      avatarId,
    })).toMatchObject({ avatarId });
  });

  it.each([-1, 8, 1.5, "2", null])("不正なアバター %s を拒否する", (avatarId) => {
    expect(parseClientMessage({
      t: "JOIN",
      version: PROTOCOL_VERSION,
      roomId: "ABCD",
      name: "旅人",
      avatarId,
    })).toBeNull();
  });

  it("旧画面のメッセージには既定アバターを補う", () => {
    expect(parseClientMessage({
      t: "JOIN",
      version: PROTOCOL_VERSION,
      roomId: "ABCD",
      name: "旅人",
    })).toMatchObject({ avatarId: 0 });
  });
});
