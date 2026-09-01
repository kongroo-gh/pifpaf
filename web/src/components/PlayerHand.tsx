// 自分の手札。ドラッグで自由に並べ替えられる。
//
// HTML5 の drag-and-drop は iOS Safari で動かないので、Pointer Events で自前で組む。
// これならマウスでもタッチでも同じ経路で扱える。
//
// 並び順はあくまで見た目の話で、engine には一切渡さない（engineはIDでしか見ない）。

import { useRef, useState } from "react";
import type { Card, Wild } from "@pifpaf/engine";
import { PlayingCard, describeCard } from "./PlayingCard";
import { useT } from "../i18n";

/** これ以上動いたらタップではなくドラッグとみなす（px） */
const DRAG_THRESHOLD = 8;

export interface PlayerHandProps {
  cards: Card[];
  wild: Wild;
  selectedCardId: string | null;
  /** 拾ったばかりで捨てられない札 */
  lockedCardId: string | null;
  /** 今このタイミングで札を選べるか（捨てる場面かどうか） */
  selectable: boolean;
  onSelect: (id: string | null) => void;
  onReorder: (orderedIds: string[]) => void;
}

export function PlayerHand({
  cards,
  wild,
  selectedCardId,
  lockedCardId,
  selectable,
  onSelect,
  onReorder,
}: PlayerHandProps) {
  const t = useT();
  const containerRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; startX: number; startY: number; moved: boolean } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  /** 指／カーソルの位置に最も近いカードの位置を返す。2段に折り返しても効くよう2次元で測る。 */
  function nearestIndex(x: number, y: number): number {
    const container = containerRef.current;
    if (container === null) return -1;

    let best = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    const slots = container.querySelectorAll<HTMLElement>("[data-card-id]");
    slots.forEach((slot, i) => {
      const r = slot.getBoundingClientRect();
      const distance = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    });
    return best;
  }

  function handlePointerDown(e: React.PointerEvent, card: Card) {
    drag.current = { id: card.id, startX: e.clientX, startY: e.clientY, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (d === null) return;

    if (!d.moved) {
      const moved = Math.hypot(e.clientX - d.startX, e.clientY - d.startY);
      if (moved < DRAG_THRESHOLD) return; // まだタップかもしれない
      d.moved = true;
      setDraggingId(d.id);
    }

    const from = cards.findIndex((c) => c.id === d.id);
    const to = nearestIndex(e.clientX, e.clientY);
    if (from === -1 || to === -1 || to === from) return;

    const ids = cards.map((c) => c.id);
    const [moving] = ids.splice(from, 1);
    ids.splice(to, 0, moving!);
    onReorder(ids);
  }

  function handlePointerUp() {
    const d = drag.current;
    drag.current = null;
    setDraggingId(null);
    // 動かさずに離したならタップ扱い＝選択のトグル
    if (d !== null && !d.moved && selectable && d.id !== lockedCardId) {
      onSelect(d.id === selectedCardId ? null : d.id);
    }
  }

  /** キーボード操作。ポインタ経路とは別に、Enter / Space で選択できるようにする。 */
  function handleKeyDown(e: React.KeyboardEvent, card: Card) {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    if (!selectable || card.id === lockedCardId) return;
    onSelect(card.id === selectedCardId ? null : card.id);
  }

  return (
    <div className="hand" ref={containerRef}>
      {cards.map((card, index) => {
        const locked = card.id === lockedCardId;
        return (
          <button
            type="button"
            key={card.id}
            data-card-id={card.id}
            className={`hand__slot ${draggingId === card.id ? "hand__slot--dragging" : ""}`}
            style={{ ["--i" as string]: index }}
            aria-label={t.hand.cardAria(describeCard(card, wild, t), locked)}
            aria-pressed={selectedCardId === card.id}
            onPointerDown={(e) => handlePointerDown(e, card)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onKeyDown={(e) => handleKeyDown(e, card)}
          >
            <PlayingCard
              card={card}
              wild={wild}
              selected={selectedCardId === card.id}
              locked={locked}
            />
          </button>
        );
      })}
    </div>
  );
}
