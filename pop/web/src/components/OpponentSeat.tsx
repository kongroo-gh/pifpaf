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
        {/* 席ごとの顔と姿勢。人物画は装飾で、CPU／接続表示には触れない。 */}
        <svg className="seat__person" data-person={seat % 6} viewBox="0 0 100 100" focusable="false">
          <ellipse cx="50" cy="91" rx="43" ry="7" fill="#080e0b" opacity=".45" />
          <path d="M13 88 18 65Q22 55 39 54L61 54Q78 56 82 67L88 89Z" fill="var(--jacket, #425c65)" stroke="#172322" strokeWidth="2" />
          <path d="m39 54 11 26 11-26-11 5Z" fill="#e9deca" />
          <path d="m48 63-3 13 5 10 5-10-3-13Z" fill="var(--tie, #963e38)" />
          <path d="m38 55-8 9 10 4-4 8 14 12m12-33 8 9-10 4 4 8-14 12" fill="none" stroke="#bdc3ae" strokeOpacity=".4" strokeWidth="2" />
          <g className="seat__face">
            <path d="M43 43h14v15q-7 7-14 0Z" fill="var(--skin, #c98e69)" />
            <ellipse cx="32" cy="32" rx="4" ry="7" fill="var(--skin, #c98e69)" />
            <ellipse cx="68" cy="32" rx="4" ry="7" fill="var(--skin, #c98e69)" />
            <path d="M32 23Q32 7 50 7T68 23L65 41Q61 52 50 53 39 52 35 41Z" fill="var(--skin, #c98e69)" />
            <path d={seat % 2 === 0 ? "M31 28Q24 8 45 5q29-4 25 27l-6-12q-15 5-26-3l-3 12Z" : "M31 29Q27 7 47 6q26-2 22 25l-7-14Q48 29 35 21l1 10Z"} fill="var(--hair, #302b29)" />
            <path d="m39 30 6-1m11 0 6 1" stroke="#473229" strokeWidth="2" strokeLinecap="round" />
            <g className="seat__eyes" fill="#262626"><ellipse cx="42" cy="33" rx="1.7" ry="2" /><ellipse cx="59" cy="33" rx="1.7" ry="2" /></g>
            <path d="m50 33-2 6 4 1m-9 5q7 4 14-1" fill="none" stroke="#805442" strokeWidth="1.5" strokeLinecap="round" />
            {seat % 3 === 0 && <path d="M36 31h11v8H36Zm18 0h11v8H54Zm-7 3h7" fill="none" stroke="#ded2b0" strokeWidth="1.6" />}
            {seat % 3 === 1 && <path d="M41 43q5-7 10-2 5-5 10 2-6 3-10 0-5 3-10 0" fill="var(--hair, #302b29)" />}
          </g>
          <g className="seat__hands" fill="var(--skin, #c98e69)" stroke="#815541" strokeWidth="1">
            <path d="m17 79 19 3q10-7 16-2l-8 5q7-2 7 2-3 5-14 3l-21-2Z" />
            <path d="m83 79-16 3q-8-8-14-3l6 6q-7-2-7 2 3 5 14 3l18-2Z" />
          </g>
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
