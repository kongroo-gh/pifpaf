// イントロで流す、ジャズの和声を持つボサノヴァ。

import { audio, holdVoice } from "./context";
import { bossa } from "./tunes/bossa";
import type { Tune } from "./tunes/types";

export const INTRO_TUNE_NAME = "bossa";
const TUNE: Tune = bossa;

/** 何秒先まで予約しておくか。描画が詰まっても音が途切れない余裕 */
const LOOKAHEAD_SEC = 1.6;
const TICK_MS = 260;

/** 幕が上がる前の静けさ */
const OPENING_SILENCE = 1.2;


interface Running {
  stop: () => void;
}

let running: Running | null = null;
/** 解禁前に求められたら、解禁後に自分で始められるよう覚えておく */
let wanted = false;

export function ambienceWanted(): boolean {
  return wanted;
}

export function startAmbience(): void {
  wanted = true;
  if (running !== null) return;

  const a = audio();
  if (a === null) return; // まだ操作されていない／消音中。解禁時に呼び直される
  const { ctx, out } = a;

  const bus = ctx.createGain();
  bus.gain.value = 0;
  bus.connect(out);

  const parts = TUNE.layers(ctx, bus);

  /** 次に鳴らす目盛りの時刻と番号 */
  let nextAt = 0;
  let slot = 0;

  const startAt = ctx.currentTime + OPENING_SILENCE;
  bus.gain.setValueAtTime(0, startAt);
  bus.gain.linearRampToValueAtTime(TUNE.gain, startAt + TUNE.fadeIn);
  nextAt = startAt;

  const tick = () => {
    while (nextAt < ctx.currentTime + LOOKAHEAD_SEC) {
      TUNE.play(ctx, bus, slot, nextAt);
      // 少し散らす。等間隔だと機械が刻んでいるように聞こえる
      nextAt += TUNE.tick * (1 + (Math.random() * 2 - 1) * TUNE.jitter);
      slot += 1;
    }
  };
  tick();
  const timer = window.setInterval(tick, TICK_MS);

  const stop = () => {
    window.clearInterval(timer);
    const end = ctx.currentTime + 1.1;
    bus.gain.cancelScheduledValues(ctx.currentTime);
    bus.gain.setValueAtTime(bus.gain.value, ctx.currentTime);
    bus.gain.linearRampToValueAtTime(0, end);
    parts.forEach((p) => p(end));
    window.setTimeout(() => {
      bus.disconnect();
    }, 1400);
    running = null;
    release();
  };

  const release = holdVoice(stop);
  running = { stop };
}

export function stopAmbience(): void {
  wanted = false;
  running?.stop();
}
