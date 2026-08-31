// 1枚のカードの見た目。ルール判定は一切持たず、渡された情報を描くだけ。

import type { Card, Rank, Suit } from "@pifpaf/engine";

const SUIT_GLYPH: Record<Suit, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };
const RED_SUITS: Suit[] = ["H", "D"];

export interface PlayingCardProps {
  card: Card;
  /** このゲームのワイルドランク。一致するカードは金色で強調する。 */
  wildRank: Rank;
  selected?: boolean;
  disabled?: boolean;
  /** いま捨て札から拾ったばかりで、この手番では捨てられない札 */
  locked?: boolean;
  size?: "sm" | "md";
  onClick?: (card: Card) => void;
}

export function PlayingCard({
  card,
  wildRank,
  selected = false,
  disabled = false,
  locked = false,
  size = "md",
  onClick,
}: PlayingCardProps) {
  const isWild = card.rank === wildRank;
  const isRed = RED_SUITS.includes(card.suit);
  const glyph = SUIT_GLYPH[card.suit];

  const classes = [
    "card",
    `card--${size}`,
    isRed ? "card--red" : "card--black",
    isWild ? "card--wild" : "",
    selected ? "card--selected" : "",
    locked ? "card--locked" : "",
    onClick && !disabled && !locked ? "card--clickable" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={classes}
      disabled={disabled || locked || !onClick}
      onClick={onClick && !locked ? () => onClick(card) : undefined}
      aria-label={
        `${card.rank} ${glyph}` +
        (isWild ? " コリンガ" : "") +
        (locked ? " 拾ったばかりで捨てられない" : "")
      }
    >
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
      {locked && <span className="card__lockTag" aria-hidden="true">拾</span>}
    </button>
  );
}

/** 裏向きのカード。相手の手札・山札に使う。 */
export function CardBack({ size = "sm" }: { size?: "sm" | "md" }) {
  return <div className={`card card--back card--${size}`} aria-hidden="true" />;
}
