// 銃痕の装飾。演出専用のSVG。
// 生々しさは狙わず、紙に穴が空いたような記号的な表現にとどめる。

export interface BulletHoleProps {
  /** 親要素に対する位置（%） */
  top: string;
  left: string;
  size?: number;
  delay?: number;
}

export function BulletHole({ top, left, size = 26, delay = 0 }: BulletHoleProps) {
  return (
    <svg
      className="bulletHole"
      style={{ top, left, width: size, height: size, animationDelay: `${delay}ms` }}
      viewBox="0 0 40 40"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={`bh-${top}-${left}`}>
          <stop offset="0%" stopColor="#000" />
          <stop offset="55%" stopColor="#140b09" />
          <stop offset="100%" stopColor="rgba(60,30,20,0)" />
        </radialGradient>
      </defs>
      {/* ひび割れ */}
      <g stroke="rgba(20,10,8,0.55)" strokeWidth="1.4" fill="none">
        <path d="M20 20 L31 9" />
        <path d="M20 20 L34 24" />
        <path d="M20 20 L11 32" />
        <path d="M20 20 L6 15" />
        <path d="M20 20 L23 35" />
      </g>
      <circle cx="20" cy="20" r="11" fill={`url(#bh-${top}-${left})`} />
      <circle cx="20" cy="20" r="6.5" fill="#070403" />
      <circle cx="18.5" cy="18.5" r="2.2" fill="rgba(255,255,255,0.06)" />
    </svg>
  );
}

/** 座席や画面に散らす銃痕のまとまり */
export function BulletHoleCluster() {
  return (
    <>
      <BulletHole top="18%" left="22%" size={30} delay={0} />
      <BulletHole top="46%" left="63%" size={22} delay={90} />
      <BulletHole top="68%" left="34%" size={26} delay={170} />
    </>
  );
}
