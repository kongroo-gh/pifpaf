// イントロの環境音。静けさ → 長調の伴奏 → 流れ星 → ゆっくり消える。
// 曲は TUNE の1行で差し替える。noir と bossa は差し戻し先として残す。

import { audio, envelope, holdVoice } from "./context";
import { starlight } from "./tunes/starlight";
import { bossa } from "./tunes/bossa";
import { noir } from "./tunes/noir";
import type { Tune } from "./tunes/types";

// 曲だけを差し戻すときは、starlight を bossa または noir にする。
const TUNE: Tune = starlight;

/** 何秒先まで予約しておくか。描画が詰まっても音が途切れない余裕 */
const LOOKAHEAD_SEC = 1.6;
const TICK_MS = 260;

/** 幕が上がる前の静けさ */
const OPENING_SILENCE = 1.2;
/** 星が流れるまでの長さ。この幅の中で毎回変える */
const PLAY_MIN_SEC = 17;
const PLAY_MAX_SEC = 26;
/** 一発鳴ったあとの静けさ。長く空けると、壊れたのかと思われる */
const AFTER_STAR_SEC = 3;
/** 曲をゆっくり消えるまでの長さ */
const FADE_SEC = 1.2;

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

  // 曲の側。流れ星で断たれるのはこちらだけ
  const bus = ctx.createGain();
  bus.gain.value = 0;
  bus.connect(out);

  // 流れ星の側。**曲とは別に持つ。** 曲を断つ操作が流れ星まで巻き込むと、
  // 流れた音そのものが消えてしまう
  const stars = ctx.createGain();
  stars.gain.value = 1;
  stars.connect(out);

  const parts = TUNE.layers(ctx, bus);

  /** 次に鳴らす目盛りの時刻・その番号・この段が星が流れる時刻 */
  let nextAt = 0;
  let slot = 0;
  let starAt = 0;

  /** 静けさのあと、音量を上げながら曲を始める。最初も星が流れたあともここを通る */
  const open = (startAt: number) => {
    bus.gain.setValueAtTime(0, startAt);
    bus.gain.linearRampToValueAtTime(TUNE.gain, startAt + TUNE.fadeIn);
    nextAt = startAt;
    slot = 0;
    starAt = startAt + PLAY_MIN_SEC + Math.random() * (PLAY_MAX_SEC - PLAY_MIN_SEC);
  };

  open(ctx.currentTime + OPENING_SILENCE);

  const tick = () => {
    while (nextAt < ctx.currentTime + LOOKAHEAD_SEC) {
      if (nextAt >= starAt) {
        shootingStar(ctx, stars, starAt);
        // 立ち上がりはとうに終わっているので、この時刻の音量は TUNE.gain で確定している
        bus.gain.setValueAtTime(TUNE.gain, starAt);
        bus.gain.linearRampToValueAtTime(0, starAt + FADE_SEC);
        open(starAt + FADE_SEC + AFTER_STAR_SEC);
        continue;
      }
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
    // 予約済みの流れ星を黙らせる。卓に着いたあとに一発鳴っては困る
    stars.gain.setValueAtTime(0, ctx.currentTime);
    parts.forEach((p) => p(end));
    window.setTimeout(() => {
      bus.disconnect();
      stars.disconnect();
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

/** 光が空を横切る。破裂音や重い低音は重ねない。 */
function shootingStar(ctx: AudioContext, out: AudioNode, at: number): void {
  const light = ctx.createOscillator();
  light.type = "sine";
  light.frequency.setValueAtTime(1174.66, at);
  light.frequency.exponentialRampToValueAtTime(293.66, at + 1.2);
  const gain = ctx.createGain();
  envelope(gain, at, 0.12, 0.09, 1.2);
  light.connect(gain).connect(out);
  light.start(at);
  light.stop(at + 1.4);
}
