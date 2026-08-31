// 「破産した者が撃たれる」演出のタイミング管理。純粋に見た目の話だけ。
//
// ポイント制にしたことで、撃たれるのは毎ラウンドではなく
// チップが尽きて脱落した瞬間だけになった。そのぶん一発が重い。

import { useEffect, useMemo, useState } from "react";
import { HUMAN } from "./useGame";

const FIRST_SHOT_DELAY = 650;
const SHOT_INTERVAL = 1000;
const FLASH_DURATION = 240;
const DONE_DELAY = 800;

export interface ExecutionProgress {
  /** すでに撃たれた席 */
  shot: Set<number>;
  /** いま発砲された席（フラッシュ用。すぐ null に戻る） */
  firingAt: number | null;
  /** 一連の処刑が終わったか */
  done: boolean;
}

/**
 * @param seats 撃たれる席（このラウンドで破産した者）。自分は最後に回して溜めを作る。
 * @param active 演出を走らせるか
 */
export function useExecution(seats: number[], active: boolean): ExecutionProgress {
  // 自分が含まれるなら最後に回す
  const order = useMemo(() => {
    if (!active) return [];
    const others = seats.filter((s) => s !== HUMAN);
    return seats.includes(HUMAN) ? [...others, HUMAN] : others;
  }, [seats, active]);

  const [shotCount, setShotCount] = useState(0);
  const [firingAt, setFiringAt] = useState<number | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!active) {
      setShotCount(0);
      setFiringAt(null);
      setDone(false);
      return;
    }

    // 誰も脱落していないラウンドは、すぐ次へ進めてよい
    if (order.length === 0) {
      setDone(true);
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];

    order.forEach((seat, i) => {
      const at = FIRST_SHOT_DELAY + i * SHOT_INTERVAL;
      timers.push(
        setTimeout(() => {
          setFiringAt(seat);
          setShotCount(i + 1);
        }, at)
      );
      timers.push(setTimeout(() => setFiringAt(null), at + FLASH_DURATION));
    });

    const totalMs = FIRST_SHOT_DELAY + order.length * SHOT_INTERVAL + DONE_DELAY;
    timers.push(setTimeout(() => setDone(true), totalMs));

    return () => timers.forEach(clearTimeout);
  }, [active, order]);

  const shot = useMemo(() => new Set(order.slice(0, shotCount)), [order, shotCount]);

  return { shot, firingAt, done };
}
