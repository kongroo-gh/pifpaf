// 勝ったときの演出。金貨と札束が降ってくる。
//
// 位置・速さ・回転は初回描画のときに一度だけ決めて固定する。
// 毎描画で作り直すと、再描画のたびに降り方が飛ぶため。

import { useEffect, useMemo } from "react";
import { sfx } from "../audio";

const PIECE_COUNT = 60;

interface Piece {
  id: number;
  kind: "coin" | "bill";
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
    kind: i % 3 === 0 ? "bill" : "coin",
    left: Math.random() * 100,
    delay: Math.random() * 2.2,
    duration: 2.6 + Math.random() * 2.6,
    drift: (Math.random() - 0.5) * 160,
    spin: (Math.random() - 0.5) * 900,
    scale: 0.6 + Math.random() * 0.7,
  }));
}

export function MoneyRain() {
  const pieces = useMemo(makePieces, []);

  // 降り始めに合わせて粒を散らす。降り続けるあいだ鳴らし続けはしない
  // （マッチ制覇は一度きりの見せ場なので、頭だけ厚くすれば足りる）
  useEffect(() => sfx.moneyRain(), []);

  return (
    <div className="moneyRain" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className={`moneyRain__piece moneyRain__piece--${p.kind}`}
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
          {p.kind === "coin" ? (
            <svg viewBox="0 0 32 32">
              <circle cx="16" cy="16" r="15" fill="#c8a24a" />
              <circle cx="16" cy="16" r="15" fill="none" stroke="#8a6a1f" strokeWidth="1.5" />
              <circle cx="16" cy="16" r="10" fill="none" stroke="#eccd83" strokeWidth="1.2" />
              <text
                x="16"
                y="21"
                textAnchor="middle"
                fontSize="13"
                fontWeight="700"
                fill="#5c4512"
                fontFamily="Georgia, serif"
              >
                $
              </text>
            </svg>
          ) : (
            <svg viewBox="0 0 44 24">
              <rect x="0.75" y="0.75" width="42.5" height="22.5" rx="2" fill="#2f5d43" />
              <rect
                x="0.75"
                y="0.75"
                width="42.5"
                height="22.5"
                rx="2"
                fill="none"
                stroke="#1b3a29"
              />
              <rect x="4" y="4" width="36" height="16" fill="none" stroke="#5d8f6f" strokeWidth="0.8" />
              <circle cx="22" cy="12" r="5.5" fill="none" stroke="#8fc3a1" strokeWidth="1" />
              <text
                x="22"
                y="16"
                textAnchor="middle"
                fontSize="8"
                fontWeight="700"
                fill="#cfe8d8"
                fontFamily="Georgia, serif"
              >
                $
              </text>
            </svg>
          )}
        </span>
      ))}
    </div>
  );
}
