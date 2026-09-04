// イントロで流す環境音。**ここだけがループする。**
//
// このファイルが持つのは仕掛けと段取りだけ。**何を鳴らすかは `tunes/` の曲が持つ。**
// 分けてあるのは、曲を差し替えても仕掛けを触らずに済むようにするため。
// 曲を戻すには、下の `TUNE` を `noir` に変えるだけでよい。
//
// ## 段取り（2026-09-04・ユーザー指示）
//
//   静けさ → 音量が上がりながら曲が始まる → しばらく流れる
//     → **銃声が一発** → 曲が断ち切られて無音 → 少し置いて、また音量が上がる
//
// 隣の部屋のラジオが鳴っていて、外で一発鳴るたびに止まる、という見立て。
// **最初もここから始める。** いきなり鳴り出すより、静けさから音量が上がるほうが
// 「誰かがつまみを回した」ように聞こえる。
//
// 撃たれるまでの長さは毎回変える。同じ秒数で来ると身構えられて驚きが消える。
//
// 合成なので資産ファイルは持たない（`context.ts` の頭を参照）。

import { audio, envelope, holdVoice, noiseBuffer } from "./context";
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
 * 気に入らなければこの1行を戻せば元の音に戻る（銃声の段取りは曲によらず同じ）。
 */
const TUNE: Tune = bossa;

/** 何秒先まで予約しておくか。描画が詰まっても音が途切れない余裕 */
const LOOKAHEAD_SEC = 1.6;
const TICK_MS = 260;

/** 幕が上がる前の静けさ */
const OPENING_SILENCE = 1.2;
/** 撃たれるまでの長さ。この幅の中で毎回変える */
const PLAY_MIN_SEC = 17;
const PLAY_MAX_SEC = 26;
/** 一発鳴ったあとの静けさ。長く空けると、壊れたのかと思われる */
const AFTER_SHOT_SEC = 3;
/** 曲を断ち切る速さ。0秒で落とすとプツッと鳴るので、聞こえない程度に丸める */
const CUT_SEC = 0.005;

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

  // 曲の側。銃声で断たれるのはこちらだけ
  const bus = ctx.createGain();
  bus.gain.value = 0;
  bus.connect(out);

  // 銃声の側。**曲とは別に持つ。** 曲を断つ操作が銃声まで巻き込むと、
  // 撃った音そのものが消えてしまう
  const shots = ctx.createGain();
  shots.gain.value = 1;
  shots.connect(out);

  const parts = TUNE.layers(ctx, bus);

  /** 次に鳴らす目盛りの時刻・その番号・この段が撃たれる時刻 */
  let nextAt = 0;
  let slot = 0;
  let shotAt = 0;

  /** 静けさのあと、音量を上げながら曲を始める。最初も撃たれたあともここを通る */
  const open = (startAt: number) => {
    bus.gain.setValueAtTime(0, startAt);
    bus.gain.linearRampToValueAtTime(TUNE.gain, startAt + TUNE.fadeIn);
    nextAt = startAt;
    slot = 0;
    shotAt = startAt + PLAY_MIN_SEC + Math.random() * (PLAY_MAX_SEC - PLAY_MIN_SEC);
  };

  open(ctx.currentTime + OPENING_SILENCE);

  const tick = () => {
    while (nextAt < ctx.currentTime + LOOKAHEAD_SEC) {
      if (nextAt >= shotAt) {
        gunshot(ctx, shots, shotAt);
        // 立ち上がりはとうに終わっているので、この時刻の音量は TUNE.gain で確定している
        bus.gain.setValueAtTime(TUNE.gain, shotAt);
        bus.gain.linearRampToValueAtTime(0, shotAt + CUT_SEC);
        open(shotAt + CUT_SEC + AFTER_SHOT_SEC);
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
    // 予約済みの銃声を黙らせる。卓に着いたあとに一発鳴っては困る
    shots.gain.setValueAtTime(0, ctx.currentTime);
    parts.forEach((p) => p(end));
    window.setTimeout(() => {
      bus.disconnect();
      shots.disconnect();
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

/**
 * 銃声。一発だけ。
 *
 * **「撃たれる演出」とは別もの。** あちらは席を1人ずつ撃つ段取りごと外してある
 * （CLAUDE.md「見た目の方針」）。こちらは音だけで、誰が撃たれたのかも見せない。
 * 隣の部屋で何かが起きた、という気配だけを置く。
 *
 * 3つ重ねて作る:
 * - **破裂** 1ミリ秒で立ち上がる高い雑音。乾いた「パン」の正体はここ
 * - **胴**  低い正弦をひと突き。腹に来る重さを足す
 * - **返り** 壁で1回返ってくるぶん。長く引くと屋外になってしまうので短く切る
 */
function gunshot(ctx: AudioContext, out: AudioNode, at: number): void {
  const noise = (
    peak: number,
    attack: number,
    decay: number,
    type: BiquadFilterType,
    from: number,
    to: number,
    q?: number
  ) => {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx);
    src.loop = true;

    const bq = ctx.createBiquadFilter();
    bq.type = type;
    bq.frequency.setValueAtTime(from, at);
    bq.frequency.exponentialRampToValueAtTime(to, at + attack + decay);
    if (q !== undefined) bq.Q.value = q;

    const gain = ctx.createGain();
    envelope(gain, at, peak, attack, decay);

    src.connect(bq).connect(gain).connect(out);
    // 毎回ちがう位置から読む。同じ波形の繰り返しに聞こえないように
    src.start(at, Math.random());
    src.stop(at + attack + decay + 0.05);
  };

  noise(0.62, 0.001, 0.045, "highpass", 1100, 2600);
  noise(0.42, 0.002, 0.16, "lowpass", 900, 120);
  noise(0.075, 0.012, 0.5, "bandpass", 1300, 700, 0.6);

  const body = ctx.createOscillator();
  body.type = "sine";
  body.frequency.setValueAtTime(78, at);
  body.frequency.exponentialRampToValueAtTime(40, at + 0.18);
  const bg = ctx.createGain();
  envelope(bg, at, 0.3, 0.003, 0.18);
  body.connect(bg).connect(out);
  body.start(at);
  body.stop(at + 0.24);
}
