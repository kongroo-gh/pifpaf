import type { AvatarId } from "@pifpaf/protocol";

export type AvatarGender = "male" | "female";
export type HairStyle = "crop" | "wave" | "part" | "buzz" | "bob" | "bun" | "long" | "curl";

export interface AvatarDefinition {
  id: AvatarId;
  name: string;
  gender: AvatarGender;
  hair: HairStyle;
  hairColor: string;
  accent: string;
  skin: string;
  jacket: string;
  tie: string;
}

/** 卓のCPUと同じ世界にいる8人。0〜3が男性、4〜7が女性。 */
export const AVATARS: readonly AvatarDefinition[] = [
  { id: 0, name: "Dom Vieira", gender: "male", hair: "crop", hairColor: "#302b29", accent: "#b28a42", skin: "#8f5f47", jacket: "#425c65", tie: "#963e38" },
  { id: 1, name: "Zé Navalha", gender: "male", hair: "wave", hairColor: "#251f22", accent: "#687f91", skin: "#c58c68", jacket: "#4a596f", tie: "#b28a42" },
  { id: 2, name: "Luís", gender: "male", hair: "part", hairColor: "#241a16", accent: "#6c7862", skin: "#6f4638", jacket: "#536b50", tie: "#7d3430" },
  { id: 3, name: "O Fantasma", gender: "male", hair: "buzz", hairColor: "#c1b6a3", accent: "#7b8584", skin: "#d2a17c", jacket: "#555f64", tie: "#4b545b" },
  { id: 4, name: "Dona Rosa", gender: "female", hair: "bob", hairColor: "#493b32", accent: "#8a555c", skin: "#784c3c", jacket: "#746079", tie: "#b28a42" },
  { id: 5, name: "Luna", gender: "female", hair: "bun", hairColor: "#5e4435", accent: "#896d43", skin: "#d6a47e", jacket: "#896d43", tie: "#425c65" },
  { id: 6, name: "Bia Falcão", gender: "female", hair: "long", hairColor: "#171315", accent: "#526f74", skin: "#a76e52", jacket: "#405d63", tie: "#b8785e" },
  { id: 7, name: "Iara", gender: "female", hair: "curl", hairColor: "#704638", accent: "#71556c", skin: "#5f3c32", jacket: "#66516f", tie: "#d0a868" },
] as const;

export function avatarForSeat(id: AvatarId | undefined, seat: number): AvatarDefinition {
  const fallback = ((seat % AVATARS.length) + AVATARS.length) % AVATARS.length;
  return AVATARS[id ?? fallback] ?? AVATARS[fallback]!;
}
