// 手札の「表示順」を持つフック。
//
// engine はカードをIDでしか見ないので、並び順を変えてもルールには一切影響しない。
// だから並び順は web 側だけの関心事として、ここで持つ。

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { rankIndex, type Card } from "@pifpaf/engine";

const SUIT_ORDER = ["S", "H", "D", "C"];

/** スート順→ランク順。初期配置と「整列」ボタンで使う。 */
export function sortedIds(cards: Card[]): string[] {
  return [...cards]
    .sort((a, b) => {
      const suitDiff = SUIT_ORDER.indexOf(a.suit) - SUIT_ORDER.indexOf(b.suit);
      if (suitDiff !== 0) return suitDiff;
      return rankIndex(a.rank) - rankIndex(b.rank);
    })
    .map((c) => c.id);
}

/**
 * @param gameId 配り直しのたびに変わる値。
 *   カードIDは "S-7-d1" のようにデッキ内で固定なので、配り直しても前の手札と
 *   IDが重なることがある。「IDが残っている＝手札に残った札」と見なす差分判定は
 *   その場合に誤作動して初期整列が効かなくなるため、局の切り替わりは別で受け取る。
 */
export function useHandOrder(hand: Card[], gameId: number) {
  const [order, setOrder] = useState<string[]>(() => sortedIds(hand));
  const lastGameId = useRef(gameId);

  // 手札の中身が変わったら差分だけ反映する。
  // 並べ替えた結果を引くたびに壊さないよう、残っている札の順序はそのまま保つ。
  const handKey = hand.map((c) => c.id).join(",");
  useEffect(() => {
    // 新しい局なら、前の並びは引き継がずに整列した状態から始める
    if (lastGameId.current !== gameId) {
      lastGameId.current = gameId;
      setOrder(sortedIds(hand));
      return;
    }

    setOrder((prev) => {
      const present = new Set(hand.map((c) => c.id));
      const kept = prev.filter((id) => present.has(id));
      const keptSet = new Set(kept);
      const addedCards = hand.filter((c) => !keptSet.has(c.id));

      // 引いた／拾った1枚は末尾に足すほうが目で追いやすい
      if (kept.length === 0) return sortedIds(addedCards);
      return [...kept, ...addedCards.map((c) => c.id)];
    });
    // handKey で中身の変化だけを見る（配列の参照は毎回変わるため）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handKey, gameId]);

  const ordered = useMemo(() => {
    const byId = new Map(hand.map((c) => [c.id, c]));
    const list = order.map((id) => byId.get(id)).filter((c): c is Card => c !== undefined);
    // orderの更新がまだ走っていない描画では取りこぼしが出るので、漏れた札を足す
    if (list.length !== hand.length) {
      const shown = new Set(list.map((c) => c.id));
      return [...list, ...hand.filter((c) => !shown.has(c.id))];
    }
    return list;
  }, [hand, order]);

  const reorder = useCallback((ids: string[]) => setOrder(ids), []);
  const sort = useCallback(() => setOrder(sortedIds(hand)), [hand]);

  return { ordered, reorder, sort };
}
