// 残ったチップの印。枚数は呼び出し側が横に数値で示すため、図像は常に1枚。

export function ChipStack({ count, size = "sm" }: { count: number; size?: "sm" | "md" }) {
  return (
    <span className={`chipStack chipStack--${size} ${count === 0 ? "chipStack--empty" : ""}`} aria-hidden="true">
      <span className="chipStack__chip" />
    </span>
  );
}
