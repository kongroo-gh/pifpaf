// Pif Paf ルールエンジン - マッチ（複数ラウンド）の管理
//
// 本家 Cacheta の方式にならう。点を稼ぐのではなく「命（vidas）を減らす」形で、
// 0 になった者から脱落し、最後に残った1人がマッチ勝者。
// この実装では命をチップ（掛け金）として見せる。
//
// 他のengineモジュールと同じく副作用ゼロ・UI非依存。

/** 勝負して負けたときの失点 */
export const LOSS_PLAY = 2;
/** 降りたときの失点。勝負するより軽いぶん、勝つ権利も失う */
export const LOSS_FOLD = 1;
/** 10枚上がり（bater com 10）を食らったときの失点 */
export const LOSS_COM10 = 3;

/** 初期チップ。Cachetaの標準は7か10。7で約6ラウンド＝4〜5分。 */
export const DEFAULT_CHIPS = 7;

/**
 * 残りチップごとの基本配当。
 *
 * 4人卓なので勝率は約25%。寺銭が約25%に収まるよう、20万回のマッチ模擬で
 * 合わせ込んである（平均配当3.1倍／期待値0.76）。
 * 勝つときは残り1〜2枚で終わることが6割なので、低い側を厚くしてある。
 * 無傷（7枚）勝ちは1%未満で、実質はジャックポット枠。
 */
const BASE_PAYOUT: Record<number, number> = {
  1: 2.7,
  2: 3.0,
  3: 3.3,
  4: 3.6,
  5: 3.9,
  6: 4.2,
  7: 4.5,
};

/** 2連勝目から1連勝ごとに加算される配当 */
const STREAK_STEP = 0.4;
/** 連勝ボーナスの上限 */
const STREAK_CAP = 1.2;
/**
 * 決め手にワイルドを使っていた場合の係数。
 * ワイルド無しの上がり（bater limpo）のほうが難しいので、そちらを厚くする。
 * 勝ち手の約53%にワイルドが入るため、これは稀な例外ではなくほぼ半々で効く。
 */
const WILD_COEF = 0.75;

export interface MatchState {
  /** 各プレイヤーの残りチップ。0で脱落 */
  chips: number[];
  /** 何ラウンド目か（1始まり） */
  round: number;
  /** 直前のラウンドを取ったプレイヤー（連勝判定用） */
  lastWinner: number | null;
  /** 現在の連勝数 */
  streak: number;
  /** 各プレイヤーのこのマッチでの最大連勝 */
  maxStreak: number[];
  /** マッチ勝者。決着していなければ null */
  winner: number | null;
  /** 決め手のラウンドでワイルドを使わずに上がったか */
  lastWinClean: boolean;
}

/** 1ラウンドの結果。誰がどう上がったかだけを持つ。 */
export interface RoundResult {
  /** 上がったプレイヤー。山札切れなどで決着しなければ null */
  winner: number | null;
  /** 10枚で上がったか */
  baterCom10: boolean;
  /** 上がり手にワイルドが含まれていたか */
  usedWild: boolean;
  /** このラウンドを降りていたプレイヤー */
  folded: number[];
}

export interface RoundSettlement {
  /** losses[player] = このラウンドで失ったチップ */
  losses: number[];
  /** このラウンドで脱落したプレイヤー */
  eliminated: number[];
  state: MatchState;
}

export function createMatch(playerCount: number, startingChips = DEFAULT_CHIPS): MatchState {
  return {
    chips: Array.from({ length: playerCount }, () => startingChips),
    round: 1,
    lastWinner: null,
    streak: 0,
    maxStreak: Array.from({ length: playerCount }, () => 0),
    winner: null,
    lastWinClean: false,
  };
}

export function isAlive(match: MatchState, player: number): boolean {
  return (match.chips[player] ?? 0) > 0;
}

export function alivePlayers(match: MatchState): number[] {
  return match.chips.map((_, i) => i).filter((i) => isAlive(match, i));
}

/**
 * そのラウンドを実際に打つ席。生きていて、かつ降りていない者。
 *
 * @param folded 添字が席番号。自分の意思で降りたか
 */
export function contenders(match: MatchState, folded: boolean[]): number[] {
  return alivePlayers(match).filter((p) => folded[p] !== true);
}

/**
 * 降りた結果、打つ人が1人以下になったラウンドの決着。
 *
 * - 1人だけ残ったら**その人の不戦勝**。誰も相手がいないのだから、
 *   最後まで打たせる意味がない（実際、1人では上がれないまま山が尽きるだけ）
 * - 0人なら決着なし
 * - 2人以上いるなら null を返す。普通に打つ
 *
 * この判定を web と server の両方が持つと必ずずれるので、engine に置く。
 */
export function walkoverWinner(
  match: MatchState,
  folded: boolean[]
): { decided: true; winner: number | null } | { decided: false } {
  const left = contenders(match, folded);
  if (left.length === 1) return { decided: true, winner: left[0]! };
  if (left.length === 0) return { decided: true, winner: null };
  return { decided: false };
}

/**
 * ラウンドの結果をマッチに反映する。
 * 上がった者以外が失点し、0になった者が脱落する。
 */
export function settleRound(match: MatchState, result: RoundResult): RoundSettlement {
  const alive = alivePlayers(match);
  const folded = new Set(result.folded);
  const losses = match.chips.map(() => 0);

  for (const p of alive) {
    if (p === result.winner) continue;
    if (folded.has(p)) {
      losses[p] = LOSS_FOLD;
    } else if (result.winner === null) {
      // 誰も上がらなかったラウンドは失点なし
      losses[p] = 0;
    } else {
      losses[p] = result.baterCom10 ? LOSS_COM10 : LOSS_PLAY;
    }
  }

  const chips = match.chips.map((c, i) => Math.max(0, c - (losses[i] ?? 0)));
  const eliminated = alive.filter((p) => (chips[p] ?? 0) === 0);

  // 連勝の更新
  const sameAsLast = result.winner !== null && result.winner === match.lastWinner;
  const streak = result.winner === null ? 0 : sameAsLast ? match.streak + 1 : 1;
  const maxStreak = [...match.maxStreak];
  if (result.winner !== null) {
    maxStreak[result.winner] = Math.max(maxStreak[result.winner] ?? 0, streak);
  }

  const stillAlive = chips.map((_, i) => i).filter((i) => (chips[i] ?? 0) > 0);

  return {
    losses,
    eliminated,
    state: {
      chips,
      round: match.round + 1,
      lastWinner: result.winner,
      streak,
      maxStreak,
      winner: stillAlive.length === 1 ? (stillAlive[0] ?? null) : null,
      lastWinClean: result.winner === null ? match.lastWinClean : !result.usedWild,
    },
  };
}

/**
 * マッチ制覇時の配当倍率。
 *   （残りチップの基本配当 + 連勝ボーナス）× ワイルド係数
 * 実効レンジは約2.0〜5.7倍、中央3.0倍。
 */
export function payoutMultiplier(match: MatchState, player: number): number {
  const chips = Math.max(1, Math.min(7, match.chips[player] ?? 1));
  const base = BASE_PAYOUT[chips] ?? 2.7;
  const bonus = Math.min(STREAK_CAP, Math.max(0, (match.maxStreak[player] ?? 0) - 1) * STREAK_STEP);
  const coef = match.lastWinClean ? 1 : WILD_COEF;
  // 表示とズレないよう小数2桁に丸める
  return Math.round((base + bonus) * coef * 100) / 100;
}

/** 配当の内訳。UIで「なぜこの倍率か」を見せるために使う。 */
export function payoutBreakdown(match: MatchState, player: number) {
  const chips = Math.max(1, Math.min(7, match.chips[player] ?? 1));
  return {
    chipsLeft: chips,
    base: BASE_PAYOUT[chips] ?? 2.7,
    streak: match.maxStreak[player] ?? 0,
    streakBonus:
      Math.min(STREAK_CAP, Math.max(0, (match.maxStreak[player] ?? 0) - 1) * STREAK_STEP),
    clean: match.lastWinClean,
    wildCoef: match.lastWinClean ? 1 : WILD_COEF,
    total: payoutMultiplier(match, player),
  };
}
