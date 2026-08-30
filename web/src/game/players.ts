// 席に座る「ファミリー」の顔ぶれ。
// これは完全に演出上の設定であり、ルールには一切関与しない（engineは席番号しか知らない）。

export interface Persona {
  /** engine上のプレイヤー番号 */
  index: number;
  name: string;
  /** 肩書き（ポルトガル語まじりのマフィア風） */
  title: string;
  isHuman: boolean;
}

export const PERSONAS: Persona[] = [
  { index: 0, name: "あなた", title: "O Forasteiro — よそ者", isHuman: true },
  { index: 1, name: "ドン・ヴィエイラ", title: "O Chefe — 頭目", isHuman: false },
  { index: 2, name: "ゼ・ナヴァーリャ", title: "A Navalha — 剃刀", isHuman: false },
  { index: 3, name: "ドナ・ローザ", title: "A Viúva — 未亡人", isHuman: false },
];

export function personaOf(index: number): Persona {
  return PERSONAS[index] ?? PERSONAS[0]!;
}
