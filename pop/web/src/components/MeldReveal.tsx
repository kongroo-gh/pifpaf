// 上がった手札を役ごとに分けて見せる。
//
// **単機版とオンライン版で同じものを使う。** 以前は両方に同じものを写してあり、
// 片方だけ直すとラウンド結果の見え方がずれる状態だった。
//
// 分類は engine の `classifyAsMelds` に任せる（web側で役を判定しない原則）。

import type { Card, Wild } from "@pifpaf/engine";
import { classifyAsMelds } from "@pifpaf/engine";
import { useT } from "../i18n";
import { PlayingCard } from "./PlayingCard";

export function MeldReveal({ hand, wild }: { hand: Card[]; wild: Wild }) {
  const t = useT();
  const melds = classifyAsMelds(hand, wild);

  // 上がった手なら必ず分類できるはずだが、
  // 割り込みなどで余り札が付く形もあるので、駄目なら素の手札を並べる
  if (melds === null) {
    return (
      <div className="reveal">
        <p className="reveal__label">{t.result.revealLabel}</p>
        <div className="reveal__meld">
          {hand.map((c) => (
            <PlayingCard key={c.id} card={c} wild={wild} size="sm" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="reveal">
      <p className="reveal__label">
        {t.result.revealLabel}{" "}
        <span className="reveal__count">{t.result.revealCount(hand.length)}</span>
      </p>
      {melds.map((meld, i) => (
        <div className="reveal__group" key={i}>
          <span className="reveal__type">
            {meld.type === "TRINCA" ? t.result.trinca : t.result.sequence}
          </span>
          <div className="reveal__meld">
            {meld.cards.map((c) => (
              <PlayingCard key={c.id} card={c} wild={wild} size="sm" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
