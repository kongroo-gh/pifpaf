// 環境音の「曲」の形。
//
// 仕掛け（立ち上げ・停止・先読み予約）は `ambience.ts` が持ち、**何を鳴らすかだけ**を
// こちらに切り出してある。差し替えが1行で済み、気に入らなければ元に戻せるように。
//
// 曲は2つ:
// - `noir.ts`  これまでの不穏なドローン
// - `bossa.ts` ボサノヴァ
//
// どちらを流すかは `ambience.ts` の `TUNE` が決める。

/** 鳴り続ける層。返した関数を `endAt` で呼ぶと止まる。 */
export type Part = (endAt: number) => void;

export interface Tune {
  /**
   * 1目盛りの長さ（秒）。`play` はこの間隔で呼ばれる。
   * 曲によって刻みの細かさが違う（歩く低音なら1拍、伴奏なら16分）。
   */
  tick: number;
  /**
   * 目盛りごとの揺らぎ。`tick` に対する割合。
   * 0 だと機械が刻んでいるように聞こえるので、少しだけ散らす。
   */
  jitter: number;
  /** 立ち上がりにかける秒数。画面が切り替わった瞬間に鳴り出すと驚く */
  fadeIn: number;
  /** 曲全体の音量。背景なので、上がりの刺しや金貨よりずっと下に置く */
  gain: number;
  /** 鳴り続ける層を作る。部屋そのものの音 */
  layers: (ctx: AudioContext, out: GainNode) => Part[];
  /** `slot` 番目の目盛り（0起点で増え続ける）に鳴るものを、`at` 秒に予約する */
  play: (ctx: AudioContext, out: GainNode, slot: number, at: number) => void;
}

/**
 * MIDI番号から周波数。和音を音名で書けるようにするための道具。
 * 生の Hz を並べると、どの和音なのかがコードから読めなくなる。
 */
export function hz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}
