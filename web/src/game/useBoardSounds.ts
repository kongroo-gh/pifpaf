// 盤面の変化から音を鳴らす。
//
// **ボタンには配線しない。** 押した側だけ鳴らすと、CPU や相手が引いて捨てる音が
// 鳴らず、卓に自分しかいないように聞こえる。それに単機版とオンライン版で
// 同じ配線を2組持つことになり、片方だけ増えてずれていく。
//
// 代わりに、どちらの版も持っている数（山札・捨て札の枚数、自分の番か、
// 上がった席）だけを受け取って、その差分で鳴らす。何が起きたかは数で分かる。
//
// ルール判定はしない。ここが間違っても進行には影響しない。

import { useEffect, useRef } from "react";
import { sfx } from "../audio";

export interface BoardSnapshot {
  /** 札が動いてよい場面か。配札の演出中や結果表示中は false */
  live: boolean;
  stockCount: number;
  discardCount: number;
  /** いま自分の番か */
  myTurn: boolean;
  /** 上がった席。決着していなければ null */
  winner: number | null;
  /** 自分の席。上がったのが自分かどうかで音を変えるのに使う */
  mySeat: number;
}

export function useBoardSounds(now: BoardSnapshot): void {
  const prev = useRef<BoardSnapshot | null>(null);

  useEffect(() => {
    const before = prev.current;
    prev.current = now;

    // 局が変わった直後は、前の局との差を鳴らしてしまうので黙る
    if (before === null) return;

    if (now.live && before.live) {
      // 山札が減った＝誰かが引いた。捨て札が動いた＝捨てたか、拾った。
      // どちらも札の擦れる音でよく、どちらだったかを区別する必要はない
      if (now.stockCount < before.stockCount) sfx.card();
      if (now.discardCount !== before.discardCount) sfx.card();

      // 自分の番が回ってきた合図。相手を待つ時間が長いので、
      // 画面を見ていなくても分かるようにする
      if (now.myTurn && !before.myTurn) sfx.turn();
    }

    // 誰かが上がった。**自分か相手かで音を変える**（2026-09-04・ユーザー指示）。
    // 同じ和音を長調へ開いただけの対にしてあるので、卓の音からは外れない。
    if (now.winner !== null && before.winner === null) {
      if (now.winner === now.mySeat) sfx.baterMine();
      else sfx.bater();
    }
  }, [now.live, now.stockCount, now.discardCount, now.myTurn, now.winner, now.mySeat]);
}
