// 完全新規のイントロ曲「Sunlit Table」。
// 明るいAメジャーを基調に、ジャズのテンションコードとボサノヴァの
// シンコペーションを組み合わせた、歌のない短いラウンジ曲。

import { noiseBuffer } from "../context";
import { hz } from "./types";
import type { Tune } from "./types";

/** 124 BPM。目盛りは16分音符。 */
const BEAT = 60 / 124;
const TICK = BEAT / 4;
const PER_BAR = 16;

interface Chord {
  voicing: number[];
  bass: [number, number];
}

// Aメジャーを一周し、最後のE13から自然に頭へ戻る8小節。
const A69: Chord = { voicing: [57, 59, 61, 64, 66], bass: [45, 52] };
const Cs7b9: Chord = { voicing: [59, 62, 65, 68], bass: [37, 44] };
const Fsm9: Chord = { voicing: [57, 61, 64, 68], bass: [42, 49] };
const B13: Chord = { voicing: [57, 61, 63, 68], bass: [35, 42] };
const Bm9: Chord = { voicing: [57, 59, 62, 66], bass: [35, 42] };
const E13: Chord = { voicing: [56, 61, 62, 66], bass: [40, 47] };
const PROGRESSION = [A69, Cs7b9, Fsm9, B13, Bm9, E13, A69, E13];

/** 1小節内のエレピの置き場所。裏拍を多くして軽く前へ進ませる。 */
const COMP = [0, 3, 7, 10, 14];

/** オリジナルの8小節メロディ。各組は [16分位置, MIDI音, 長さ(拍)]。 */
const MELODY: Array<Array<[number, number, number]>> = [
  [[2, 76, 1.4], [6, 78, 1.2], [10, 80, 1.4], [14, 85, 1.7]],
  [[2, 83, 1.5], [6, 80, 1.2], [10, 77, 1.2], [14, 80, 1.5]],
  [[2, 81, 1.5], [6, 85, 1.2], [10, 80, 1.4], [14, 76, 1.5]],
  [[2, 78, 1.4], [6, 75, 1.2], [10, 73, 1.4], [14, 71, 1.5]],
  [[2, 74, 1.4], [6, 78, 1.2], [10, 81, 1.4], [14, 85, 1.5]],
  [[2, 83, 1.4], [6, 80, 1.2], [10, 78, 1.4], [14, 74, 1.5]],
  [[0, 85, 1.8], [5, 83, 1.2], [9, 80, 1.4], [13, 78, 1.5]],
  [[2, 74, 1.2], [6, 78, 1.2], [10, 80, 1.4], [14, 83, 1.8]],
];

export const sunlitBossa: Tune = {
  tick: TICK,
  jitter: 0.008,
  fadeIn: 2.4,
  gain: 0.78,
  layers: () => [],
  play: (ctx, out, slot, at) => {
    const bar = Math.floor(slot / PER_BAR) % PROGRESSION.length;
    const inBar = slot % PER_BAR;
    const chord = PROGRESSION[bar];
    if (chord === undefined) return;

    if (slot % 2 === 0) shaker(ctx, out, at, inBar % 4 === 2 ? 0.026 : 0.018);
    if (inBar === 6 || inBar === 14) rim(ctx, out, at, inBar === 14 ? 0.055 : 0.04);

    if (inBar === 0) bass(ctx, out, chord.bass[0], at, 0.15);
    if (inBar === 8) bass(ctx, out, chord.bass[1], at, 0.13);

    const compIndex = COMP.indexOf(inBar);
    if (compIndex >= 0) electricPiano(ctx, out, chord.voicing, at, compIndex === 0 ? 0.072 : 0.052);

    const note = MELODY[bar]?.find(([position]) => position === inBar);
    if (note !== undefined) lead(ctx, out, note[1], at, note[2] * BEAT);
  },
};

export function configurePercussionSource(
  source: AudioBufferSourceNode,
  buffer: AudioBuffer
): void {
  source.buffer = buffer;
  source.loop = true;
}

function electricPiano(
  ctx: AudioContext,
  out: GainNode,
  notes: number[],
  at: number,
  level: number
): void {
  notes.forEach((midi, index) => {
    const start = at + index * 0.007;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(level, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.72);
    gain.gain.setValueAtTime(0, start + 0.74);

    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.setValueAtTime(3200, start);
    tone.frequency.exponentialRampToValueAtTime(900, start + 0.5);
    tone.connect(gain).connect(out);

    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = hz(midi);
    osc.connect(tone);
    osc.start(start);
    osc.stop(start + 0.76);

    const bell = ctx.createOscillator();
    bell.type = "sine";
    bell.frequency.value = hz(midi) * 2;
    const bellGain = ctx.createGain();
    bellGain.gain.value = 0.16;
    bell.connect(bellGain).connect(tone);
    bell.start(start);
    bell.stop(start + 0.42);
  });
}

function bass(ctx: AudioContext, out: GainNode, midi: number, at: number, level: number): void {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(level, at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.48);
  gain.gain.setValueAtTime(0, at + 0.5);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(760, at);
  filter.frequency.exponentialRampToValueAtTime(180, at + 0.34);
  filter.connect(gain).connect(out);

  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.value = hz(midi);
  osc.connect(filter);
  osc.start(at);
  osc.stop(at + 0.52);
}

function lead(ctx: AudioContext, out: GainNode, midi: number, at: number, duration: number): void {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.052, at + 0.025);
  gain.gain.setValueAtTime(0.046, at + Math.max(0.04, duration - 0.12));
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);

  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = hz(midi);
  const warmth = ctx.createOscillator();
  warmth.type = "triangle";
  warmth.frequency.value = hz(midi) / 2;
  const warmthGain = ctx.createGain();
  warmthGain.gain.value = 0.12;

  osc.connect(gain).connect(out);
  warmth.connect(warmthGain).connect(gain);
  osc.start(at);
  warmth.start(at);
  osc.stop(at + duration + 0.02);
  warmth.stop(at + duration + 0.02);
}

function shaker(ctx: AudioContext, out: GainNode, at: number, level: number): void {
  const source = ctx.createBufferSource();
  configurePercussionSource(source, noiseBuffer(ctx));
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 6900;
  filter.Q.value = 1.2;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(level, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.035);
  source.connect(filter).connect(gain).connect(out);
  source.start(at, Math.random());
  source.stop(at + 0.045);
}

function rim(ctx: AudioContext, out: GainNode, at: number, level: number): void {
  const source = ctx.createBufferSource();
  configurePercussionSource(source, noiseBuffer(ctx));
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 1850;
  filter.Q.value = 4.5;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(level, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.055);
  source.connect(filter).connect(gain).connect(out);
  source.start(at, Math.random());
  source.stop(at + 0.07);
}
