// ゲーム進行のReactフック。
// タイマー・状態保持・localStorage といった「副作用」はすべてこの層に閉じ込め、
// engine側は純粋なまま保つ（CLAUDE.mdの設計方針）。
//
// マッチ（複数ラウンド）の勘定は engine/match.ts が持つ。ここはその進行役。

import { useCallback, useEffect, useRef, useState } from "react";
import {
  dealGame,
  createInitialState,
  applyAction,
  findBaterAction,
  decideAction,
  shouldFold,
  isWildCard,
  createMatch,
  settleRound,
  alivePlayers,
  isAlive,
  payoutMultiplier,
  payoutBreakdown,
  DEFAULT_CHIPS,
  type GameState,
  type MatchState,
  type RoundResult,
  type RoundSettlement,
} from "@pifpaf/engine";

export const HUMAN = 0;
const PLAYER_COUNT = 4;

/** CPUの思考待ち時間（ミリ秒）。人間が盤面を追えるようにわざと間を置く。 */
const CPU_DRAW_DELAY = 900;
const CPU_DISCARD_DELAY = 1100;

/** 所持金まわり */
const BANKROLL_KEY = "pifpaf.bankroll";
export const STARTING_BANKROLL = 1000;
/** 所持金が尽きたときに借りられる額（マフィアからの借金） */
export const LOAN_AMOUNT = 500;

export type Screen =
  | "INTRO"
  | "BETTING"
  | "FOLD"
  | "PLAYING"
  | "ROUND_RESULT"
  | "MATCH_OVER";

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
    setScreen(isAlive(m, HUMAN) ? "FOLD" : "PLAYING");
  }, []);

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

  const finishRound = useCallback(
    (finished: GameState) => {
      const winner = finished.winner;
      const hand = winner === null ? [] : (finished.hands[winner] ?? []);
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
  const takeDiscard = useCallback(() => dispatch({ type: "DRAW", from: "DISCARD" }), [dispatch]);
  const takeVira = useCallback(() => dispatch({ type: "TAKE_VIRA" }), [dispatch]);
  const keepPending = useCallback(() => dispatch({ type: "KEEP" }), [dispatch]);
  const rejectPending = useCallback(() => dispatch({ type: "REJECT" }), [dispatch]);

  const discardSelected = useCallback(() => {
    if (selectedCardId === null) return;
    dispatch({ type: "DISCARD", cardId: selectedCardId });
  }, [dispatch, selectedCardId]);

  const humanHand = state.hands[HUMAN] ?? [];
  const humanFolded = foldedSeats[HUMAN] === true;
  const isHumanTurn =
    state.currentPlayer === HUMAN && state.phase !== "ROUND_OVER" && !humanFolded;

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

  const callBater = useCallback(() => {
    if (humanBater === null) return;
    dispatch(humanBater);
  }, [dispatch, humanBater]);

  // ---- 自動進行 -------------------------------------------------------

  // CPUの手番を1手ずつ進める
  useEffect(() => {
    if (screen !== "PLAYING") return;
    if (state.phase === "ROUND_OVER") return;
    if (state.currentPlayer === HUMAN && !humanFolded) return;

    const delay = state.phase === "AWAITING_DISCARD" ? CPU_DISCARD_DELAY : CPU_DRAW_DELAY;
    const timer = setTimeout(() => {
      const action = decideAction(state);
      if (action === null) return;
      const result = applyAction(state, action);
      if (!result.ok) return;
      setState(result.state);
    }, delay);

    return () => clearTimeout(timer);
  }, [screen, state, humanFolded]);

  // ラウンドが決着したら勘定する
  useEffect(() => {
    if (screen !== "PLAYING") return;
    if (state.phase !== "ROUND_OVER") return;
    const timer = setTimeout(() => finishRound(state), 900);
    return () => clearTimeout(timer);
  }, [screen, state, finishRound]);

  // 全員が降りて勝負する者がいない場合、ラウンドは成立しない
  useEffect(() => {
    if (screen !== "PLAYING") return;
    if (state.phase === "ROUND_OVER") return;
    const contenders = state.folded.filter((f) => !f).length;
    if (contenders > 1) return;
    const timer = setTimeout(() => {
      const lone = state.folded.findIndex((f) => !f);
      finishRound({ ...state, phase: "ROUND_OVER", winner: lone === -1 ? null : lone });
    }, 700);
    return () => clearTimeout(timer);
  }, [screen, state, finishRound]);

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
    humanBater,
    topDiscard,
    canTakeDiscard,
    canDrawStock,
    isFirstTurn,
    canTakeVira,
    isDecidingKeep,
    selectedCardId,
    setSelectedCardId,
    aliveSeats: alivePlayers(match),
    sitDown,
    startMatch,
    decideFold,
    advance,
    backToTable,
    takeLoan,
    drawCard,
    takeDiscard,
    takeVira,
    keepPending,
    rejectPending,
    discardSelected,
    callBater,
  };
}
