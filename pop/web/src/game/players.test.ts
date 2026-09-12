import { describe, expect, it } from "vitest";
import { en } from "../i18n/en";
import { ja } from "../i18n/ja";
import { pt } from "../i18n/pt";
import { AVATARS } from "./avatars";
import { PERSONAS } from "./players";

describe("オフライン卓の人物", () => {
  it("3言語の席名と人物イラストを同じキャラクターに保つ", () => {
    expect(PERSONAS[0]).toMatchObject({ avatarId: 3, isHuman: true });
    const characterNames = PERSONAS.slice(1).map((persona) => AVATARS[persona.avatarId]!.name);

    expect(characterNames).toEqual(["Dom Vieira", "Zé Navalha", "Dona Rosa", "Luís", "Luna"]);
    expect(en.personas.slice(1).map(({ name }) => name)).toEqual(characterNames);
    expect(pt.personas.slice(1).map(({ name }) => name)).toEqual(characterNames);
    expect(ja.personas.slice(1).map(({ name }) => name)).toEqual(characterNames);
  });
});