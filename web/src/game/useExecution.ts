// 決着後の「処刑」演出を進めるフック。純粋に見た目のタイミング管理だけを行う。
// 敗者を1人ずつ撃っていき、最後に判定を表示する。人間は最後に回して溜めを作る。

import { useEffect, useMemo, useState } from "react";
import { HUMAN } from "./useGame";

const PLAYER_COUNT = 4;
const FIRST_SHOT_DELAY = 700;
const SHOT_INTERVAL = 1050;
const FLASH_DURATION = 240;
const VERDICT_DELAY = 900;
/** 自分が撃たれる何ミリ秒前に銃を構え始めるか */
const AIM_LEAD = 750;

/** 自分に向けられた銃の状態。演出用。 */
export type GunPhase = "HIDDEN" | "AIMING" | "FIRED";

export interface ExecutionProgress {
  /** すでに撃たれた席 */
  eliminated: Set<number>;
  /** いま発砲された席（フラッシュ用。すぐ null に戻る） */
  firingAt: number | null;
  /** 全員撃ち終えて判定を出してよい状態か */
  verdictReady: boolean;
  /** 自分が撃たれるときだけ進む。銃を出す→撃つ */
  gunPhase: GunPhase;
}

export function useExecution(winner: number | null, active: boolean): ExecutionProgress {
  // 敗者の処刑順。CPUを先に片付け、人間が敗者なら最後に回す。
  const order = useMemo(() => {
    if (!active) return [];
    const losers: number[] = [];
    for (let i = 0; i < PLAYER_COUNT; i++) {
      if (i !== winner && i !== HUMAN) losers.push(i);
    }
    if (winner !== HUMAN && winner !== null) losers.push(HUMAN);
    // 山札切れの引き分け（winner===null）は誰も撃たれない
    return winner === null ? [] : losers;
  }, [winner, active]);

  const [shotCount, setShotCount] = useState(0);
  const [firingAt, setFiringAt] = useState<number | null>(null);
  const [verdictReady, setVerdictReady] = useState(false);
  const [gunPhase, setGunPhase] = useState<GunPhase>("HIDDEN");

  useEffect(() => {
    if (!active) {
      setShotCount(0);
      setFiringAt(null);
      setVerdictReady(false);
      setGunPhase("HIDDEN");
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

      // 自分の番だけ、少し手前から銃を構えさせて溜めを作る
      if (seat === HUMAN) {
        timers.push(setTimeout(() => setGunPhase("AIMING"), Math.max(0, at - AIM_LEAD)));
        timers.push(setTimeout(() => setGunPhase("FIRED"), at));
      }
    });

    const totalMs = FIRST_SHOT_DELAY + order.length * SHOT_INTERVAL + VERDICT_DELAY;
    timers.push(setTimeout(() => setVerdictReady(true), totalMs));

    return () => timers.forEach(clearTimeout);
  }, [active, order]);

  const eliminated = useMemo(
    () => new Set(order.slice(0, shotCount)),
    [order, shotCount]
  );

  return { eliminated, firingAt, verdictReady, gunPhase };
}
