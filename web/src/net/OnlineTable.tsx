// オンライン対戦の画面。
//
// **ルール判定を一切持たない。** 何が押せるかもサーバーが配った盤面から読むだけで、
// 「上がれるか」の判定すら自前ではしない（`BATER` は押して断られたら断られたまま）。
// 単機版が engine を直に叩いていたところが、まるごと通信に置き換わっている。
//
// 見た目の部品（カード・手札・席）は単機版と同じものを使い回す。
// 器だけが違う。
//
// **まだ載せていないもの**: 配札の演出、札が飛ぶ演出、勝ちの祝い。
// どれも単機版では `GameState`（全員の手札）を前提に組んであるため、
// 先に「盤面の型を PlayerView に揃える」整理をしないと持ってこられない。

import { useEffect, useState } from "react";
import type { Card } from "@pifpaf/engine";
import { classifyAsMelds } from "@pifpaf/engine";
import type { PlayerView, RoomSeat } from "@pifpaf/protocol";
import { useT, Gloss, Kicker } from "../i18n";
import { PlayingCard, CardBack, SUIT_GLYPH, describeCard } from "../components/PlayingCard";
import { PlayerHand } from "../components/PlayerHand";
import { ChipStack } from "../components/ChipStack";
import { useHandOrder } from "../game/useHandOrder";
import { useOnlineGame, loadName } from "./useOnlineGame";
import type { OnlineGame } from "./useOnlineGame";

export interface OnlineTableProps {
  onExit: () => void;
  onRules: () => void;
}

export function OnlineTable({ onExit, onRules }: OnlineTableProps) {
  const game = useOnlineGame();
  const t = useT();

  if (game.connection === "IDLE") {
    return <Lobby game={game} onExit={onExit} onRules={onRules} />;
  }

  if (game.view === null || game.room === null) {
    return (
      <div className="intro">
        <div className="intro__panel">
          <p className="intro__kicker">SALA</p>
          <p className="intro__body">
            {game.connection === "FAILED"
              ? t.online.failed
              : game.connection === "RECONNECTING"
                ? t.online.reconnecting
                : t.online.connecting}
          </p>
          {game.error !== null && <p className="intro__warn">{game.error}</p>}
          <button className="btn btn--rules" onClick={() => game.disconnect()}>
            VOLTAR<Gloss flavor="VOLTAR" text={t.online.retry} />
          </button>
        </div>
      </div>
    );
  }

  return <Table game={game} onExit={onExit} onRules={onRules} />;
}

/* ───────────── 入室前 ───────────── */

function Lobby({
  game,
  onExit,
  onRules,
}: {
  game: OnlineGame;
  onExit: () => void;
  onRules: () => void;
}) {
  const t = useT();
  const [name, setName] = useState(() => loadName());
  const [roomId, setRoomId] = useState("");

  const ready = roomId.trim().length === 4;
  const hasName = name.trim().length > 0;

  return (
    <div className="intro">
      <div className="grain" aria-hidden="true" />
      <div className="intro__panel">
        <Kicker flavor="A SALA" gloss={t.online.title} className="intro__kicker" />
        <h1 className="intro__title">PIF PAF</h1>
        <div className="intro__rule" />

        <div className="lobby">
          <label className="lobby__field">
            <span className="lobby__label">{t.online.nameLabel}</span>
            <input
              className="lobby__input"
              value={name}
              maxLength={16}
              placeholder={t.online.namePlaceholder}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <section className="lobby__choice lobby__choice--host">
            <div>
              <strong>{t.online.createTitle}</strong>
              <p className="lobby__hint">{t.online.createHint}</p>
            </div>
            <button className="btn btn--start" type="button" disabled={!hasName} onClick={() => game.create(name.trim())}>
              CRIAR<Gloss flavor="CRIAR" text={t.online.create} />
            </button>
          </section>

          <div className="lobby__or" aria-hidden="true"><span>OU</span></div>

          <form className="lobby__choice" onSubmit={(e) => {
            e.preventDefault();
            if (ready && hasName) game.connect(roomId, name.trim());
          }}>
            <strong>{t.online.joinTitle}</strong>
            <label className="lobby__field">
              <span className="lobby__label">{t.online.roomLabel}</span>
              <input
                className="lobby__input lobby__codeInput"
                value={roomId}
                maxLength={4}
                autoCapitalize="characters"
                autoComplete="off"
                placeholder={t.online.roomPlaceholder}
                onChange={(e) => setRoomId(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ""))}
              />
            </label>
            <p className="lobby__hint">{t.online.roomHint}</p>
            <button className="btn btn--keep" type="submit" disabled={!ready || !hasName}>
              ENTRAR<Gloss flavor="ENTRAR" text={t.online.join} />
            </button>
          </form>

          {game.error !== null && <p className="intro__warn">{game.error}</p>}

          <div className="intro__actions">
            <button className="btn btn--rules" type="button" onClick={onRules}>
              AS REGRAS<Gloss flavor="AS REGRAS" text={t.intro.rules} />
            </button>
          </div>

          <button className="btn btn--rules lobby__back" type="button" onClick={onExit}>
            {t.online.backToSolo}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────────── 卓 ───────────── */

function Table({
  game,
  onExit,
  onRules,
}: {
  game: OnlineGame;
  onExit: () => void;
  onRules: () => void;
}) {
  const t = useT();
  const view = game.view!;
  const room = game.room!;
  const { game: board } = view;

  // 手札の並べ替えは単機版と同じ仕組み。局の切り替わりはヴィラの札で見分ける
  const gameKey = `${room.round}-${board.wild.rank}${board.wild.suit}`;
  const [gameId, setGameId] = useState(0);
  useEffect(() => setGameId((n) => n + 1), [gameKey]);
  const { ordered, reorder, sort } = useHandOrder(board.hand, gameId);

  const [selected, setSelected] = useState<string | null>(null);
  // 盤面が変わったら選択を落とす。古い札を選んだまま捨てようとしないように
  useEffect(() => setSelected(null), [board.phase, board.actor]);

  const mySeat = view.you;
  const iAmSeated = mySeat >= 0;
  const myTurn = game.isMyTurn;

  const canDrawStock = myTurn && (board.phase === "AWAITING_DRAW" || board.phase === "AWAITING_FIRST_DRAW");
  const canTakeDiscard = myTurn && board.phase === "AWAITING_DRAW" && board.topDiscard !== null;
  const canTakeVira = myTurn && board.phase === "AWAITING_FIRST_DRAW" && board.vira !== null;
  const canDiscard = myTurn && board.phase === "AWAITING_DISCARD" && selected !== null;
  const deciding = myTurn && board.phase === "AWAITING_KEEP_DECISION" && board.pendingCard !== null;
  const intercepting = myTurn && board.phase === "AWAITING_INTERCEPT";

  const showFold = room.phase === "FOLD_DECISION" && iAmSeated &&
    room.seats[mySeat]?.decided === false;
  const showResult = room.phase === "ROUND_RESULT" || room.phase === "MATCH_OVER";

  return (
    <>
      <div className="app">
        <div className="grain" aria-hidden="true" />

        <header className="topbar">
          <div className="topbar__brand">
            <h1>PIF PAF</h1>
            <p>
              {t.topbar.round(room.round)} ／ <span className="online__room">{room.roomId}</span>
            </p>
          </div>

          <div className="topbar__tools">
            <button
              type="button"
              className="iconButton"
              onClick={onRules}
              aria-label={t.topbar.rules}
              title={t.topbar.rules}
            >
              <span className="iconButton__mark">?</span>
            </button>
            <button
              type="button"
              className="iconButton"
              onClick={() => {
                game.disconnect();
                onExit();
              }}
              aria-label={t.online.leave}
              title={t.online.leave}
            >
              <span className="iconButton__mark">×</span>
            </button>
          </div>

          <div className="topbar__wild">
            <span className="topbar__wildLabel">CORINGA</span>
            <span className="topbar__wildRank">
              {board.wild.rank}
              {SUIT_GLYPH[board.wild.suit]}
            </span>
            <span className="topbar__vira">
              {t.topbar.vira}
              {board.vira !== null ? (
                <button
                  type="button"
                  className={`viraButton ${canTakeVira ? "viraButton--live" : ""}`}
                  disabled={!canTakeVira}
                  onClick={() => game.act({ type: "TAKE_VIRA" })}
                  aria-label={t.topbar.buyViraAria(describeCard(board.vira, board.wild, t))}
                >
                  <PlayingCard card={board.vira} wild={board.wild} size="sm" />
                </button>
              ) : (
                <span className="topbar__viraGone">{t.topbar.viraGone}</span>
              )}
            </span>
          </div>
        </header>

        <section className="opponents">
          {room.seats
            .filter((s) => s.seat !== mySeat)
            .map((s) => (
              <OnlineSeat
                key={s.seat}
                seat={s}
                view={view}
                active={board.actor === s.seat && room.phase === "PLAYING"}
              />
            ))}
        </section>

        <section className="table">
          <div className="table__felt">
            <div className={`pile ${canDrawStock ? "pile--live" : ""}`}>
              <span className="pile__label">MONTE / {t.table.stock}</span>
              <div className="pile__stack">
                <button
                  type="button"
                  className="pile__button"
                  disabled={!canDrawStock}
                  onClick={() => game.act({ type: "DRAW", from: "STOCK" })}
                  aria-label={t.table.drawAria}
                >
                  <CardBack size="md" />
                </button>
                <span className="pile__count">{board.stockCount}</span>
              </div>
            </div>

            <div className="table__crest" aria-hidden="true">
              <svg viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="50" cy="50" r="39" fill="none" stroke="currentColor" strokeWidth="0.6" />
                <text x="50" y="44" textAnchor="middle" className="crestText">♠ ♥</text>
                <text x="50" y="66" textAnchor="middle" className="crestText">♦ ♣</text>
              </svg>
            </div>

            <div className={`pile ${canTakeDiscard ? "pile--live" : ""}`}>
              <span className="pile__label">DESCARTE / {t.table.discard}</span>
              <div className="pile__stack">
                {board.topDiscard !== null ? (
                  <button
                    type="button"
                    className="pile__button"
                    disabled={!canTakeDiscard}
                    onClick={() => game.act({ type: "DRAW", from: "DISCARD" })}
                    aria-label={t.table.takeDiscardAria(describeCard(board.topDiscard, board.wild, t))}
                  >
                    <PlayingCard card={board.topDiscard} wild={board.wild} size="md" />
                  </button>
                ) : (
                  <div className="pile__empty" />
                )}
                <span className="pile__count">{board.discardCount}</span>
              </div>
              {canTakeDiscard && <span className="pile__hint">{t.table.takeHint}</span>}
            </div>
          </div>
        </section>

        <section className="me">
          <div className="me__header">
            <span className="me__name">
              {iAmSeated ? (room.seats[mySeat]?.name ?? "?") : t.online.spectating}
            </span>
            {iAmSeated && (
              <span className="me__chips">
                <ChipStack count={board.seats[mySeat]?.chips ?? 0} />
                <strong>{board.seats[mySeat]?.chips ?? 0}</strong>
              </span>
            )}
            <button type="button" className="me__sort" onClick={sort}>
              {t.hand.sort}
            </button>
            <StatusBanner game={game} />
          </div>

          {intercepting && board.topDiscard !== null && (
            <div className="keepBar keepBar--intercept">
              <div className="keepBar__card">
                <PlayingCard card={board.topDiscard} wild={board.wild} size="md" />
              </div>
              <div className="keepBar__text">
                <Kicker
                  flavor="BATER NO LIXO"
                  gloss={t.intercept.kicker}
                  className="keepBar__kicker"
                />
                <p className="keepBar__title">{t.intercept.title}</p>
              </div>
              <div className="keepBar__actions">
                <button
                  className="btn btn--bater btn--armed"
                  onClick={() => game.act({ type: "INTERCEPT" })}
                >
                  BATER!<Gloss flavor="BATER!" text={t.intercept.take} />
                </button>
                <button
                  className="btn btn--reject"
                  onClick={() => game.act({ type: "PASS_INTERCEPT" })}
                >
                  PASSAR<Gloss flavor="PASSAR" text={t.intercept.pass} />
                </button>
              </div>
            </div>
          )}

          {deciding && board.pendingCard !== null && (
            <div className="keepBar">
              <div className="keepBar__card">
                <PlayingCard card={board.pendingCard} wild={board.wild} size="md" />
              </div>
              <div className="keepBar__text">
                <Kicker
                  flavor="PRIMEIRA MÃO"
                  gloss={t.keep.kicker}
                  className="keepBar__kicker"
                />
                <p className="keepBar__title">{t.keep.title}</p>
              </div>
              <div className="keepBar__actions">
                <button className="btn btn--keep" onClick={() => game.act({ type: "KEEP" })}>
                  FICAR<Gloss flavor="FICAR" text={t.keep.keep} />
                </button>
                <button className="btn btn--reject" onClick={() => game.act({ type: "REJECT" })}>
                  RECUSAR<Gloss flavor="RECUSAR" text={t.keep.reject} />
                </button>
              </div>
            </div>
          )}

          <PlayerHand
            key={gameId}
            cards={ordered}
            wild={board.wild}
            selectedCardId={selected}
            lockedCardId={board.takenFromDiscard}
            selectable={myTurn && board.phase === "AWAITING_DISCARD"}
            onSelect={setSelected}
            onReorder={reorder}
          />

          <div className="actions" hidden={!iAmSeated}>
            <button
              className="btn btn--draw"
              disabled={!canDrawStock}
              onClick={() => game.act({ type: "DRAW", from: "STOCK" })}
            >
              COMPRAR<Gloss flavor="COMPRAR" text={t.actions.draw} />
            </button>
            <button
              className="btn btn--discard"
              disabled={!canDiscard}
              onClick={() => {
                if (selected !== null) game.act({ type: "DISCARD", cardId: selected });
              }}
            >
              DESCARTAR<Gloss flavor="DESCARTAR" text={t.actions.discard} />
            </button>
            {/*
              上がれるかの判定はサーバーが持つ。押せるようにしておいて、
              駄目なら断られる。ここで判定すると web にルールが漏れる
            */}
            <button
              className="btn btn--bater"
              disabled={!myTurn || board.phase !== "AWAITING_DISCARD"}
              onClick={() => game.act({ type: "BATER" })}
            >
              BATER!<Gloss flavor="BATER!" text={t.actions.canBater} />
            </button>
          </div>
        </section>
      </div>

      {showFold && <FoldPrompt game={game} view={view} />}
      {showResult && <ResultPanel game={game} view={view} />}
      {room.phase === "WAITING" && <WaitingPanel game={game} />}
    </>
  );
}

/* ───────────── 部品 ───────────── */

function OnlineSeat({
  seat,
  view,
  active,
}: {
  seat: RoomSeat;
  view: PlayerView;
  active: boolean;
}) {
  const t = useT();
  const info = view.game.seats[seat.seat];
  const label =
    seat.name === null ? t.online.emptySeat : seat.isBot ? `${seat.name}（${t.online.botSeat}）` : seat.name;

  const classes = [
    "seat",
    active ? "seat--active" : "",
    info?.folded === true ? "seat--folded" : "",
    info?.out === true ? "seat--eliminated" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes}>
      <div className="seat__info">
        <div className="seat__name">{label}</div>
        {seat.disconnected && <div className="seat__title">{t.online.offline}</div>}
      </div>

      <div className="seat__chips" aria-label={t.seat.chipsAria(info?.chips ?? 0)}>
        <ChipStack count={info?.chips ?? 0} />
        <span className="seat__chipCount">{info?.chips ?? 0}</span>
      </div>

      <div className="seat__cards" aria-label={t.seat.handAria(info?.handCount ?? 0)}>
        {Array.from({ length: Math.min(info?.handCount ?? 0, 10) }, (_, i) => (
          <span className="seat__cardSlot" key={i}>
            <CardBack />
          </span>
        ))}
        <span className="seat__count">{info?.handCount ?? 0}</span>
      </div>

      {info?.folded === true && <div className="seat__foldTag">{t.seat.folded}</div>}
    </div>
  );
}

function StatusBanner({ game }: { game: OnlineGame }) {
  const t = useT();
  const view = game.view;
  const room = game.room;
  if (view === null || room === null) return null;

  if (game.connection === "RECONNECTING") {
    return <span className="turnBanner turnBanner--folded">{t.online.reconnecting}</span>;
  }
  if (room.phase === "WAITING") {
    return <span className="turnBanner">{t.online.waiting}</span>;
  }
  if (view.you < 0) {
    return <span className="turnBanner">{t.online.spectating}</span>;
  }
  if (view.game.seats[view.you]?.folded === true) {
    return <span className="turnBanner turnBanner--folded">{t.turn.folded}</span>;
  }
  if (room.phase !== "PLAYING") {
    return <span className="turnBanner turnBanner--over">{t.turn.over}</span>;
  }
  if (!game.isMyTurn) {
    const who = room.seats[view.game.actor]?.name ?? "?";
    return <span className="turnBanner">{t.online.theirTurn(who)}</span>;
  }

  const message =
    view.game.phase === "AWAITING_FIRST_DRAW"
      ? t.turn.firstDraw
      : view.game.phase === "AWAITING_KEEP_DECISION"
        ? t.turn.keepDecision
        : view.game.phase === "AWAITING_DRAW"
          ? t.turn.draw
          : t.turn.discard;
  return <span className="turnBanner turnBanner--mine">{message}</span>;
}

function WaitingPanel({ game }: { game: OnlineGame }) {
  const t = useT();
  const room = game.room!;
  const humans = room.seats.filter((s) => s.name !== null && !s.isBot);
  const isHost = room.hostSeat === game.seat;
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    void navigator.clipboard?.writeText(room.roomId).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
  };

  return (
    <div className="panel">
      <div className="panel__box">
        <Kicker flavor="A SALA" gloss={t.online.waiting} className="panel__kicker" />
        <div className="online__invite">
          <span>{t.online.inviteCode}</span>
          <strong>{room.roomId}</strong>
          <button type="button" onClick={copyCode}>{copied ? t.online.copied : t.online.copyCode}</button>
        </div>
        <ul className="online__seats" aria-label={t.online.waiting}>
          {room.seats.map((s) => (
            <li key={s.seat} className={s.name === null ? "online__seat--empty" : ""}>
              <span className="online__avatar" aria-hidden="true">{s.name === null ? "◇" : s.seat === room.hostSeat ? "♛" : "●"}</span>
              <span className="online__seatName">{s.name ?? t.online.emptySeat}</span>
              <span className="online__seatTags">
                {s.seat === room.hostSeat && <em>{t.online.host}</em>}
                {s.seat === game.seat && <em>{t.online.you}</em>}
              </span>
            </li>
          ))}
        </ul>
        <p className="panel__note">{t.online.waitingHint}</p>
        <p className="panel__dim">{humans.length} / 4</p>
        <div className="panel__actions">
          <button className="btn btn--keep" onClick={game.start} disabled={!isHost}>
            COMEÇAR<Gloss flavor="COMEÇAR" text={t.online.startWithBots} />
          </button>
        </div>
        {!isHost && <p className="panel__dim">{t.online.hostOnly}</p>}
      </div>
    </div>
  );
}

function FoldPrompt({ game, view }: { game: OnlineGame; view: PlayerView }) {
  const t = useT();
  return (
    <div className="panel">
      <div className="panel__box">
        <Kicker flavor="A MÃO" gloss={t.fold.kicker} className="panel__kicker" />
        <h2>{t.fold.title}</h2>
        <div className="foldPrompt__hand">
          {view.game.hand.map((c) => (
            <PlayingCard key={c.id} card={c} wild={view.game.wild} size="sm" />
          ))}
        </div>
        <div className="panel__actions">
          <button className="btn btn--keep" onClick={() => game.setFold(false)}>
            JOGAR<Gloss flavor="JOGAR" text={t.fold.play} />
          </button>
          <button className="btn btn--reject" onClick={() => game.setFold(true)}>
            CORRER<Gloss flavor="CORRER" text={t.fold.fold(1)} />
          </button>
        </div>
      </div>
    </div>
  );
}

function ResultPanel({ game, view }: { game: OnlineGame; view: PlayerView }) {
  const t = useT();
  const room = game.room!;
  const revealed = view.game.revealedHand;
  const winner = view.match.lastWinner;

  return (
    <div className="panel">
      <div className="panel__box">
        <Kicker flavor="FIM DA RODADA" gloss={t.result.kicker} className="panel__kicker" />
        <h2>
          {winner === null
            ? t.result.noWinner
            : winner === view.you
              ? t.result.youWon
              : t.result.theyWon(room.seats[winner]?.name ?? "?")}
        </h2>

        {revealed !== null && <MeldReveal cards={revealed.cards} view={view} />}

        <ul className="result__list">
          {room.seats.map((s) => {
            const info = view.game.seats[s.seat];
            const loss = game.settlement?.losses[s.seat] ?? 0;
            const out = game.settlement?.eliminated.includes(s.seat) === true;
            return (
              <li
                key={s.seat}
                className={`result__row ${s.seat === winner ? "result__row--win" : ""} ${out ? "result__row--out" : ""}`}
              >
                <span className="result__name">{s.name ?? t.online.emptySeat}</span>
                <span className="result__delta">
                  {s.seat === winner ? t.result.took : loss > 0 ? `−${loss}` : t.result.noChange}
                </span>
                <span className="result__chips">
                  <ChipStack count={info?.chips ?? 0} />
                  <strong>{info?.chips ?? 0}</strong>
                </span>
                {out && <span className="result__out">{t.result.bust}</span>}
              </li>
            );
          })}
        </ul>

        {room.phase === "MATCH_OVER" ? (
          <p className="panel__lead">
            {view.match.winner === view.you ? t.matchOver.winLead : t.matchOver.loseLead}
          </p>
        ) : (
          <div className="panel__actions">
            <button className="btn btn--again" onClick={game.next}>
              CONTINUAR<Gloss flavor="CONTINUAR" text={t.result.next} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** 上がり手を役ごとに見せる。分類は engine に任せる（web で役を判定しない）。 */
function MeldReveal({ cards, view }: { cards: Card[]; view: PlayerView }) {
  const t = useT();
  const melds = classifyAsMelds(cards, view.game.wild);

  if (melds === null) {
    return (
      <div className="reveal">
        <p className="reveal__label">{t.result.revealLabel}</p>
        <div className="reveal__meld">
          {cards.map((c) => (
            <PlayingCard key={c.id} card={c} wild={view.game.wild} size="sm" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="reveal">
      <p className="reveal__label">
        {t.result.revealLabel}{" "}
        <span className="reveal__count">{t.result.revealCount(cards.length)}</span>
      </p>
      {melds.map((meld, i) => (
        <div className="reveal__group" key={i}>
          <span className="reveal__type">
            {meld.type === "TRINCA" ? t.result.trinca : t.result.sequence}
          </span>
          <div className="reveal__meld">
            {meld.cards.map((c) => (
              <PlayingCard key={c.id} card={c} wild={view.game.wild} size="sm" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
