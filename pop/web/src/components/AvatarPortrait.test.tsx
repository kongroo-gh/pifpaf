import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AvatarPortrait } from "./AvatarPortrait";
import { AVATARS } from "../game/avatars";

describe("人物イラスト", () => {
  it.each(AVATARS)("$name を選択欄と卓で共通表示できる", (avatar) => {
    const html = renderToStaticMarkup(<AvatarPortrait avatarId={avatar.id} />);
    expect(html).toContain(`data-avatar-id="${avatar.id}"`);
    expect(html).toContain(`data-person="${avatar.id}"`);
    expect(html).toContain(`data-character="${avatar.name}"`);
    expect(html).toContain("seat__person");
  });
});
