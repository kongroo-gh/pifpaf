// 配札の演出。
//
// engine は既に配り終えた結果（手札・ヴィラ・山札）を持っているので、
// ここはそれを「そう配られたように見せる」だけ。ルールには一切関与しない。
//
// 流れ: 山札を半分に割る → 割れ目からヴィラを抜いてめくる（コリンガ確定）
//       → 3枚ずつ配る（3巡で9枚）→ 山札を置く
//
// 画面のどこへ飛ばすかは、盤面に付けたアンカー（data-*）を実測して決める。
// 位置を決め打ちにすると、画面幅や縦横で破綻するため。

import { useEffect, useMemo, useRef, useState } from "react";
import type { Card, Wild } from "@pifpaf/engine";
import { PlayingCard, CardBack } from "./PlayingCard";
import { useT } from "../i18n";
import type { Strings } from "../i18n";

export type DealStep = "CUT" | "VIRA" | "DEAL" | "SETTLE" | "DONE";

/** 各段階の長さ（ミリ秒）。速さ設定で伸び縮みする。 */
const DURATION: Record<Exclude<DealStep, "DONE">, number> = {
  CUT: 620,
  VIRA: 760,
  DEAL: 1320,
  SETTLE: 480,
};

/** 配る巡回数（3枚 × 3巡 = 9枚） */
const WAVES = 3;

interface Point {
  x: number;
  y: number;
}

interface Anchors {
  deck: Point;
  stock: Point;
  vira: Point;
  seats: Point[];
}

function centerOf(el: Element | null): Point | null {
  if (el === null) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

export interface DealingSceneProps {
  vira: Card | null;
  wild: Wild;
  /** 席ごとの配る枚数。脱落者には配らない */
  dealtSeats: number[];
  speedFactor: number;
  /** ヴィラをめくった瞬間 */
  onRevealVira: () => void;
  onDone: () => void;
}

export function DealingScene({
  vira,
  wild,
  dealtSeats,
  speedFactor,
  onRevealVira,
  onDone,
}: DealingSceneProps) {
  const t = useT();
  const [step, setStep] = useState<DealStep>("CUT");
  const [anchors, setAnchors] = useState<Anchors | null>(null);
  const revealRef = useRef(onRevealVira);
  const doneRef = useRef(onDone);
  revealRef.current = onRevealVira;
  doneRef.current = onDone;

  // 配列そのものを依存にすると、親の再描画のたびに測り直して演出が最初からやり直しになる
  const seatsKey = dealtSeats.join(",");

  // 盤面のアンカーを実測する。演出中も盤面は描かれているので位置が取れる。
  useEffect(() => {
    const stock = centerOf(document.querySelector("[data-stock-pile]"));
    const viraSlot = centerOf(document.querySelector("[data-vira-slot]"));
    const seats = dealtSeats.map((i) => centerOf(document.querySelector(`[data-seat="${i}"]`)));

    if (stock === null || viraSlot === null || seats.some((p) => p === null)) {
      // 位置が取れない場面では演出を諦めて、すぐ本編へ進める
      doneRef.current();
      return;
    }

    setAnchors({
      // 配り始めは場の中央あたり（山札と捨て札の中間）
      deck: { x: window.innerWidth / 2, y: stock.y },
      stock,
      vira: viraSlot,
      seats: seats as Point[],
    });
    // seatsKey で席の顔ぶれの変化だけを見る（配列の参照は毎回変わるため）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seatsKey]);

  // 段階を順に進める
  useEffect(() => {
    if (anchors === null) return;
    const order: Exclude<DealStep, "DONE">[] = ["CUT", "VIRA", "DEAL", "SETTLE"];
    const timers: ReturnType<typeof setTimeout>[] = [];
    let at = 0;

    for (const s of order) {
      const start = at;
      timers.push(setTimeout(() => setStep(s), start));
      if (s === "VIRA") {
        // めくり終わりでコリンガを確定させる
        timers.push(
          setTimeout(() => revealRef.current(), start + DURATION.VIRA * 0.75 * speedFactor)
        );
      }
      at += DURATION[s] * speedFactor;
    }
    timers.push(
      setTimeout(() => {
        setStep("DONE");
        doneRef.current();
      }, at)
    );

    return () => timers.forEach(clearTimeout);
  }, [anchors, speedFactor]);

  // 3枚ずつの束を、巡ごと・席ごとにずらして飛ばす
  const batches = useMemo(() => {
    if (anchors === null) return [];
    const perFlight = (DURATION.DEAL * speedFactor) / (WAVES * anchors.seats.length);
    return anchors.seats.flatMap((seat, seatIndex) =>
      Array.from({ length: WAVES }, (_, wave) => ({
        key: `${seatIndex}-${wave}`,
        seat,
        delay: (wave * anchors.seats.length + seatIndex) * perFlight,
      }))
    );
  }, [anchors, speedFactor]);

  if (anchors === null) return null;

  const cut = step !== "CUT";
  const dealing = step === "DEAL" || step === "SETTLE" || step === "DONE";
  const settled = step === "SETTLE" || step === "DONE";

  return (
    <div className="dealing" aria-hidden="true">
      <p className="dealing__caption">{captionFor(step, t)}</p>

      {/* 山札。半分に割れて、最後は山札の位置へ収まる */}
      <div
        className={`dealing__half dealing__half--top ${cut ? "is-cut" : ""} ${settled ? "is-settled" : ""}`}
        style={anchorStyle(anchors.deck, anchors.stock, speedFactor)}
      >
        <CardBack size="md" />
      </div>
      <div
        className={`dealing__half dealing__half--bottom ${cut ? "is-cut" : ""} ${settled ? "is-settled" : ""}`}
        style={anchorStyle(anchors.deck, anchors.stock, speedFactor)}
      >
        <CardBack size="md" />
      </div>

      {/* 割れ目から抜いたヴィラ。めくりながらヴィラ枠へ飛ぶ */}
      {vira && (
        <div
          className={`dealing__vira ${step === "CUT" ? "" : "is-drawn"} ${dealing ? "is-placed" : ""}`}
          style={
            {
              left: `${anchors.deck.x}px`,
              top: `${anchors.deck.y}px`,
              "--vx": `${anchors.vira.x - anchors.deck.x}px`,
              "--vy": `${anchors.vira.y - anchors.deck.y}px`,
              "--ms": `${DURATION.VIRA * speedFactor}ms`,
            } as React.CSSProperties
          }
        >
          <div className="dealing__viraInner">
            <div className="dealing__viraFace">
              <PlayingCard card={vira} wild={wild} size="md" />
            </div>
            <div className="dealing__viraBack">
              <CardBack size="md" />
            </div>
          </div>
        </div>
      )}

      {/* 3枚ずつの束 */}
      {dealing &&
        batches.map((b) => (
          <div
            key={b.key}
            className="dealing__batch"
            style={
              {
                left: `${anchors.deck.x}px`,
                top: `${anchors.deck.y}px`,
                "--bx": `${b.seat.x - anchors.deck.x}px`,
                "--by": `${b.seat.y - anchors.deck.y}px`,
                animationDelay: `${b.delay}ms`,
                animationDuration: `${360 * speedFactor}ms`,
              } as React.CSSProperties
            }
          >
            <CardBack size="sm" />
            <CardBack size="sm" />
            <CardBack size="sm" />
          </div>
        ))}
    </div>
  );
}

function anchorStyle(deck: Point, stock: Point, speedFactor: number): React.CSSProperties {
  return {
    left: `${deck.x}px`,
    top: `${deck.y}px`,
    ["--sx" as string]: `${stock.x - deck.x}px`,
    ["--sy" as string]: `${stock.y - deck.y}px`,
    ["--ms" as string]: `${DURATION.SETTLE * speedFactor}ms`,
  };
}

function captionFor(step: DealStep, t: Strings): string {
  switch (step) {
    case "CUT":
      return t.dealing.split;
    case "VIRA":
      return t.dealing.revealVira;
    case "DEAL":
      return t.dealing.deal;
    default:
      return "";
  }
}
