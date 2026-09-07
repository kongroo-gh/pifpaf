// 相手1人分の席。手札は枚数だけ見せる（オンライン化時のマスク配信を意識した形）。
//
// **単機版とオンライン版で同じものを使う。** 席の中身は呼び出し側が組み立てて渡す
// （単機版は persona と i18n から、オンライン版は RoomSeat と SeatView から）。
// ここに persona を持ち込むと、オンライン版だけ別の見た目に育ってずれていく。

import { useT } from "../i18n";
import { CardBack } from "./PlayingCard";
import { ChipStack } from "./ChipStack";

export interface OpponentSeatProps {
  /** 席番号。演出が位置を実測するための data-seat に入る */
  seat: number;
  /** 表示名 */
  name: string;
  /** 名前の下の小さな行。単機版は肩書き、オンライン版はCPU／切断中 */
  title?: string;
  handCount: number;
  isActive: boolean;
  /** 残りチップ（掛け金）。0で破産 */
  chips: number;
  /** このラウンドで失ったチップ。結果表示中だけ渡す */
  lostChips?: number;
  /** このラウンドを降りたか */
  folded?: boolean;
  /** チップが尽きて脱落したか */
  eliminated: boolean;
  /** マッチ勝者か */
  survived: boolean;
  /** いま捨て札から札を受け取ったところか（飛んできた札の着地先） */
  receiving?: boolean;
}

export function OpponentSeat({
  seat,
  name,
  title = "",
  handCount,
  isActive,
  chips,
  lostChips,
  folded = false,
  eliminated,
  survived,
  receiving = false,
}: OpponentSeatProps) {
  const t = useT();
  const classes = [
    "seat",
    isActive ? "seat--active" : "",
    folded ? "seat--folded" : "",
    eliminated ? "seat--eliminated" : "",
    survived ? "seat--survived" : "",
    receiving ? "seat--receiving" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} data-seat={seat}>
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
        <div className="seat__name">{name}</div>
        {title !== "" && <div className="seat__title">{title}</div>}
      </div>

      <div className="seat__chips" aria-label={t.seat.chipsAria(chips)}>
        <ChipStack count={chips} />
        <span className="seat__chipCount">{chips}</span>
        {lostChips !== undefined && lostChips > 0 && (
          <span className="seat__chipLoss">−{lostChips}</span>
        )}
      </div>

      <div className="seat__cards" aria-label={t.seat.handAria(handCount)}>
        {Array.from({ length: Math.min(handCount, 10) }, (_, i) => (
          <span className="seat__cardSlot" key={i}>
            <CardBack />
          </span>
        ))}
        <span className="seat__count">{handCount}</span>
      </div>

      {isActive && <div className="seat__thinking">{t.seat.thinking}</div>}
      {folded && !eliminated && <div className="seat__foldTag">{t.seat.folded}</div>}
      {eliminated && <div className="seat__stamp">ELIMINADO</div>}
      {survived && <div className="seat__stamp seat__stamp--gold">SOBREVIVEU</div>}
    </div>
  );
}
