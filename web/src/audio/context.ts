// 音の土台。AudioContext の生成と、鳴らしてよいかの管理だけ。
//
// **音源ファイルは持たない。すべて Web Audio で合成する。**
// 卓の音は短い破裂音と減衰音ばかりで、合成で十分に作れる。ファイルを持つと
// GitHub Pages に数百KBの資産と出典・利用条件の管理が増え、
// 「engine を触らずに演出だけ足す」という今の身軽さが失われる。
//
// **ブラウザは操作前に音を出させない。** AudioContext は生成しても suspended で
// 始まるので、最初のクリック・キー入力で resume する。それまでに求められた音は
// 鳴らさずに捨てる（溜めて後から一斉に鳴らすほうが不自然なため）。

const SOUND_KEY = "pifpaf.sound";

/** 全体の音量。個々の音はこれを基準に相対で作る。 */
const MASTER_GAIN = 0.5;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let unlocked = false;

/** 切り替えを画面に伝えるための購読者。 */
const listeners = new Set<() => void>();

function loadEnabled(): boolean {
  try {
    // 既定は鳴らす。黙らせたい人だけが保存を持つ
    return window.localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

let enabled = loadEnabled();

export function soundEnabled(): boolean {
  return enabled;
}

export function setSoundEnabled(next: boolean): void {
  enabled = next;
  try {
    window.localStorage.setItem(SOUND_KEY, next ? "on" : "off");
  } catch {
    // 保存できなくても、その場では切り替わる
  }
  if (!next) stopAllVoices();
  listeners.forEach((fn) => fn());
}

export function subscribeSound(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * 最初の操作で音を解禁する。
 * `App` から一度だけ呼ぶ。二重に呼んでも足されない。
 */
export function armUnlock(): () => void {
  if (unlocked) return () => {};

  const unlock = () => {
    unlocked = true;
    void ctx?.resume();
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
    listeners.forEach((fn) => fn());
  };

  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
  return () => {
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
}

export function soundUnlocked(): boolean {
  return unlocked;
}

/**
 * 鳴らせる状態なら AudioContext を返す。
 * まだ操作されていない・黙らせている・そもそも使えない環境では null。
 */
export function audio(): { ctx: AudioContext; out: GainNode } | null {
  if (!enabled || !unlocked) return null;

  if (ctx === null) {
    const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctor === undefined) return null;
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
    master = ctx.createGain();
    master.gain.value = MASTER_GAIN;
    master.connect(ctx.destination);
  }

  // 端末を伏せるなどで止まっていることがある
  if (ctx.state === "suspended") void ctx.resume();
  if (master === null) return null;
  return { ctx, out: master };
}

/* ───────────── 鳴っている音の後始末 ───────────── */
//
// 消音した瞬間に止めたいのは、ループしている環境音だけ。
// 一発ものは長くて1.5秒で消えるので、追いかけるほどの価値がない。

const voices = new Set<() => void>();

/** 止め方を預ける。返り値を呼ぶと預けを解く。 */
export function holdVoice(stop: () => void): () => void {
  voices.add(stop);
  return () => voices.delete(stop);
}

function stopAllVoices(): void {
  voices.forEach((stop) => stop());
  voices.clear();
}

/* ───────────── 合成の道具 ───────────── */

/**
 * 雑音。札の擦れ・チップの当たり・金貨の芯になる。
 *
 * 1秒ぶんを一度だけ作って使い回す。札の音は1ラウンドで100回近く鳴るので、
 * その都度サンプルを埋めると配札の演出中に描画が引っかかる。
 * 読み出しは毎回ちがう位置から始めるので、同じ音には聞こえない。
 */
let noise: { ctx: AudioContext; buffer: AudioBuffer } | null = null;

export function noiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noise !== null && noise.ctx === ctx) return noise.buffer;

  const length = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  noise = { ctx, buffer };
  return buffer;
}

/**
 * 減衰する包絡。`setValueAtTime(0)` から立ち上げて指数で落とす。
 *
 * 指数カーブは 0 を通れないので、消える側は極小値に落としてから
 * 0 を置く。ここを省くと端末によっては「プツッ」と切れる。
 */
export function envelope(
  gain: GainNode,
  at: number,
  peak: number,
  attack: number,
  decay: number
): void {
  const g = gain.gain;
  g.setValueAtTime(0.0001, at);
  g.exponentialRampToValueAtTime(Math.max(peak, 0.0002), at + attack);
  g.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  g.setValueAtTime(0, at + attack + decay);
}
