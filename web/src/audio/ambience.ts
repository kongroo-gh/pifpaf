// イントロで流す環境音。**ここだけがループする。**
//
// このファイルが持つのは仕掛けだけ——立ち上げ、止め、先読みで予約する、の3つ。
// **何を鳴らすかは `tunes/` の曲が持つ。** 分けてあるのは、曲を差し替えても
// 仕掛けを触らずに済むようにするため。
//
// 曲を戻すには、下の `TUNE` を `noir` に変えるだけでよい。
//
// 合成なので資産ファイルは持たない（`context.ts` の頭を参照）。

import { audio, holdVoice } from "./context";
import { bossa } from "./tunes/bossa";
import { noir } from "./tunes/noir";
import type { Tune } from "./tunes/types";

/**
 * 流す曲。
 *
 * - `bossa` ボサノヴァ（2026-09-04・ユーザー指示でこちらに変更）
 * - `noir`  それまでの不穏なドローン。**差し戻し先はこれ**
 *
 * どちらもニ短調・同じ薄暗さで、曲の違いは脈の打ち方だけ。
 * 気に入らなければこの1行を戻せば元の音に戻る。
 */
const TUNE: Tune = bossa;

/** 何秒先まで予約しておくか。描画が詰まっても音が途切れない余裕 */
const LOOKAHEAD_SEC = 1.6;
const TICK_MS = 260;

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
  // 画面が切り替わった瞬間に鳴り出すと驚くので、ゆっくり立ち上げる。
  // 上がりの刺しや金貨より十数dB下に置く（これは背景であって聞かせる音ではない）
  bus.gain.linearRampToValueAtTime(TUNE.gain, ctx.currentTime + TUNE.fadeIn);

  const parts = TUNE.layers(ctx, bus);

  // 目盛りに合わせて先へ先へと予約していく
  let slot = 0;
  let nextAt = ctx.currentTime + 1.2;
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
    window.setTimeout(() => bus.disconnect(), 1400);
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
