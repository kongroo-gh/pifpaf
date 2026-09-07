// 勝ったときの演出。星と光の粒が降ってくる。
//
// 位置・速さ・回転は初回描画のときに一度だけ決めて固定する。
// 毎描画で作り直すと、再描画のたびに降り方が飛ぶため。

import { useEffect, useMemo } from "react";
import { sfx } from "../audio";

const PIECE_COUNT = 60;

interface Piece {
  id: number;
  kind: "star" | "light";
  left: number;
  delay: number;
  duration: number;
  drift: number;
  spin: number;
  scale: number;
}

/** 見た目のばらつき用の擬似乱数。演出なので厳密さは要らない。 */
function makePieces(): Piece[] {
  return Array.from({ length: PIECE_COUNT }, (_, i) => ({
    id: i,
    kind: i % 3 === 0 ? "light" : "star",
    left: Math.random() * 100,
    delay: Math.random() * 2.2,
    duration: 2.6 + Math.random() * 2.6,
    drift: (Math.random() - 0.5) * 160,
    spin: (Math.random() - 0.5) * 900,
    scale: 0.6 + Math.random() * 0.7,
  }));
}

export function StarRain() {
  const pieces = useMemo(makePieces, []);

  // 降り始めに合わせて粒を散らす。降り続けるあいだ鳴らし続けはしない
  // （マッチ制覇は一度きりの見せ場なので、頭だけ厚くすれば足りる）
  useEffect(() => sfx.starfall(), []);

  return (
    <div className="starRain" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className={`starRain__piece starRain__piece--${p.kind}`}
          style={
            {
              left: `${p.left}%`,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              "--drift": `${p.drift}px`,
              "--spin": `${p.spin}deg`,
              "--scale": p.scale,
            } as React.CSSProperties
          }
        >
          {p.kind === "star" ? (
            <svg viewBox="0 0 32 32">
              <path d="M16 1 20 11 31 12 23 20 25 31 16 25 7 31 9 20 1 12 12 11Z"
                fill="var(--star)" stroke="var(--star-bright)" strokeWidth="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 32 32">
              <path d="M16 2 20 12 30 16 20 20 16 30 12 20 2 16 12 12Z"
                fill="var(--moon)" />
            </svg>
          )}
        </span>
      ))}
    </div>
  );
}
