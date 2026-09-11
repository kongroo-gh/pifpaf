import type { AvatarId } from "@pifpaf/protocol";

export type AvatarGender = "male" | "female";
export type HairStyle = "crop" | "wave" | "part" | "buzz" | "bob" | "bun" | "long" | "curl";

export interface AvatarDefinition {
  id: AvatarId;
  gender: AvatarGender;
  hair: HairStyle;
  accent: string;
  skin: string;
}

export const AVATARS: readonly AvatarDefinition[] = [
  { id: 0, gender: "male", hair: "crop", accent: "#d3a34e", skin: "#8f5f47" },
  { id: 1, gender: "male", hair: "wave", accent: "#6f91bc", skin: "#c58c68" },
  { id: 2, gender: "male", hair: "part", accent: "#8d6bab", skin: "#6f4638" },
  { id: 3, gender: "male", hair: "buzz", accent: "#699b79", skin: "#d2a17c" },
  { id: 4, gender: "female", hair: "bob", accent: "#b96672", skin: "#784c3c" },
  { id: 5, gender: "female", hair: "bun", accent: "#be854f", skin: "#d6a47e" },
  { id: 6, gender: "female", hair: "long", accent: "#688f9a", skin: "#a76e52" },
  { id: 7, gender: "female", hair: "curl", accent: "#9a6f8e", skin: "#5f3c32" },
] as const;

export function avatarForSeat(id: AvatarId | undefined, seat: number): AvatarDefinition {
  const fallback = ((seat % AVATARS.length) + AVATARS.length) % AVATARS.length;
  return AVATARS[id ?? fallback] ?? AVATARS[fallback]!;
}
