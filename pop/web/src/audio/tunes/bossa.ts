// ボサノヴァ。イントロで流す環境音の、もう一つの姿。
//
// **雰囲気は `noir.ts` から動かさない。** 同じニ短調、同じ薄暗さ、同じ「奥の部屋」。
// 変えたのは脈の打ち方だけで、不穏さの芯だった増四度はむしろそのまま持ち込んでいる。
//
// あちらでは D の上に G# を浮かべ、協和に着地させないことで落ち着かなさを作っていた。
// こちらでは同じ音程が A7♭9 の中の3度と7度（C#とG）になる。**和音の一部になった
// 瞬間、同じ濁りが「不吉」から「洒落た翳り」に変わる。** ボサノヴァらしさと
// 不穏さが両立するのはこの一点にかかっている。
//
// **旋律は置かない**（`noir.ts` と同じ理由）。覚えられる節を置くと、2回目から
// 待ち時間の長さが気になり始める。鳴るのは伴奏・低音・シェイカーだけで、
// 「隣の部屋で誰かが弾いている」以上のことはしない。
//
// 組み立ては3つ:
// - **バチーダ**（ボサノヴァのクラーベ）で和音を置く。2小節で5回。
//   等間隔に置くと単なるワルツになるので、食う位置が命
// - **2フィールの低音**。小節の1拍目に根音、3拍目に5度。歩き回らせない
// - **シェイカー**を8分で薄く。ボサノヴァだと分かる合図のうち、いちばん安い

import { noiseBuffer } from "../context";
import { hz } from "./types";
import type { Part, Tune } from "./types";

/** 四分音符。130BPM 相当。和音は1小節に1つしか変わらないので、速くても急かない */
const BEAT = 0.46;
/** 目盛りは16分。バチーダは食う位置で決まるので、これより粗いと再現できない */
const TICK = BEAT / 4;
const PER_BAR = 16;

/**
 * ボサノヴァのクラーベ。2小節（32目盛り）で5回。
 * ソン・クラーベの最後の1打を「3拍目の裏」へずらしたもので、この1打が
 * ボサノヴァとサンバを分けている。
 */
const CLAVE = [0, 6, 12, 20, 26];
const CLAVE_SPAN = PER_BAR * 2;

/** 和音1つ。ギターの押さえ方に合わせた4声（根音は低音側に任せる） */
interface Chord {
  /** 伴奏で弾く4声 */
  voicing: number[];
  /** 低音の2フィール。小節の1拍目と3拍目 */
  bass: [number, number];
}

// 音名は MIDI 番号で書く。Hz を直に並べると、どの和音なのかが読めなくなる
const Dm9: Chord = { voicing: [53, 57, 60, 64], bass: [38, 45] }; // F A C E ／ D-A
const Gm9: Chord = { voicing: [58, 62, 65, 69], bass: [43, 50] }; // B♭ D F A ／ G-D
const Em7b5: Chord = { voicing: [55, 58, 62, 64], bass: [40, 46] }; // G B♭ D E ／ E-B♭
const A7b9: Chord = { voicing: [55, 58, 61, 64], bass: [45, 52] }; // G B♭ C# E ／ A-E

/**
 * 短調のボサノヴァでいちばん手垢のついた循環。8小節で一回り。
 * 4小節で回すと繰り返しに気づかれるので、5小節目から下属（Gm9）に振って伸ばす。
 */
const PROGRESSION: Chord[] = [Dm9, Dm9, Em7b5, A7b9, Dm9, Gm9, Em7b5, A7b9];
const CYCLE = PROGRESSION.length * PER_BAR;

export const bossa: Tune = {
  tick: TICK,
  // 16分に対する揺らぎなので、ここは小さく。大きいと酔って聞こえる
  jitter: 0.012,
  fadeIn: 3.2,
  gain: 0.8,
  layers: (ctx, out) => [room(ctx, out), crackle(ctx, out)],
  play: (ctx, out, slot, at) => {
    const chord = PROGRESSION[Math.floor(slot / PER_BAR) % PROGRESSION.length];
    if (chord === undefined) return;
    const inBar = slot % PER_BAR;

    // シェイカーは8分。裏をわずかに強くすると前へ転がる
    if (slot % 2 === 0) shaker(ctx, out, at, inBar % 4 === 2 ? 0.026 : 0.017);

    // 低音は2フィール。1拍目に根音、3拍目に5度
    if (inBar === 0) bass(ctx, out, hz(chord.bass[0]), at);
    if (inBar === 8) bass(ctx, out, hz(chord.bass[1]), at);

    const beatOfClave = CLAVE.indexOf(slot % CLAVE_SPAN);
    if (beatOfClave >= 0) {
      // 頭の1打をいちばん強く。あとは撫でる程度に落として、
      // 「刻んでいる」ではなく「置いている」ようにする
      const level = [0.085, 0.062, 0.072, 0.06, 0.055][beatOfClave] ?? 0.06;
      guitar(ctx, out, chord.voicing, at, level);
    }
  },
};

/* ───────────── 層 ───────────── */

/**
 * 部屋の低い唸り。`noir.ts` のドローンを一段下げたもの。
 * こちらは和音が場所を取るので、音程として聞こえるところまで出さない。
 */
function room(ctx: AudioContext, out: GainNode): Part {
  const gain = ctx.createGain();
  gain.gain.value = 0.085;

  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 150;
  lp.Q.value = 0.6;
  lp.connect(gain).connect(out);

  // D1。和音が Dm・Em7♭5・A7♭9 と動いても、D は全部の中に居場所がある
  const oscs = [hz(26), hz(26) * 1.004].map((f) => {
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = f;
    o.connect(lp);
    o.start();
    return o;
  });

  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.11;
  const depth = ctx.createGain();
  depth.gain.value = 0.03;
  lfo.connect(depth).connect(gain.gain);
  lfo.start();

  return (endAt) => {
    oscs.forEach((o) => o.stop(endAt));
    lfo.stop(endAt);
  };
}

/** 盤の擦れ。`noir.ts` と同じ気配を残す。 */
function crackle(ctx: AudioContext, out: GainNode): Part {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;

  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 2600;

  const gain = ctx.createGain();
  gain.gain.value = 0.009;

  src.connect(hp).connect(gain).connect(out);
  src.start();

  return (endAt) => src.stop(endAt);
}

/* ───────────── 一発もの ───────────── */

/**
 * ガット弦の和音。
 * **4声を同時に鳴らさない。** 9ミリ秒ずつずらすと指で撫でたように聞こえる。
 * 揃えると鍵盤になってしまい、ギターに聞こえない。
 */
function guitar(ctx: AudioContext, out: GainNode, voicing: number[], at: number, level: number): void {
  voicing.forEach((midi, i) => {
    const t = at + i * 0.009;
    const f = hz(midi);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(level, t + 0.006);
    // 1小節（1.84秒）より短く切る。伸ばすと次の和音と混ざって濁る
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.15);
    gain.gain.setValueAtTime(0, t + 1.16);

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    // 弾いた瞬間だけ倍音が出て、すぐ丸くなる。ガット弦の要点
    lp.frequency.setValueAtTime(2600, t);
    lp.frequency.exponentialRampToValueAtTime(700, t + 0.4);
    lp.connect(gain).connect(out);

    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = f;
    osc.connect(lp);
    osc.start(t);
    osc.stop(t + 1.2);

    // 2倍音を薄く足す。三角波だけだと痩せて聞こえる
    const upper = ctx.createOscillator();
    upper.type = "sine";
    upper.frequency.value = f * 2;
    const ug = ctx.createGain();
    ug.gain.value = 0.34;
    upper.connect(ug).connect(lp);
    upper.start(t);
    upper.stop(t + 1.2);
  });

  // 爪が弦に当たる音。和音の頭に1回だけ
  const nail = ctx.createBufferSource();
  nail.buffer = noiseBuffer(ctx);
  nail.loop = true;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(level * 0.34, at);
  ng.gain.exponentialRampToValueAtTime(0.0001, at + 0.045);
  ng.gain.setValueAtTime(0, at + 0.05);
  const nhp = ctx.createBiquadFilter();
  nhp.type = "highpass";
  nhp.frequency.value = 1800;
  nail.connect(nhp).connect(ng).connect(out);
  nail.start(at, Math.random());
  nail.stop(at + 0.07);
}

/**
 * 親指で弾く低音。
 * ボサノヴァの低音は**歩かない**。根音と5度を置いて、すぐ止める。
 * 伸ばすと歩くベースになり、ジャズのスウィングに寄ってしまう。
 */
function bass(ctx: AudioContext, out: GainNode, freq: number, at: number): void {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.17, at + 0.014);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.62);
  gain.gain.setValueAtTime(0, at + 0.63);

  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(900, at);
  lp.frequency.exponentialRampToValueAtTime(190, at + 0.35);
  lp.connect(gain).connect(out);

  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.value = freq;
  osc.connect(lp);
  osc.start(at);
  osc.stop(at + 0.68);
}

/** シェイカー。1粒ずつは聞こえなくてよく、あるかないかが分かればいい。 */
function shaker(ctx: AudioContext, out: GainNode, at: number, level: number): void {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;

  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 6200;
  bp.Q.value = 1.1;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(level, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.028);
  gain.gain.setValueAtTime(0, at + 0.032);

  src.connect(bp).connect(gain).connect(out);
  src.start(at, Math.random());
  src.stop(at + 0.05);
}
