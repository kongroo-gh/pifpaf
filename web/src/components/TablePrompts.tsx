// 卓の上で人に判断を訊く3つ。降りるか・拾った札を採るか・捨て札に割り込むか。
//
// **単機版とオンライン版で同じものを使う。** 以前はオンライン版に写しがあり、
// 注釈と失点の表示が落ちていたため、同じ場面でも文面が違っていた。
// ここは engine の定数（LOSS_*）を直に読むだけで、ルール判定はしない。

import type { Card, Wild } from "@pifpaf/engine";
import { LOSS_PLAY, LOSS_FOLD, LOSS_COM10 } from "@pifpaf/engine";
import { useT, Rich, Kicker, Gloss } from "../i18n";
import { sfx } from "../audio";
import { PlayingCard } from "./PlayingCard";

/** ラウンド開始前。手札を見て、勝負するか降りるかを決める。 */
export function FoldPrompt({
  hand,
  wild,
  chips,
  onFold,
  onPlay,
}: {
  hand: Card[];
  wild: Wild;
  chips: number;
  onFold: () => void;
  onPlay: () => void;
}) {
  const t = useT();
  return (
    <div className="panel">
      <div className="panel__box">
        <Kicker flavor="A MÃO" gloss={t.fold.kicker} className="panel__kicker" />
        <h2>{t.fold.title}</h2>
        <div className="foldPrompt__hand">
          {hand.map((c) => (
            <PlayingCard key={c.id} card={c} wild={wild} size="sm" />
          ))}
        </div>
        <p className="panel__note">
          <Rich text={t.fold.note(LOSS_PLAY, LOSS_COM10)} />
          <br />
          <Rich text={t.fold.noteFold(LOSS_FOLD)} />
          <br />
          <span className="panel__dim">{t.fold.chipsInHand(chips)}</span>
        </p>
        <div className="panel__actions">
          <button className="btn btn--keep" onClick={() => { sfx.click(); onPlay(); }}>
            JOGAR<Gloss flavor="JOGAR" text={t.fold.play} />
          </button>
          {/* 降りるとチップを1枚置く。払った音にしてある */}
          <button className="btn btn--reject" onClick={() => { sfx.chip(); onFold(); }}>
            CORRER<Gloss flavor="CORRER" text={t.fold.fold(LOSS_FOLD)} />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 手番を待たずに、捨てられた札を拾って上がれる場面。
 * 同時に複数が成立した場合は、捨てた人の次の席から順に訊かれる（engine側で決まる）。
 */
export function InterceptBar({
  card,
  wild,
  onTake,
  onPass,
}: {
  card: Card;
  wild: Wild;
  onTake: () => void;
  onPass: () => void;
}) {
  const t = useT();
  return (
    <div className="keepBar keepBar--intercept">
      <div className="keepBar__card">
        <PlayingCard card={card} wild={wild} size="md" />
      </div>
      <div className="keepBar__text">
        <Kicker flavor="BATER NO LIXO" gloss={t.intercept.kicker} className="keepBar__kicker" />
        <p className="keepBar__title">{t.intercept.title}</p>
        <p className="keepBar__note">
          <span className="keepBar__noteLong">{t.intercept.noteLong}</span>
          <Rich text={t.intercept.note} />
        </p>
      </div>
      <div className="keepBar__actions">
        <button className="btn btn--bater btn--armed" onClick={onTake}>
          BATER!<Gloss flavor="BATER!" text={t.intercept.take} />
        </button>
        <button className="btn btn--reject" onClick={() => { sfx.click(); onPass(); }}>
          PASSAR<Gloss flavor="PASSAR" text={t.intercept.pass} />
        </button>
      </div>
    </div>
  );
}

/**
 * 一番手が山札から引いた札を見せて、手札に入れるか訊く。
 * 断ると手札に入れずに捨てて、山札からもう1枚引く（引き直せるのは1回だけ）。
 *
 * 採否は手札のすぐ上で訊く。全画面のパネルにすると手札が隠れて
 * 「この札が要るか」を判断できない。
 */
export function KeepBar({
  card,
  wild,
  onKeep,
  onReject,
}: {
  card: Card;
  wild: Wild;
  onKeep: () => void;
  onReject: () => void;
}) {
  const t = useT();
  return (
    <div className="keepBar">
      <div className="keepBar__card">
        <PlayingCard card={card} wild={wild} size="md" />
      </div>
      <div className="keepBar__text">
        <Kicker flavor="PRIMEIRA MÃO" gloss={t.keep.kicker} className="keepBar__kicker" />
        <p className="keepBar__title">{t.keep.title}</p>
        <p className="keepBar__note">
          {/* 狭い画面では前半を畳む（CSSで制御） */}
          <span className="keepBar__noteLong">{t.keep.noteLong}</span>
          <Rich text={t.keep.note} />
        </p>
      </div>
      <div className="keepBar__actions">
        <button className="btn btn--keep" onClick={() => { sfx.card(); onKeep(); }}>
          FICAR<Gloss flavor="FICAR" text={t.keep.keep} />
        </button>
        <button className="btn btn--reject" onClick={onReject}>
          RECUSAR<Gloss flavor="RECUSAR" text={t.keep.reject} />
        </button>
      </div>
    </div>
  );
}
