// 1枚のカードの見た目。ルール判定も操作も持たず、渡された情報を描くだけ。
//
// クリックやドラッグは呼び出し側（捨て札の山・手札）が外側の要素で受ける。
// ここを button にしてしまうと、無効化したときにポインタイベントが届かなくなり
// 「捨てられないが並べ替えはしたい」札が扱えなくなる。

import type { Card, Suit, Wild } from "@pifpaf/engine";
import { isWildCard } from "@pifpaf/engine";
import { useT } from "../i18n";
import type { Strings } from "../i18n";

export const SUIT_GLYPH: Record<Suit, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };
const RED_SUITS: Suit[] = ["H", "D"];

export interface PlayingCardProps {
  card: Card;
  /** このゲームのワイルド。一致するカードだけ金色で強調する（ランクとスートの両方が一致）。 */
  wild: Wild;
  selected?: boolean;
  /** いま捨て札から拾ったばかりで、この手番では捨てられない札 */
  locked?: boolean;
  size?: "sm" | "md";
}

/**
 * スクリーンリーダー向けの読み上げ文。外側の操作要素の aria-label にも使う。
 *
 * 記号（♠）ではなくスート名を読ませる。記号のままだと読み上げが言語によって
 * 崩れるうえ、無音になる環境もある。
 */
export function describeCard(card: Card, wild: Wild, t: Strings): string {
  const suit = t.card.suits[card.suit];
  return `${card.rank} ${suit}${isWildCard(card, wild) ? ` ${t.card.coringa}` : ""}`;
}

export function PlayingCard({
  card,
  wild,
  selected = false,
  locked = false,
  size = "md",
}: PlayingCardProps) {
  const t = useT();
  const isWild = isWildCard(card, wild);
  const isRed = RED_SUITS.includes(card.suit);
  const glyph = SUIT_GLYPH[card.suit];

  const classes = [
    "card",
    `card--${size}`,
    isRed ? "card--red" : "card--black",
    isWild ? "card--wild" : "",
    selected ? "card--selected" : "",
    locked ? "card--locked" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} aria-hidden="true">
      <span className="card__corner card__corner--tl">
        <span className="card__rank">{card.rank}</span>
        <span className="card__suit">{glyph}</span>
      </span>
      <span className="card__center">{glyph}</span>
      <span className="card__corner card__corner--br">
        <span className="card__rank">{card.rank}</span>
        <span className="card__suit">{glyph}</span>
      </span>
      {isWild && <span className="card__wildTag">CORINGA</span>}
      {locked && <span className="card__lockTag">{t.hand.lockTag}</span>}
    </div>
  );
}

/** 裏向きのカード。相手の手札・山札に使う。 */
export function CardBack({ size = "sm" }: { size?: "sm" | "md" }) {
  return <div className={`card card--back card--${size}`} aria-hidden="true" />;
}
