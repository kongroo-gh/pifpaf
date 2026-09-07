// 観測船の甲板に浮かぶ、ニ長調の伴奏。旋律は置かない。
// 持続する層を持たず、音は短く消える。段取りと停止は ambience が持つ。
import { envelope } from "../context";
import { hz } from "./types";
import type { Tune } from "./types";

const CHORDS = [
  [62, 66, 69, 73], // Dmaj7
  [59, 62, 66, 69], // Bm7
  [55, 59, 62, 66], // Gmaj7
  [57, 61, 64, 69], // A
];

export const starlight: Tune = {
  tick: 0.6,
  jitter: 0.018,
  fadeIn: 3.2,
  gain: 0.65,
  layers: () => [],
  play: (ctx, out, slot, at) => {
    if (slot % 4 !== 0) return;
    const chord = CHORDS[Math.floor(slot / 8) % CHORDS.length];
    if (chord === undefined) return;
    chord.forEach((note, i) => {
      const start = at + i * 0.035;
      const oscillator = ctx.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = hz(note);
      const gain = ctx.createGain();
      envelope(gain, start, 0.035, 0.08, 1.6);
      oscillator.connect(gain).connect(out);
      oscillator.start(start);
      oscillator.stop(start + 1.75);
    });
  },
};
