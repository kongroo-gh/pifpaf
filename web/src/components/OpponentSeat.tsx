// CPU1人分の席。手札は枚数だけ見せる（オンライン化時のマスク配信を意識した形）。

import type { Persona } from "../game/players";
import { CardBack } from "./PlayingCard";
import { BulletHoleCluster } from "./BulletHole";
import { ChipStack } from "./ChipStack";

export interface OpponentSeatProps {
  persona: Persona;
  handCount: number;
  isActive: boolean;
  /** 残りチップ（掛け金）。0で破産 */
  chips: number;
  /** このラウンドで失ったチップ。結果表示中だけ渡す */
  lostChips?: number;
  /** このラウンドを降りたか */
  folded?: boolean;
  /** 破産して「撃たれた」状態か */
  eliminated: boolean;
  /** マッチ勝者か */
  survived: boolean;
  /** 発砲の瞬間だけ true にしてフラッシュさせる */
  firing: boolean;
}

export function OpponentSeat({
  persona,
  handCount,
  isActive,
  chips,
  lostChips,
  folded = false,
  eliminated,
  survived,
  firing,
}: OpponentSeatProps) {
  const classes = [
    "seat",
    isActive ? "seat--active" : "",
    folded ? "seat--folded" : "",
    eliminated ? "seat--eliminated" : "",
    survived ? "seat--survived" : "",
    firing ? "seat--firing" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes}>
      <div className="seat__avatar" aria-hidden="true">
        {/* 中折れ帽のシルエット */}
        <svg viewBox="0 0 64 64">
          <path
            d="M12 44c0-2 3-4 8-5 1-9 4-16 12-16s11 7 12 16c5 1 8 3 8 5 0 3-9 5-20 5s-20-2-20-5z"
            fill="currentColor"
          />
          <ellipse cx="32" cy="44" rx="21" ry="4.5" fill="currentColor" opacity="0.75" />
        </svg>
      </div>

      <div className="seat__info">
        <div className="seat__name">{persona.name}</div>
        <div className="seat__title">{persona.title}</div>
      </div>

      <div className="seat__chips" aria-label={`残りチップ ${chips}`}>
        <ChipStack count={chips} />
        <span className="seat__chipCount">{chips}</span>
        {lostChips !== undefined && lostChips > 0 && (
          <span className="seat__chipLoss">−{lostChips}</span>
        )}
      </div>

      <div className="seat__cards" aria-label={`手札 ${handCount}枚`}>
        {Array.from({ length: Math.min(handCount, 10) }, (_, i) => (
          <span className="seat__cardSlot" key={i}>
            <CardBack />
          </span>
        ))}
        <span className="seat__count">{handCount}</span>
      </div>

      {isActive && <div className="seat__thinking">…考えている</div>}
      {folded && !eliminated && <div className="seat__foldTag">降りた</div>}
      {eliminated && (
        <>
          <BulletHoleCluster />
          <div className="seat__stamp">ELIMINADO</div>
        </>
      )}
      {survived && <div className="seat__stamp seat__stamp--gold">SOBREVIVEU</div>}
    </div>
  );
}
