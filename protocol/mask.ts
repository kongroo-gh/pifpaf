// 盤面を席ごとに削る。
//
// 純粋関数。サーバーが配信の直前に必ず通す。
// クライアントには import できてしまうが、削る前の状態が手に入らないので害はない。
// ここを共有側に置いてあるのは、**web 側で「何が見えるはず」かを型で示すため**。

import type { GameState, MatchState, Card } from "@pifpaf/engine";
import { currentActor } from "@pifpaf/engine";
import type { PlayerView, PublicGameState, SeatView } from "./view";

/**
 * `seat` の視点にマスクする。
 *
 * @param revealedSeat ラウンドが終わって手札を公開する席。進行中は null。
 *   engine の `state.winner` をそのまま使わないのは、決着なしで終わった場合や
 *   公開したくない中断の場合を呼び出し側で決められるようにするため。
 */
export function maskFor(
  seat: number,
  state: GameState,
  match: MatchState,
  revealedSeat: number | null = null
): PlayerView {
  const seats: SeatView[] = state.hands.map((hand, i) => ({
    seat: i,
    handCount: hand.length,
    chips: match.chips[i] ?? 0,
    folded: state.folded[i] === true,
    out: (match.chips[i] ?? 0) <= 0,
  }));

  const revealed =
    revealedSeat === null
      ? null
      : { seat: revealedSeat, cards: copy(state.hands[revealedSeat] ?? []) };

  const game: PublicGameState = {
    hand: copy(state.hands[seat] ?? []),
    seats,
    stockCount: state.stock.length,
    discardCount: state.discard.length,
    // 表向きなのは一番上の1枚だけ。下は伏せたまま
    topDiscard: last(state.discard),
    currentPlayer: state.currentPlayer,
    actor: currentActor(state),
    wild: { ...state.wild },
    phase: state.phase,
    winner: state.winner,
    takenFromDiscard: state.takenFromDiscard,
    vira: state.vira === null ? null : { ...state.vira },
    // 採否を決めている札は本人にだけ。断られた札が何だったか他人に漏らさない
    pendingCard: state.currentPlayer === seat && state.pendingCard !== null
      ? { ...state.pendingCard }
      : null,
    interceptQueue: [...state.interceptQueue],
    revealedHand: revealed,
  };

  return { you: seat, game, match: cloneMatch(match) };
}

/**
 * 観戦者（席を持たない接続）向け。手札はどこも見せない。
 * ロビーで待っている人や、脱落後に見ている人に使う。
 */
export function maskForSpectator(
  state: GameState,
  match: MatchState,
  revealedSeat: number | null = null
): PlayerView {
  // 存在しない席を渡すと hand が空になる。観戦はそれでよい
  const view = maskFor(-1, state, match, revealedSeat);
  return { ...view, you: -1 };
}

function copy(cards: Card[]): Card[] {
  return cards.map((c) => ({ ...c }));
}

function last(cards: Card[]): Card | null {
  const c = cards[cards.length - 1];
  return c === undefined ? null : { ...c };
}

function cloneMatch(match: MatchState): MatchState {
  return {
    ...match,
    chips: [...match.chips],
    maxStreak: [...match.maxStreak],
  };
}
