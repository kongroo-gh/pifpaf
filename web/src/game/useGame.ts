// ゲーム進行のReactフック。
// タイマー・状態保持といった「副作用」はすべてこの層に閉じ込め、
// engine側は純粋なまま保つ（CLAUDE.mdの設計方針）。

import { useCallback, useEffect, useRef, useState } from "react";
import {
  dealGame,
  createInitialState,
  applyAction,
  findBaterAction,
  decideAction,
  type GameState,
} from "@pifpaf/engine";

export const HUMAN = 0;
const PLAYER_COUNT = 4;

/** CPUの思考待ち時間（ミリ秒）。人間が盤面を追えるようにわざと間を置く。 */
const CPU_DRAW_DELAY = 900;
const CPU_DISCARD_DELAY = 1100;

export type Screen = "INTRO" | "PLAYING" | "EXECUTION";

export interface GameLog {
  id: number;
  text: string;
}

export function useGame() {
  const [screen, setScreen] = useState<Screen>("INTRO");
  const [state, setState] = useState<GameState>(() => createInitialState(dealGame(PLAYER_COUNT)));
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  /** 配り直すたびに増える。手札の表示順をリセットする合図に使う。 */
  const [gameId, setGameId] = useState(0);
  const [logs, setLogs] = useState<GameLog[]>([]);
  const logId = useRef(0);

  const pushLog = useCallback((text: string) => {
    logId.current += 1;
    const entry = { id: logId.current, text };
    setLogs((prev) => [...prev.slice(-5), entry]);
  }, []);

  /** 新しい1ゲームを開始する（ワンゲームマッチなので毎回配り直し） */
  const startGame = useCallback(() => {
    const deal = dealGame(PLAYER_COUNT);
    setState(createInitialState(deal, HUMAN));
    setSelectedCardId(null);
    setLogs([]);
    logId.current = 0;
    setGameId((n) => n + 1);
    setScreen("PLAYING");
  }, []);

  /** 人間側の操作。engineが弾いた場合は状態を変えない。 */
  const dispatch = useCallback(
    (action: Parameters<typeof applyAction>[1]) => {
      setState((current) => {
        const result = applyAction(current, action);
        if (!result.ok) return current;
        return result.state;
      });
      setSelectedCardId(null);
    },
    []
  );

  const drawCard = useCallback(() => dispatch({ type: "DRAW", from: "STOCK" }), [dispatch]);

  /** 前のプレイヤーが捨てた札（捨て札の一番上）を拾う */
  const takeDiscard = useCallback(() => dispatch({ type: "DRAW", from: "DISCARD" }), [dispatch]);

  /** 一番手の特権：場のヴィラを買う */
  const takeVira = useCallback(() => dispatch({ type: "TAKE_VIRA" }), [dispatch]);

  /** 見せられた札を手札に入れる */
  const keepPending = useCallback(() => dispatch({ type: "KEEP" }), [dispatch]);

  /** 見せられた札を手札に入れず捨て、山札から引き直す */
  const rejectPending = useCallback(() => dispatch({ type: "REJECT" }), [dispatch]);

  const discardSelected = useCallback(() => {
    if (selectedCardId === null) return;
    dispatch({ type: "DISCARD", cardId: selectedCardId });
  }, [dispatch, selectedCardId]);

  const humanHand = state.hands[HUMAN] ?? [];
  const isHumanTurn = state.currentPlayer === HUMAN && state.phase !== "ROUND_OVER";

  const topDiscard = state.discard[state.discard.length - 1];
  /** 捨て札を拾えるか。拾えるのは一番上の1枚だけ。 */
  const canTakeDiscard =
    isHumanTurn && state.phase === "AWAITING_DRAW" && topDiscard !== undefined;

  /** 一番手の最初の手番か（ヴィラを買える／引いた札を選び直せる） */
  const isFirstTurn = isHumanTurn && state.phase === "AWAITING_FIRST_DRAW";
  const canTakeVira = isFirstTurn && state.vira !== null;
  /** 引いた札の採否を訊いている最中か */
  const isDecidingKeep =
    isHumanTurn && state.phase === "AWAITING_KEEP_DECISION" && state.pendingCard !== null;

  /** 山札を引けるか（通常の手番でも、一番手の最初の手番でも引ける） */
  const canDrawStock =
    isHumanTurn && (state.phase === "AWAITING_DRAW" || state.phase === "AWAITING_FIRST_DRAW");

  /** 人間が今バテル（上がり）できるか。判定はengineに任せる。 */
  const humanBater =
    isHumanTurn && state.phase === "AWAITING_DISCARD"
      ? findBaterAction(humanHand, state.wild)
      : null;

  const callBater = useCallback(() => {
    if (humanBater === null) return;
    dispatch(humanBater);
  }, [dispatch, humanBater]);

  // CPUの手番を自動で進める。1手ずつタイマーを挟んで見せる。
  useEffect(() => {
    if (screen !== "PLAYING") return;
    if (state.phase === "ROUND_OVER") return;
    if (state.currentPlayer === HUMAN) return;

    const delay = state.phase === "AWAITING_DRAW" ? CPU_DRAW_DELAY : CPU_DISCARD_DELAY;
    const timer = setTimeout(() => {
      const action = decideAction(state);
      if (action === null) return;
      const result = applyAction(state, action);
      if (!result.ok) return;
      setState(result.state);
    }, delay);

    return () => clearTimeout(timer);
  }, [screen, state]);

  // ラウンド決着後、少し溜めてから「処刑」画面へ移す。
  useEffect(() => {
    if (screen !== "PLAYING") return;
    if (state.phase !== "ROUND_OVER") return;
    const timer = setTimeout(() => setScreen("EXECUTION"), 1200);
    return () => clearTimeout(timer);
  }, [screen, state.phase]);

  return {
    screen,
    state,
    gameId,
    logs,
    humanHand,
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
    pushLog,
    startGame,
    drawCard,
    takeDiscard,
    takeVira,
    keepPending,
    rejectPending,
    discardSelected,
    callBater,
  };
}
