// 一発ものの効果音。すべて合成で、資産ファイルは持たない。
//
// 卓の設定はマフィアの酒場の奥の部屋。**乾いていて、短く、余韻を引かない。**
// 華やかな音（金貨・上がり）だけが例外で、そこだけ倍音を足して光らせる。
//
// 銃声は無い。撃たれる演出ごと外してある（CLAUDE.md「見た目の方針」）。
//
// どの関数も「鳴らせないなら黙って何もしない」。呼ぶ側が
// 音の可否を気にしなくてよいようにしてある（画面の条件分岐が増えるため）。

import { audio, envelope, noiseBuffer } from "./context";

/** 同じ音でも毎回わずかにずらす。機械的な繰り返しに聞こえないように。 */
function vary(base: number, spread: number): number {
  return base * (1 + (Math.random() * 2 - 1) * spread);
}

/** 雑音を帯域で削って鳴らす。札・チップ・金貨の芯はすべてこれ。 */
function burst(
  peak: number,
  attack: number,
  decay: number,
  filter: { type: BiquadFilterType; from: number; to?: number; q?: number },
  delay = 0
): void {
  const a = audio();
  if (a === null) return;
  const { ctx, out } = a;
  const at = ctx.currentTime + delay;

  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;

  const bq = ctx.createBiquadFilter();
  bq.type = filter.type;
  bq.frequency.setValueAtTime(filter.from, at);
  if (filter.to !== undefined) {
    bq.frequency.exponentialRampToValueAtTime(filter.to, at + attack + decay);
  }
  if (filter.q !== undefined) bq.Q.value = filter.q;

  const gain = ctx.createGain();
  envelope(gain, at, peak, attack, decay);

  src.connect(bq).connect(gain).connect(out);
  // 毎回ちがう位置から読む。同じ波形の繰り返しに聞こえないように
  // （loop してあるので、末尾に当たっても足りなくならない）
  src.start(at, Math.random());
  src.stop(at + attack + decay + 0.05);
}

/** 単音。上がりの和音や金貨の粒はこれを重ねて作る。 */
function tone(
  freq: number,
  type: OscillatorType,
  peak: number,
  attack: number,
  decay: number,
  delay = 0,
  glideTo?: number
): void {
  const a = audio();
  if (a === null) return;
  const { ctx, out } = a;
  const at = ctx.currentTime + delay;

  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (glideTo !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(glideTo, at + attack + decay);
  }

  const gain = ctx.createGain();
  envelope(gain, at, peak, attack, decay);

  osc.connect(gain).connect(out);
  osc.start(at);
  osc.stop(at + attack + decay + 0.05);
}

/* ───────────── 札 ───────────── */

/** 1枚配る・引く・捨てる。擦れる音だけ。 */
export function card(delay = 0): void {
  burst(0.32, 0.004, vary(0.075, 0.25), { type: "bandpass", from: vary(2600, 0.18), to: 900, q: 0.8 }, delay);
}

/** 山を割る。札より鈍く、下に重心がある。 */
export function cut(): void {
  burst(0.4, 0.005, 0.13, { type: "lowpass", from: 1800, to: 320 });
  tone(96, "sine", 0.28, 0.006, 0.16, 0.01, 62);
}

/** 札が席へ飛ぶ。抜けていく風。 */
export function whoosh(): void {
  burst(0.14, 0.11, 0.24, { type: "bandpass", from: 500, to: 2400, q: 1.6 });
}

/** ヴィラをめくってコリンガが決まる。卓が一度静まる合図。 */
export function vira(): void {
  card();
  tone(784, "sine", 0.13, 0.01, 0.55, 0.06);
  tone(1174, "sine", 0.07, 0.012, 0.7, 0.07);
}

/* ───────────── チップと金 ───────────── */

/** 粘土のチップが当たる音。乾いた短い当たり。 */
export function chip(delay = 0): void {
  burst(0.3, 0.002, 0.045, { type: "bandpass", from: vary(1500, 0.2), q: 2.4 }, delay);
  tone(vary(2100, 0.15), "sine", 0.06, 0.002, 0.05, delay);
}

/** 金貨。チップと違って金属なので、倍音をずらして光らせる。 */
export function coin(delay = 0): void {
  const base = vary(2450, 0.3);
  tone(base, "sine", 0.09, 0.002, vary(0.4, 0.3), delay);
  // 整数倍からわずかに外すと金属らしくなる
  tone(base * 2.76, "sine", 0.045, 0.002, vary(0.3, 0.3), delay);
  burst(0.08, 0.001, 0.03, { type: "highpass", from: 4000 }, delay);
}

/* ───────────── 決着 ───────────── */

/**
 * BATER!（上がり）。短い金管の刺し。
 * ニ短調の和音で、卓の音楽と喧嘩しないようにしてある。
 */
export function bater(): void {
  const a = audio();
  if (a === null) return;
  const { ctx, out } = a;
  const at = ctx.currentTime;

  const bq = ctx.createBiquadFilter();
  bq.type = "lowpass";
  bq.frequency.setValueAtTime(700, at);
  bq.frequency.exponentialRampToValueAtTime(3600, at + 0.09);
  bq.frequency.exponentialRampToValueAtTime(800, at + 0.55);
  bq.Q.value = 1.2;

  const gain = ctx.createGain();
  envelope(gain, at, 0.2, 0.02, 0.55);
  bq.connect(gain).connect(out);

  // D4 / F4 / A4。短三和音のまま押し切る
  for (const f of [293.66, 349.23, 440]) {
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = f;
    osc.connect(bq);
    osc.start(at);
    osc.stop(at + 0.62);
  }

  burst(0.18, 0.002, 0.12, { type: "bandpass", from: 3000, to: 700, q: 0.7 });
}

/**
 * ラウンドを取ったときの祝い。札が散って、短く上へ抜ける。
 * マッチ制覇の金（`coin`）と役割を分けてあるので、ここは短く保つこと。
 */
export function win(): void {
  for (let i = 0; i < 7; i += 1) card(i * 0.045);
  // D5 → A5 → D6。三度を置かず、開いた響きのままにする
  tone(587.33, "sine", 0.1, 0.01, 0.3, 0.05);
  tone(880, "sine", 0.09, 0.01, 0.35, 0.13);
  tone(1174.66, "sine", 0.07, 0.01, 0.5, 0.21);
}

/** 金貨と札束が降ってくる。粒を散らして降らせる。 */
export function moneyRain(seconds = 2.4, count = 22): void {
  for (let i = 0; i < count; i += 1) coin(Math.random() * seconds);
}

/** 破産して脱落した。下へ落ちていく低い音。 */
export function bust(): void {
  tone(180, "sawtooth", 0.16, 0.02, 0.9, 0, 55);
  burst(0.07, 0.05, 0.6, { type: "lowpass", from: 700, to: 180 });
}

/* ───────────── 画面の操作 ───────────── */

/** ボタン。押した手応えだけで、音色は持たせない。 */
export function click(): void {
  burst(0.16, 0.001, 0.028, { type: "bandpass", from: 1900, q: 1.4 });
}

/** 自分の番になった合図。短い2音の上行。 */
export function turn(): void {
  tone(587.33, "sine", 0.1, 0.008, 0.11);
  tone(880, "sine", 0.09, 0.008, 0.16, 0.085);
}

/** 断られた操作（サーバーが弾いた手など）。 */
export function deny(): void {
  tone(146.83, "square", 0.09, 0.005, 0.16);
  tone(138.59, "square", 0.07, 0.005, 0.2, 0.02);
}
