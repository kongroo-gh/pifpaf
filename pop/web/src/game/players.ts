// 席に座る旅の連れの顔ぶれ。
// これは完全に演出上の設定であり、ルールには一切関与しない（engineは席番号しか知らない）。
//
import type { AvatarId } from "@pifpaf/protocol";

export interface Persona {
  /** engine上のプレイヤー番号。i18n の personas もこの順 */
  index: number;
  avatarId: AvatarId;
  isHuman: boolean;
}

export const PERSONAS: Persona[] = [
  { index: 0, avatarId: 0, isHuman: true },
  { index: 1, avatarId: 1, isHuman: false },
  { index: 2, avatarId: 4, isHuman: false },
  { index: 3, avatarId: 6, isHuman: false },
  { index: 4, avatarId: 2, isHuman: false },
  { index: 5, avatarId: 5, isHuman: false },
];
