// 残ったほしの表示。重なったほしのかけらとして見せる。
// 枚数が多いときは重ねて詰める。

const MAX_SHOWN = 7;

export function ChipStack({ count, size = "sm" }: { count: number; size?: "sm" | "md" }) {
  const shown = Math.min(count, MAX_SHOWN);

  return (
    <span className={`chipStack chipStack--${size}`} aria-hidden="true">
      {Array.from({ length: shown }, (_, i) => (
        <span key={i} className="chipStack__chip" style={{ ["--i" as string]: i }} />
      ))}
      {count === 0 && <span className="chipStack__empty">—</span>}
    </span>
  );
}
