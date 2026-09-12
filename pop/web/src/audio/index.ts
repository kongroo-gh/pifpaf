// 音の公開窓口。画面はここ経由でのみ音に触る。
//
// **画面に「鳴らせるか」を判断させない。** 消音中でも操作前でも `sfx.card()` は
// 呼んでよく、鳴らないだけ。条件を呼ぶ側に持たせると、同じ判定が画面の数だけ増える。

import { useEffect } from "react";
import { useSyncExternalStore } from "react";
import {
  armUnlock,
  setSoundEnabled,
  soundEnabled,
  soundUnlocked,
  subscribeSound,
} from "./context";
import { ambienceWanted, startAmbience, stopAmbience } from "./ambience";

export * as sfx from "./sfx";
export { startAmbience, stopAmbience };

/**
 * 最初の操作で音を解禁する。**アプリ全体で一度だけ**呼ぶ。
 * 解禁の時点で環境音が求められていたなら、そこで鳴らし始める。
 */
export function useSoundUnlock(): void {
  useEffect(() => {
    const disarm = armUnlock();
    const stop = subscribeSound(() => {
      if (soundUnlocked() && ambienceWanted()) startAmbience();
    });
    return () => {
      disarm();
      stop();
    };
  }, []);
}

/**
 * 画面が出ているあいだ環境音を流す。
 * 卓に着いたら止めたいので、鳴らす側の画面がこれを持つ。
 */
export function useAmbience(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    startAmbience();
    return () => stopAmbience();
  }, [active]);
}

export interface SoundControl {
  enabled: boolean;
  setEnabled: (on: boolean) => void;
}

/** 設定の切り替え用。 */
export function useSoundControl(): SoundControl {
  const enabled = useSyncExternalStore(subscribeSound, soundEnabled, () => true);
  return { enabled, setEnabled: setSoundEnabled };
}
