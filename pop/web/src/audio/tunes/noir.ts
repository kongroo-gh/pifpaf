// これまでの環境音。**差し戻し先。**
//
// **奥の部屋で待たされている数十秒**、という設定。曲ではないので旋律を置かず、
// 「低い持続音」「弾かれる低音」「盤石でない上物」「盤の擦れ」の4層だけで作る。
// 旋律を入れると、聞き覚えができて2回目から待ち時間の長さが気になり始める。
//
// 不穏さの出どころは3つ:
// - ニ短調の主音を鳴らし続けたまま、**増四度（G#）を薄く出し入れする**。
//   協和に着地しないので、ずっと「まだ終わっていない」感じが残る
// - 低音の歩みが4拍目で**半音下から入る**（クロマチック・アプローチ）。
//   ジャズの常套だが、短調で遅く弾くと途端に不吉になる
// - 一定の拍にせず、1周ごとに拍の長さをわずかに揺らす

import { noiseBuffer } from "../context";
import type { Part, Tune } from "./types";

/** 1拍の基準。66BPM 相当。遅いほど落ち着かない */
const BEAT = 0.91;

/** ニ短調。主音 D1 と、その上に積む音（Hz） */
const ROOT = 36.71; // D1
const D2 = 73.42;
const F2 = 87.31;
const A2 = 110.0;
const GS2 = 103.83; // 増四度。これが不穏さの芯
const CS2 = 69.3; // 4拍目で D2 に半音下から入る

/** 低音の歩み。1周8拍 */
const WALK = [D2, F2, A2, GS2, A2, F2, D2, CS2];

export const noir: Tune = {
  tick: BEAT,
  // 等間隔だと機械が刻んでいるように聞こえる
  jitter: 0.04,
  fadeIn: 4,
  gain: 0.85,
  layers: (ctx, out) => [drone(ctx, out), tritone(ctx, out), crackle(ctx, out)],
  play: (ctx, out, slot, at) => pluck(ctx, out, WALK[slot % WALK.length] ?? D2, at),
};

/** 低い持続音。部屋そのものの音。 */
function drone(ctx: AudioContext, out: GainNode): Part {
  const gain = ctx.createGain();
  gain.gain.value = 0.16;

  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 220;
  lp.Q.value = 0.6;
  lp.connect(gain).connect(out);

  // わずかにずらした2本。うねりが出て、電子的な平坦さが消える
  const oscs = [ROOT, ROOT * 1.004].map((f) => {
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = f;
    o.connect(lp);
    o.start();
    return o;
  });

  // 息づかいの速さで音量を揺らす
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.13;
  const depth = ctx.createGain();
  depth.gain.value = 0.05;
  lfo.connect(depth).connect(gain.gain);
  lfo.start();

  return (endAt) => {
    oscs.forEach((o) => o.stop(endAt));
    lfo.stop(endAt);
  };
}

/** 増四度を出し入れする層。ここだけで不穏さの半分を作っている。 */
function tritone(ctx: AudioContext, out: GainNode): Part {
  const gain = ctx.createGain();
  gain.gain.value = 0;

  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 310;
  bp.Q.value = 3;
  bp.connect(gain).connect(out);

  const osc = ctx.createOscillator();
  osc.type = "triangle";
  // ドローンの倍音（A2=110）のすぐ隣に置く。にごりが不穏さの正体で、
  // 高いところで鳴らすと単なる笛になってしまう
  osc.frequency.value = GS2 * 2;
  osc.connect(bp);
  osc.start();

  // 23秒周期。拍とも呼吸とも噛み合わないので、いつ現れるか読めない
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 1 / 23;
  const depth = ctx.createGain();
  depth.gain.value = 0.055;
  lfo.connect(depth).connect(gain.gain);
  lfo.start();

  return (endAt) => {
    osc.stop(endAt);
    lfo.stop(endAt);
  };
}

/** 盤の擦れ。部屋に何か回っている気配だけを置く。 */
function crackle(ctx: AudioContext, out: GainNode): Part {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;

  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 2600;

  const gain = ctx.createGain();
  gain.gain.value = 0.012;

  src.connect(hp).connect(gain).connect(out);
  src.start();

  return (endAt) => src.stop(endAt);
}

/** 弾かれた低音1つ。指で弾く音（雑音）と胴の鳴り（正弦）でできている。 */
function pluck(ctx: AudioContext, out: GainNode, freq: number, at: number): void {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.2, at + 0.012);
  // 1拍（0.91秒）より短く切る。伸ばすと次の音と重なって、
  // 歩いているのではなく持続音になってしまう
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.72);
  gain.gain.setValueAtTime(0, at + 0.73);

  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(1400, at);
  lp.frequency.exponentialRampToValueAtTime(260, at + 0.5);
  lp.connect(gain).connect(out);

  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.value = freq;
  osc.connect(lp);
  osc.start(at);
  osc.stop(at + 0.78);

  // 弦を弾いた瞬間の擦れ
  const click = ctx.createBufferSource();
  click.buffer = noiseBuffer(ctx);
  click.loop = true;
  const cg = ctx.createGain();
  cg.gain.setValueAtTime(0.06, at);
  cg.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
  cg.gain.setValueAtTime(0, at + 0.06);
  click.connect(cg).connect(out);
  click.start(at, Math.random());
  click.stop(at + 0.08);
}
