// 自分がラウンドを取ったときの祝いの演出。
//
// マッチ制覇の「金が降る」は別にあるので、こちらは軽く短く。
// 勝った手札そのものを放射状に飛び散らせて、何で勝ったかを一瞬見せる。
//
// 見た目だけの部品で、ルールにも進行にも関与しない。

import { useEffect, useRef } from "react";
import type { Card, Wild } from "@pifpaf/engine";
import { PlayingCard } from "./PlayingCard";

/** 飛び散ってから収まるまで */
const BURST_MS = 1400;

export interface CardBurstProps {
  cards: Card[];
  wild: Wild;
  onDone: () => void;
}

export function CardBurst({ cards, wild, onDone }: CardBurstProps) {
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    // 動きを抑える設定では演出そのものを出さない（CSSで隠している）。
    // ここで待つと、何も見えないまま結果パネルが1.4秒遅れるだけになる。
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      doneRef.current();
      return;
    }

    const timer = setTimeout(() => doneRef.current(), BURST_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="burst" aria-hidden="true">
      <div className="burst__ring" />

      {cards.map((card, i) => {
        // 放射状に散らす。等間隔だと機械的なので、札ごとに少しずらす。
        const angle = (i / cards.length) * Math.PI * 2 - Math.PI / 2;
        const wobble = ((i * 37) % 11) / 11 - 0.5;
        const distance = 190 + ((i * 53) % 90);
        const spin = (wobble > 0 ? 1 : -1) * (180 + ((i * 71) % 220));

        return (
          <div
            key={card.id}
            className="burst__card"
            style={
              {
                "--bx": `${Math.cos(angle + wobble * 0.5) * distance}px`,
                "--by": `${Math.sin(angle + wobble * 0.5) * distance * 0.72}px`,
                "--spin": `${spin}deg`,
                animationDelay: `${i * 28}ms`,
              } as React.CSSProperties
            }
          >
            <PlayingCard card={card} wild={wild} size="md" />
          </div>
        );
      })}
    </div>
  );
}
