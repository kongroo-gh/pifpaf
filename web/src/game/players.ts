// 席に座る「ファミリー」の顔ぶれ。
// これは完全に演出上の設定であり、ルールには一切関与しない（engineは席番号しか知らない）。
//
// 呼び名と肩書きの訳は i18n の辞書が持つ。ここに残っているのはポルトガル語の
// 異名だけで、これは雰囲気そのものなので訳さない（全言語で共通）。

export interface Persona {
  /** engine上のプレイヤー番号。i18n の personas もこの順 */
  index: number;
  /** ポルトガル語の異名。訳さずそのまま出す */
  epithet: string;
  isHuman: boolean;
}

export const PERSONAS: Persona[] = [
  { index: 0, epithet: "O Forasteiro", isHuman: true },
  { index: 1, epithet: "O Chefe", isHuman: false },
  { index: 2, epithet: "A Navalha", isHuman: false },
  { index: 3, epithet: "A Viúva", isHuman: false },
];

export function personaOf(index: number): Persona {
  return PERSONAS[index] ?? PERSONAS[0]!;
}
