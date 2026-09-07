import { describe, it, expect } from "vitest";
import {
  createMatch,
  settleRound,
  alivePlayers,
  contenders,
  walkoverWinner,
  isAlive,
  payoutMultiplier,
  payoutBreakdown,
  LOSS_PLAY,
  LOSS_FOLD,
  LOSS_COM10,
} from "./match.ts";
import type { RoundResult } from "./match.ts";

const round = (over: Partial<RoundResult> = {}): RoundResult => ({
  winner: 0,
  baterCom10: false,
  usedWild: false,
  folded: [],
  ...over,
});

describe("失点", () => {
  it("勝った者以外が2点ずつ失う", () => {
    const m = createMatch(4, 7);
    const s = settleRound(m, round({ winner: 1 }));
    expect(s.losses).toEqual([LOSS_PLAY, 0, LOSS_PLAY, LOSS_PLAY]);
    expect(s.state.chips).toEqual([5, 7, 5, 5]);
  });

  it("10枚上がりを食らうと3点", () => {
    const m = createMatch(4, 7);
    const s = settleRound(m, round({ winner: 1, baterCom10: true }));
    expect(s.losses).toEqual([LOSS_COM10, 0, LOSS_COM10, LOSS_COM10]);
  });

  it("降りていれば1点で済む（10枚上がりを食らっても軽い）", () => {
    const m = createMatch(4, 7);
    const s = settleRound(m, round({ winner: 1, baterCom10: true, folded: [2] }));
    expect(s.losses).toEqual([LOSS_COM10, 0, LOSS_FOLD, LOSS_COM10]);
  });

  it("誰も上がらなかったラウンドは失点なし", () => {
    const m = createMatch(4, 7);
    const s = settleRound(m, round({ winner: null }));
    expect(s.losses).toEqual([0, 0, 0, 0]);
    expect(s.state.chips).toEqual([7, 7, 7, 7]);
  });

  it("チップは0未満にならない", () => {
    let m = createMatch(4, 1);
    const s = settleRound(m, round({ winner: 0 }));
    expect(s.state.chips).toEqual([1, 0, 0, 0]);
  });
});

describe("脱落と決着", () => {
  it("0になった者が脱落し、生存者から外れる", () => {
    let m = createMatch(4, 2);
    const s = settleRound(m, round({ winner: 0 }));
    expect(s.eliminated.sort()).toEqual([1, 2, 3]);
    expect(alivePlayers(s.state)).toEqual([0]);
    expect(isAlive(s.state, 1)).toBe(false);
  });

  it("最後の1人が残ったらマッチ勝者が決まる", () => {
    let m = createMatch(4, 2);
    const s = settleRound(m, round({ winner: 0 }));
    expect(s.state.winner).toBe(0);
  });

  it("2人以上残っていれば決着しない", () => {
    const m = createMatch(4, 7);
    const s = settleRound(m, round({ winner: 0 }));
    expect(s.state.winner).toBeNull();
  });

  it("すでに脱落した者は追加で失点しない", () => {
    let m = createMatch(4, 2);
    m = settleRound(m, round({ winner: 0 })).state; // 1,2,3が脱落
    const s = settleRound(m, round({ winner: 0 }));
    expect(s.losses).toEqual([0, 0, 0, 0]);
  });
});

describe("連勝", () => {
  it("同じ人が連取すると伸び、別の人が取ると切れる", () => {
    let m = createMatch(4, 20);
    m = settleRound(m, round({ winner: 0 })).state;
    expect(m.streak).toBe(1);
    m = settleRound(m, round({ winner: 0 })).state;
    expect(m.streak).toBe(2);
    m = settleRound(m, round({ winner: 1 })).state;
    expect(m.streak).toBe(1);
    // 最大値は残る
    expect(m.maxStreak[0]).toBe(2);
  });
});

describe("配当", () => {
  function winnerWith(chipsLeft: number, maxStreak: number, clean: boolean) {
    return {
      chips: [chipsLeft, 0, 0, 0],
      round: 5,
      lastWinner: 0,
      streak: maxStreak,
      maxStreak: [maxStreak, 0, 0, 0],
      winner: 0,
      lastWinClean: clean,
    };
  }

  it("残りチップが多いほど高い", () => {
    const low = payoutMultiplier(winnerWith(1, 1, true), 0);
    const high = payoutMultiplier(winnerWith(7, 1, true), 0);
    expect(high).toBeGreaterThan(low);
  });

  it("ワイルドを使った上がりは配当が下がる", () => {
    const clean = payoutMultiplier(winnerWith(3, 1, true), 0);
    const wild = payoutMultiplier(winnerWith(3, 1, false), 0);
    expect(wild).toBeLessThan(clean);
    expect(wild).toBeCloseTo(clean * 0.75, 2);
  });

  it("連勝すると上乗せされ、上限で頭打ちになる", () => {
    const one = payoutMultiplier(winnerWith(3, 1, true), 0);
    const three = payoutMultiplier(winnerWith(3, 3, true), 0);
    const ten = payoutMultiplier(winnerWith(3, 10, true), 0);
    expect(three).toBeGreaterThan(one);
    expect(ten).toBeCloseTo(one + 1.2, 2); // 上限 +1.2
  });

  it("実効レンジは約2.0〜5.7倍に収まる", () => {
    const worst = payoutMultiplier(winnerWith(1, 1, false), 0);
    const best = payoutMultiplier(winnerWith(7, 10, true), 0);
    expect(worst).toBeCloseTo(2.03, 1);
    expect(best).toBeCloseTo(5.7, 1);
  });

  it("内訳の合計が倍率と一致する", () => {
    const m = winnerWith(4, 3, false);
    const b = payoutBreakdown(m, 0);
    expect((b.base + b.streakBonus) * b.wildCoef).toBeCloseTo(b.total, 2);
  });
});

describe("walkoverWinner（降りて1人以下になったラウンド）", () => {
  it("1人だけ残ったらその人の不戦勝", () => {
    const m = createMatch(4);
    expect(walkoverWinner(m, [true, false, true, true])).toEqual({ decided: true, winner: 1 });
  });

  it("全員降りたら決着なし", () => {
    const m = createMatch(4);
    expect(walkoverWinner(m, [true, true, true, true])).toEqual({ decided: true, winner: null });
  });

  it("2人以上残っていれば普通に打つ", () => {
    const m = createMatch(4);
    expect(walkoverWinner(m, [true, false, false, true])).toEqual({ decided: false });
  });

  // 脱落者は「降りた」扱いをしなくても勘定に入らない
  it("脱落した席は数に入らない", () => {
    const m = { ...createMatch(4), chips: [0, 0, 5, 5] };
    expect(walkoverWinner(m, [false, false, true, false])).toEqual({ decided: true, winner: 3 });
  });

  it("生きている2人がどちらも降りていなければ打つ", () => {
    const m = { ...createMatch(4), chips: [0, 0, 5, 5] };
    expect(walkoverWinner(m, [false, false, false, false])).toEqual({ decided: false });
  });
});

describe("contenders", () => {
  it("生きていて降りていない席だけ返す", () => {
    const m = { ...createMatch(4), chips: [3, 0, 4, 2] };
    expect(contenders(m, [false, false, true, false])).toEqual([0, 3]);
  });
});
