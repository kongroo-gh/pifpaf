// 捨て札から誰かが札を持っていったことを見せる演出。
// 捨て札の山から、取った人の席へ札が飛んでいく。
//
// 盤面では枚数の数字が変わるだけなので、誰が何を取ったのかが追えない。
// 「相手が拾った」を一目で分かるようにするためだけの見た目で、ルールには関与しない。

import { useEffect, useRef, useState } from "react";
import type { Card, Wild } from "@pifpaf/engine";
import { PlayingCard } from "./PlayingCard";

/** 飛んでいる時間（ミリ秒）。CPUの手番間隔より短くして、次の手と重ならないようにする。 */
const FLIGHT_MS = 620;

export interface CardFlightProps {
  card: Card;
  wild: Wild;
  /** 受け取る席。0 は自分 */
  seat: number;
  onDone: () => void;
}

interface Flight {
  left: number;
  top: number;
  dx: number;
  dy: number;
}

export function CardFlight({ card, wild, seat, onDone }: CardFlightProps) {
  const [flight, setFlight] = useState<Flight | null>(null);
  const [arrived, setArrived] = useState(false);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const from = document.querySelector("[data-discard-pile]")?.getBoundingClientRect();
    const to = document.querySelector(`[data-seat="${seat}"]`)?.getBoundingClientRect();

    // 要素が見つからない場面（画面遷移の途中など）は、演出を諦めて静かに終える
    if (!from || !to) {
      doneRef.current();
      return;
    }

    setFlight({
      left: from.left,
      top: from.top,
      dx: to.left + to.width / 2 - (from.left + from.width / 2),
      dy: to.top + to.height / 2 - (from.top + from.height / 2),
    });

    // 出発点を描いた次のフレームで目的地へ動かす（そうしないと遷移が始まらない）
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setArrived(true));
    });
    const timer = setTimeout(() => doneRef.current(), FLIGHT_MS);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [seat]);

  if (flight === null) return null;

  return (
    <div
      className={`cardFlight ${arrived ? "cardFlight--arrived" : ""}`}
      style={
        {
          left: `${flight.left}px`,
          top: `${flight.top}px`,
          "--dx": `${flight.dx}px`,
          "--dy": `${flight.dy}px`,
          "--ms": `${FLIGHT_MS}ms`,
        } as React.CSSProperties
      }
      aria-hidden="true"
    >
      <PlayingCard card={card} wild={wild} size="md" />
    </div>
  );
}
