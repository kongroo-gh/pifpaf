// 自分が撃たれるときの演出。
// リボルバーの影が画面外から入ってきて、こちらへ銃口を向けて撃つ。
//
// 生々しさは狙わず、影絵のシルエットと閃光だけで表す。血や傷は描かない。

import type { GunPhase } from "../game/useExecution";

export function GunShot({ phase }: { phase: GunPhase }) {
  if (phase === "HIDDEN") return null;

  const fired = phase === "FIRED";

  return (
    <div className={`gunShot ${fired ? "gunShot--fired" : "gunShot--aiming"}`} aria-hidden="true">
      {/* 閃光は銃身の先に出したいので、CSSで別に置かずSVGの中に入れる。
          こうすると反動で銃が動いても閃光がついてくる。
          viewBox を左に広げてあるのは、銃口より先に閃光を描く余白のため。 */}
      <svg className="gunShot__gun" viewBox="-150 -40 410 230">
        <defs>
          {/* 背景がほぼ黒なので、真っ黒の銃だと沈んで見えなくなる。
              上面を明るめの鋼色にして、輪郭にも淡い縁光を入れて浮かせる。 */}
          <linearGradient id="gunMetal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#cfc9c1" />
            <stop offset="26%" stopColor="#8b837c" />
            <stop offset="62%" stopColor="#443d39" />
            <stop offset="100%" stopColor="#171412" />
          </linearGradient>
          <linearGradient id="gunGrip" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7a4a30" />
            <stop offset="60%" stopColor="#4a2b1c" />
            <stop offset="100%" stopColor="#1d110b" />
          </linearGradient>
          <radialGradient id="flashCore">
            <stop offset="0%" stopColor="rgba(255,250,232,0.98)" />
            <stop offset="26%" stopColor="rgba(255,214,130,0.85)" />
            <stop offset="55%" stopColor="rgba(255,146,50,0.35)" />
            <stop offset="100%" stopColor="rgba(255,120,30,0)" />
          </radialGradient>
        </defs>

        <g fill="url(#gunMetal)" stroke="rgba(226,216,200,0.4)" strokeWidth="1.6">
          {/* 銃身 */}
          <path d="M8 56 L112 56 L112 76 L8 76 Z" />
          {/* 照星 */}
          <path d="M16 56 L24 56 L24 48 L18 48 Z" />
          {/* 排莢口の下側（銃身下のラグ） */}
          <path d="M20 76 L104 76 L104 84 L20 84 Z" opacity="0.85" />
          {/* シリンダー */}
          <rect x="110" y="48" width="46" height="42" rx="6" />
          {/* フレーム */}
          <path d="M154 52 L196 52 L196 84 L154 84 Z" />
          {/* 撃鉄 */}
          <path d="M188 52 L206 40 L214 46 L198 58 Z" />
          {/* トリガーガード */}
          <path
            d="M158 86 q18 26 40 8"
            fill="none"
            stroke="url(#gunMetal)"
            strokeWidth="9"
            strokeLinecap="round"
          />
          {/* 引き金 */}
          <path d="M170 86 L176 86 L174 100 L168 98 Z" />
        </g>

        {/* シリンダーの弾倉穴 */}
        <g fill="#000" opacity="0.55">
          <circle cx="124" cy="60" r="5" />
          <circle cx="142" cy="60" r="5" />
          <circle cx="133" cy="78" r="5" />
        </g>

        {/* グリップ */}
        <path
          d="M192 82 q22 6 26 34 q4 26 -18 30 q-22 4 -26 -22 q-3 -26 18 -42 Z"
          fill="url(#gunGrip)"
          stroke="rgba(226,216,200,0.32)"
          strokeWidth="1.6"
        />

        {/* 金属の反射 */}
        <path d="M14 58 L108 58 L108 62 L14 62 Z" fill="rgba(255,255,255,0.10)" />
        <rect x="114" y="51" width="38" height="4" fill="rgba(255,255,255,0.08)" rx="2" />

        {/* 銃口の閃光。銃身の先端（x=8, y=66）を中心に出す */}
        {fired && (
          <g className="gunShot__flash">
            <circle cx="8" cy="66" r="96" fill="url(#flashCore)" />
            {/* 放射状の火花 */}
            <g fill="rgba(255,246,214,0.9)">
              <path d="M8 66 L-118 44 L-30 66 L-118 88 Z" />
              <path d="M8 66 L-72 -6 L-16 56 L-56 96 Z" opacity="0.8" />
              <path d="M8 66 L-72 138 L-16 76 L-56 36 Z" opacity="0.8" />
            </g>
            <circle cx="8" cy="66" r="26" fill="rgba(255,252,240,0.95)" />
          </g>
        )}
      </svg>
    </div>
  );
}
