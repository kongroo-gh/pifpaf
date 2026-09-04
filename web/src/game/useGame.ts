// ゲーム進行のReactフック。
// タイマー・状態保持・localStorage といった「副作用」はすべてこの層に閉じ込め、
// engine側は純粋なまま保つ（CLAUDE.mdの設計方針）。
//
// マッチ（複数ラウンド）の勘定は engine/match.ts が持つ。ここはその進行役。

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  dealGame,
  createInitialState,
  applyAction,
  findBaterAction,
  decideAction,
  shouldFold,
  isWildCard,
  currentActor,
  createMatch,
  settleRound,
  walkoverWinner,
  alivePlayers,
  isAlive,
  payoutMultiplier,
  payoutBreakdown,
  DEFAULT_CHIPS,
  type Card,
  type GameState,
  type MatchState,
  type RoundResult,
  type RoundSettlement,
} from "@pifpaf/engine";

export const HUMAN = 0;
const PLAYER_COUNT = 4;

/**
 * CPUの思考待ち。人間が盤面を追えるようにわざと間を置く。
 * 「ふつう」で1手番（引く＋捨てる）がおよそ2秒になるように取ってある。
 */
const CPU_DRAW_DELAY = 900;
const CPU_DISCARD_DELAY = 1100;
/** 割り込みで拾って上がるまでの間。一瞬で終わると何が起きたか分からない。 */
const CPU_INTERCEPT_DELAY = 1200;

export type Speed = "FAST" | "NORMAL" | "SLOW";

/** 設定画面に並べる順。速い順に左から。 */
export const SPEEDS: Speed[] = ["FAST", "NORMAL", "SLOW"];
/** 待ち時間にかける倍率 */
const SPEED_FACTOR: Record<Speed, number> = { FAST: 0.5, NORMAL: 1, SLOW: 2 };
// 表示名は i18n の辞書（t.speed）が持つ。ここは種別だけを扱う。
const SPEED_KEY = "pifpaf.speed";

/** 所持金まわり */
const BANKROLL_KEY = "pifpaf.bankroll";
export const STARTING_BANKROLL = 1000;
/** 所持金が尽きたときに借りられる額（マフィアからの借金） */
export const LOAN_AMOUNT = 500;

export type Screen =
  | "INTRO"
  | "BETTING"
  /** 配札の演出中。engineの配り終えた結果を再生しているだけで、進行は止めている */
  | "DEALING"
  | "FOLD"
  | "PLAYING"
  | "ROUND_RESULT"
  | "MATCH_OVER";

function loadSpeed(): Speed {
  try {
    const raw = window.localStorage.getItem(SPEED_KEY);
    return raw === "FAST" || raw === "SLOW" || raw === "NORMAL" ? raw : "NORMAL";
  } catch {
    return "NORMAL";
  }
}

function loadBankroll(): number {
  try {
    const raw = window.localStorage.getItem(BANKROLL_KEY);
    const n = raw === null ? NaN : Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : STARTING_BANKROLL;
  } catch {
    // プライベートウィンドウなどで localStorage が使えないことがある
    return STARTING_BANKROLL;
  }
}

function saveBankroll(v: number): void {
  try {
    window.localStorage.setItem(BANKROLL_KEY, String(v));
  } catch {
    // 保存できなくても進行には影響しない
  }
}

/**
 * 開発時だけ、終了演出をすぐ確認するための細工。`?scene=win` / `?scene=lose`。
 * `import.meta.env.DEV` で囲ってあるので本番ビルドからは消える。
 */
function devScene(): "win" | "lose" | null {
  if (!import.meta.env.DEV) return null;
  const s = new URLSearchParams(window.location.search).get("scene");
  return s === "win" || s === "lose" ? s : null;
}

export function useGame() {
  const [screen, setScreen] = useState<Screen>("INTRO");
  const [bankroll, setBankroll] = useState<number>(loadBankroll);
  const [speed, setSpeedState] = useState<Speed>(loadSpeed);
  const [wager, setWager] = useState(0);

  const [match, setMatch] = useState<MatchState>(() => createMatch(PLAYER_COUNT, DEFAULT_CHIPS));
  const [state, setState] = useState<GameState>(() => createInitialState(dealGame(PLAYER_COUNT)));
  /** このラウンドで「降りる」を選んだ席（脱落者とは別に持つ） */
  const [foldedSeats, setFoldedSeats] = useState<boolean[]>(() =>
    Array.from({ length: PLAYER_COUNT }, () => false)
  );
  const [settlement, setSettlement] = useState<RoundSettlement | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  /** 配り直すたびに増える。手札の表示順をリセットする合図に使う。 */
  const [gameId, setGameId] = useState(0);
  /** 配当倍率（マッチ制覇時のみ）。0 なら負け。 */
  const [payout, setPayout] = useState(0);
  /**
   * 捨て札から札が持っていかれたことを見せるための控え。
   * 誰がどの札を取ったのか、盤面の数字が変わるだけでは追えないので、
   * 札が飛んでいく演出に使う。idは同じ札が続けて取られたときの作り直し用。
   */
  const [pickup, setPickup] = useState<{ card: Card; seat: number; id: number } | null>(null);
  const pickupId = useRef(0);
  /** 配札の演出が終わったあとに進む画面 */
  const afterDealing = useRef<Screen>("FOLD");
  /** 演出の途中でヴィラを伏せておくための印。めくる瞬間に true になる */
  const [viraRevealed, setViraRevealed] = useState(true);

  const notePickup = useCallback((card: Card | undefined, seat: number) => {
    if (card === undefined) return;
    pickupId.current += 1;
    setPickup({ card, seat, id: pickupId.current });
  }, []);

  const clearPickup = useCallback(() => setPickup(null), []);

  /** CPUの速度を決める（対局中でも変えられる）。設定画面から直接選ぶ */
  const setSpeed = useCallback((next: Speed) => {
    setSpeedState(next);
    try {
      window.localStorage.setItem(SPEED_KEY, next);
    } catch {
      // 保存できなくても進行には影響しない
    }
  }, []);

  const persistBankroll = useCallback((v: number) => {
    setBankroll(v);
    saveBankroll(v);
  }, []);

  // ---- ラウンドの開始 -------------------------------------------------

  /**
   * 新しいラウンドを配る。
   * 脱落者は「降りた者」と同じ扱いで手番を飛ばす（席番号を保つため）。
   * 親（一番手＝ヴィラを買える席）はラウンドごとに回す。
   */
  const beginRound = useCallback((m: MatchState) => {
    const deal = dealGame(PLAYER_COUNT);
    const dead = deal.hands.map((_, i) => !isAlive(m, i));

    // CPUは手札を見て降りるかを決める。人間はこのあと画面で選ぶ。
    const cpuFold = deal.hands.map((hand, i) =>
      i === HUMAN || dead[i] ? false : shouldFold(hand, deal.wild)
    );

    const dealer = (m.round - 1) % PLAYER_COUNT;
    setMatch(m);
    setFoldedSeats(cpuFold);
    setState(createInitialState(deal, dealer, dead));
    setSelectedCardId(null);
    setGameId((n) => n + 1);
    setSettlement(null);
    afterDealing.current = isAlive(m, HUMAN) ? "FOLD" : "PLAYING";
    setViraRevealed(false);
    setScreen("DEALING");
  }, []);

  /** 配札の演出が終わった。ここから実際の手番が始まる。 */
  const finishDealing = useCallback(() => {
    setViraRevealed(true);
    setScreen(afterDealing.current);
  }, []);

  /** 演出の途中、ヴィラをめくった瞬間に呼ぶ */
  const revealVira = useCallback(() => setViraRevealed(true), []);

  /** 掛け金を決めてマッチ開始 */
  const startMatch = useCallback(
    (amount: number) => {
      const bet = Math.min(amount, bankroll);
      persistBankroll(bankroll - bet);
      setWager(bet);
      setPayout(0);
      beginRound(createMatch(PLAYER_COUNT, DEFAULT_CHIPS));
    },
    [bankroll, beginRound, persistBankroll]
  );

  /** 人間の「降りる／勝負する」の選択。ここでラウンドが動き出す。 */
  const decideFold = useCallback(
    (fold: boolean) => {
      setFoldedSeats((prev) => {
        const next = [...prev];
        next[HUMAN] = fold;
        setState((s) => {
          const skip = s.folded.map((f, i) => f || next[i] === true);
          // 降りた席は手番を飛ばすので、開始席も生きている席へ寄せ直す
          const starter = skip[s.currentPlayer]
            ? skip.findIndex((f) => !f)
            : s.currentPlayer;
          return { ...s, folded: skip, currentPlayer: starter === -1 ? s.currentPlayer : starter };
        });
        return next;
      });
      setScreen("PLAYING");
    },
    []
  );

  // ---- ラウンドの決着 -------------------------------------------------

  /**
   * @param played 実際に打って決着したか。不戦勝（全員降りて1人だけ残った）なら false。
   *   打っていないラウンドで手札のワイルドを「使った」と数えると、
   *   何もしていないのに配当が0.75倍になってしまう。
   */
  const finishRound = useCallback(
    (finished: GameState, played = true) => {
      const winner = finished.winner;
      const hand = played && winner !== null ? (finished.hands[winner] ?? []) : [];
      const result: RoundResult = {
        winner,
        baterCom10: hand.length === 10,
        usedWild: hand.some((c) => isWildCard(c, finished.wild)),
        // 「降りた」のは、生きていて自分の意思で降りた席だけ
        folded: foldedSeats
          .map((f, i) => (f && isAlive(match, i) ? i : -1))
          .filter((i) => i >= 0),
      };

      const s = settleRound(match, result);
      setSettlement(s);
      setMatch(s.state);

      if (s.state.winner !== null || !isAlive(s.state, HUMAN)) {
        // マッチ決着（自分が勝ったか、自分が破産したか）
        const mult = s.state.winner === HUMAN ? payoutMultiplier(s.state, HUMAN) : 0;
        setPayout(mult);
        if (mult > 0) persistBankroll(bankroll + Math.round(wager * mult));
      }
      setScreen("ROUND_RESULT");
    },
    [foldedSeats, match, bankroll, wager, persistBankroll]
  );

  /** 結果画面から次へ。決着していればマッチ終了画面、でなければ次ラウンド。 */
  const advance = useCallback(() => {
    if (settlement === null) return;
    const m = settlement.state;
    if (m.winner !== null || !isAlive(m, HUMAN)) {
      setScreen("MATCH_OVER");
    } else {
      beginRound(m);
    }
  }, [settlement, beginRound]);

  /** マッチ終了後、卓に戻る */
  const backToTable = useCallback(() => {
    setScreen(bankroll <= 0 ? "INTRO" : "BETTING");
  }, [bankroll]);

  /** 掛け金を決めるのをやめて、入口へ戻る。まだ何も賭けていないので後始末は要らない */
  const leaveTable = useCallback(() => setScreen("INTRO"), []);

  /** 所持金が尽きたときの借金 */
  const takeLoan = useCallback(() => {
    persistBankroll(bankroll + LOAN_AMOUNT);
    setScreen("BETTING");
  }, [bankroll, persistBankroll]);

  const sitDown = useCallback(() => {
    const scene = devScene();
    if (scene !== null) {
      // 開発用：即決着させて演出だけ見る
      const m = createMatch(PLAYER_COUNT, DEFAULT_CHIPS);
      const forced: MatchState = {
        ...m,
        chips: scene === "win" ? [3, 0, 0, 0] : [0, 3, 0, 0],
        winner: scene === "win" ? HUMAN : 1,
        maxStreak: [2, 1, 0, 0],
        lastWinClean: scene === "win",
      };
      setWager(100);
      setMatch(forced);
      setSettlement({ losses: [0, 0, 0, 0], eliminated: [], state: forced });
      setPayout(scene === "win" ? payoutMultiplier(forced, HUMAN) : 0);
      setScreen("MATCH_OVER");
      return;
    }
    setScreen("BETTING");
  }, []);

  // ---- 人間の操作 -----------------------------------------------------

  const dispatch = useCallback((action: Parameters<typeof applyAction>[1]) => {
    setState((current) => {
      const result = applyAction(current, action);
      if (!result.ok) return current;
      return result.state;
    });
    setSelectedCardId(null);
  }, []);

  const drawCard = useCallback(() => dispatch({ type: "DRAW", from: "STOCK" }), [dispatch]);
  const takeDiscard = useCallback(() => {
    notePickup(state.discard[state.discard.length - 1], HUMAN);
    dispatch({ type: "DRAW", from: "DISCARD" });
  }, [dispatch, notePickup, state.discard]);
  const takeVira = useCallback(() => dispatch({ type: "TAKE_VIRA" }), [dispatch]);
  const keepPending = useCallback(() => dispatch({ type: "KEEP" }), [dispatch]);
  const rejectPending = useCallback(() => dispatch({ type: "REJECT" }), [dispatch]);

  /** 手番外で捨て札を拾って上がる */
  const intercept = useCallback(() => {
    notePickup(state.discard[state.discard.length - 1], HUMAN);
    dispatch({ type: "INTERCEPT" });
  }, [dispatch, notePickup, state.discard]);
  /** 割り込まずに見送る */
  const passIntercept = useCallback(() => dispatch({ type: "PASS_INTERCEPT" }), [dispatch]);

  const discardSelected = useCallback(() => {
    if (selectedCardId === null) return;
    dispatch({ type: "DISCARD", cardId: selectedCardId });
  }, [dispatch, selectedCardId]);

  const humanHand = state.hands[HUMAN] ?? [];
  const humanFolded = foldedSeats[HUMAN] === true;
  // 割り込みの局面では手番の持ち主ではなく、割り込みを判断している人が行動主体
  const actor = currentActor(state);
  const isHumanTurn =
    state.currentPlayer === HUMAN &&
    state.phase !== "ROUND_OVER" &&
    state.phase !== "AWAITING_INTERCEPT" &&
    !humanFolded;
  /** 自分に割り込みの順番が回ってきているか */
  const canIntercept =
    screen === "PLAYING" && state.phase === "AWAITING_INTERCEPT" && actor === HUMAN;

  const topDiscard = state.discard[state.discard.length - 1];
  const canTakeDiscard =
    isHumanTurn && state.phase === "AWAITING_DRAW" && topDiscard !== undefined;
  const isFirstTurn = isHumanTurn && state.phase === "AWAITING_FIRST_DRAW";
  const canTakeVira = isFirstTurn && state.vira !== null;
  const isDecidingKeep =
    isHumanTurn && state.phase === "AWAITING_KEEP_DECISION" && state.pendingCard !== null;
  const canDrawStock =
    isHumanTurn && (state.phase === "AWAITING_DRAW" || state.phase === "AWAITING_FIRST_DRAW");

  const humanBater =
    isHumanTurn && state.phase === "AWAITING_DISCARD"
      ? findBaterAction(humanHand, state.wild)
      : null;

  /** 生存している席。毎描画で新しい配列を作ると、これを依存に持つ演出が作り直される。 */
  const aliveSeats = useMemo(() => alivePlayers(match), [match]);

  const callBater = useCallback(() => {
    if (humanBater === null) return;
    dispatch(humanBater);
  }, [dispatch, humanBater]);

  // ---- 自動進行 -------------------------------------------------------

  /**
   * 卓に残っているのが CPU だけになったラウンドは、**見せずに結果まで飛ばす。**
   * （2026-09-04・ユーザー指示）
   * 降りた（あるいは脱落した）あとは、待たされるだけで手を出せる場面はもう来ない。
   *
   * 1手ずつ state を更新すると盤面が高速で瞬くので、決着までを1回の更新にまとめる。
   * 札が飛ぶ演出も鳴らさない。見せないと決めた対戦の途中経過なので。
   */
  useEffect(() => {
    if (screen !== "PLAYING") return;
    // state.folded は「降りた」と「脱落した」の両方が立つ。どちらでも同じこと
    if (!state.folded[HUMAN]) return;
    if (state.phase === "ROUND_OVER") return;
    // 勝負する者が1人以下なら不戦勝。下の効果が畳むので、ここで打たせない
    if (walkoverWinner(match, state.folded).decided) return;

    let next = state;
    // 打ち切りの保険。engine 側で決着するはずだが、無限には回さない
    for (let i = 0; i < 500 && next.phase !== "ROUND_OVER"; i += 1) {
      const action = decideAction(next);
      if (action === null) break;
      const result = applyAction(next, action);
      if (!result.ok) break;
      next = result.state;
    }
    if (next !== state) setState(next);
  }, [screen, state, match]);

  // CPUの手番を1手ずつ進める
  useEffect(() => {
    if (screen !== "PLAYING") return;
    if (state.phase === "ROUND_OVER") return;
    // 自分が抜けた卓は上の効果が一気に畳む。ここで1手ずつ進めると二重に打つ
    if (state.folded[HUMAN]) return;
    // 割り込みの局面では判断者が、それ以外は手番の持ち主が行動する
    const acting = currentActor(state);
    if (acting === HUMAN) return;

    const base =
      state.phase === "AWAITING_INTERCEPT"
        ? CPU_INTERCEPT_DELAY
        : state.phase === "AWAITING_DISCARD"
          ? CPU_DISCARD_DELAY
          : CPU_DRAW_DELAY;
    const delay = base * SPEED_FACTOR[speed];
    const timer = setTimeout(() => {
      const action = decideAction(state);
      if (action === null) return;
      // 捨て札から取る手なら、飛ばす札と受け手を控えてから適用する
      const takesFromDiscard =
        (action.type === "DRAW" && action.from === "DISCARD") || action.type === "INTERCEPT";
      const taken = takesFromDiscard ? state.discard[state.discard.length - 1] : undefined;

      const result = applyAction(state, action);
      if (!result.ok) return;
      if (taken !== undefined) notePickup(taken, acting);
      setState(result.state);
    }, delay);

    return () => clearTimeout(timer);
  }, [screen, state, speed, notePickup]);

  // ラウンドが決着したら勘定する
  useEffect(() => {
    if (screen !== "PLAYING") return;
    if (state.phase !== "ROUND_OVER") return;
    const timer = setTimeout(() => finishRound(state), 900);
    return () => clearTimeout(timer);
  }, [screen, state, finishRound]);

  // 降りた結果、勝負する者が1人以下になったラウンドは成立しない。
  // 判定は engine の walkoverWinner に任せる（server 側と同じ規則を使う）
  useEffect(() => {
    if (screen !== "PLAYING") return;
    if (state.phase === "ROUND_OVER") return;

    const walkover = walkoverWinner(match, state.folded);
    if (!walkover.decided) return;

    const timer = setTimeout(() => {
      // 打っていないので played=false。10枚上がりもワイルド使用も数えない
      finishRound({ ...state, phase: "ROUND_OVER", winner: walkover.winner }, false);
    }, 700);
    return () => clearTimeout(timer);
  }, [screen, state, match, finishRound]);

  return {
    screen,
    state,
    match,
    settlement,
    bankroll,
    wager,
    payout,
    payoutDetail: match.winner === HUMAN ? payoutBreakdown(match, HUMAN) : null,
    gameId,
    humanHand,
    humanFolded,
    foldedSeats,
    isHumanTurn,
    canIntercept,
    pickup,
    clearPickup,
    viraRevealed,
    revealVira,
    finishDealing,
    humanBater,
    speed,
    setSpeed,
    topDiscard,
    canTakeDiscard,
    canDrawStock,
    isFirstTurn,
    canTakeVira,
    isDecidingKeep,
    selectedCardId,
    setSelectedCardId,
    aliveSeats,
    sitDown,
    startMatch,
    decideFold,
    advance,
    backToTable,
    leaveTable,
    takeLoan,
    drawCard,
    takeDiscard,
    takeVira,
    keepPending,
    rejectPending,
    discardSelected,
    callBater,
    intercept,
    passIntercept,
  };
}
