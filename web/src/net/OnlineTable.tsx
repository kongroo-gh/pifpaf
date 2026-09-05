// オンライン対戦の画面。
//
// **決めるのはサーバー。** 何が押せるかはサーバーが配った盤面から読むだけで、
// 送った手はサーバーが必ず検め直す。単機版が engine を直に叩いていたところが、
// まるごと通信に置き換わっている。
//
// 例外が「上がれるか」の一点だけある。**engine の `findBaterAction` をここでも呼ぶ。**
// 理由は2つ:
//   - 捨てる札を指さない `BATER` は「10枚すべてが役」の意味しかない。
//     いちばん普通の「1枚捨てて9枚で上がる」を送るには、どの札を捨てるかを
//     こちらで決めるしかない（ここを省いたせいで、オンラインでは普通の上がりが
//     まったく通らなくなっていた）
//   - 上がれるかどうかが見た目に出ないと、ボタンが手札と無関係に点いて見える
// 権威はサーバーのままで、ここでやるのは合図と手の組み立てだけ。
// engine は単機版のために web へ元から入っているので、増えるものは無い。
//
// **通信の都合以外は単機版と同じ器を使う。** 席・採否バー・割り込みバー・
// 降りる判断・上がり手の公開・設定はすべて `components/` の共有部品で、
// ここで組み直さない。写しを置くと、片方だけ直したときに同じ場面の
// 見え方が静かにずれる（実際にそうなっていた）。
//
// **まだ載せていないもの**: 配札の演出、札が飛ぶ演出、勝ちの祝い。
// どれも単機版では `GameState`（全員の手札）を前提に組んであるため、
// 先に「盤面の型を PlayerView に揃える」整理をしないと持ってこられない。

import { useEffect, useState } from "react";
import type { PlayerView, RoomInfo } from "@pifpaf/protocol";
import { findBaterAction } from "@pifpaf/engine";
import { useT, Gloss, Kicker, Rich } from "../i18n";
import { PlayingCard, CardBack, SUIT_GLYPH, describeCard } from "../components/PlayingCard";
import { PlayerHand } from "../components/PlayerHand";
import { ChipStack } from "../components/ChipStack";
import { OpponentSeat } from "../components/OpponentSeat";
import { MeldReveal } from "../components/MeldReveal";
import { FoldPrompt, InterceptBar, KeepBar } from "../components/TablePrompts";
import { SettingsButton, SettingsPanel, SettingsControls } from "../components/Settings";
import { LeaveButton, LeaveConfirm } from "../components/LeaveTable";
import { BackButton } from "../components/BackButton";
import { useHandOrder } from "../game/useHandOrder";
import { useBoardSounds } from "../game/useBoardSounds";
import { useAmbience, sfx } from "../audio";
import { useOnlineGame, loadName } from "./useOnlineGame";
import type { OnlineGame } from "./useOnlineGame";

export interface OnlineTableProps {
  onExit: () => void;
  onRules: () => void;
}

export function OnlineTable({ onExit, onRules }: OnlineTableProps) {
  const game = useOnlineGame();

  if (game.connection === "IDLE") {
    return <Lobby game={game} onExit={onExit} onRules={onRules} />;
  }

  // 人が抜けて畳まれた卓。盤面はもう動かないので、理由だけ見せて入口へ帰す
  if (game.room?.phase === "CLOSED") {
    return <TableClosed game={game} onExit={onExit} />;
  }

  if (game.view === null || game.room === null) {
    return <Connecting game={game} />;
  }

  return <Table game={game} onRules={onRules} onExit={onExit} />;
}

/* ───────────── 入室前 ───────────── */

/**
 * 繋ぎに行っているあいだの画面。
 * 単機版のイントロと同じ器（grain・見出し・罫）にしてある。
 * 別仕立てにすると、繋ぐ数秒だけ知らない画面に飛ばされたように見える。
 */
function Connecting({ game }: { game: OnlineGame }) {
  const t = useT();
  useAmbience(true);
  return (
    <div className="intro">
      <div className="grain" aria-hidden="true" />
      <div className="intro__panel">
        {/* 繋ぎに行くのをやめて、卓の入口へ戻る */}
        <BackButton onClick={() => game.disconnect()} />
        <Kicker flavor="A SALA" gloss={t.online.title} className="intro__kicker" />
        <h1 className="intro__title">PIF PAF</h1>
        <div className="intro__rule" />
        <p className="intro__body">
          {game.connection === "FAILED"
            ? t.online.failed
            : game.connection === "RECONNECTING"
              ? t.online.reconnecting
              : t.online.connecting}
        </p>
        {game.error !== null && <p className="intro__warn">{game.error}</p>}
        <div className="intro__actions">
          <button className="btn btn--rules" onClick={() => game.disconnect()}>
            VOLTAR<Gloss flavor="VOLTAR" text={t.online.retry} />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 誰かの通信が切れて、戻りを待っているあいだの覆い。
 *
 * **盤面は残したまま被せる。** 卓はそこにあって止まっているだけなので、
 * 別の画面へ飛ばすと「終わった」と誤解される。押せるものはひとつも無い
 * （サーバーもこのあいだの手を受け付けない）。
 */
function AwayOverlay({ room }: { room: RoomInfo }) {
  const t = useT();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, []);

  const names = room.awaiting
    .map((seat) => room.seats[seat]?.name ?? null)
    .filter((n): n is string => n !== null);
  // 期限はサーバーの時計。多少ずれても、残り秒数の見え方が数秒動くだけ
  const left = room.awaitingUntil === null ? 0 : Math.max(0, Math.ceil((room.awaitingUntil - now) / 1000));

  return (
    <div className="panel panel--verdict" role="dialog" aria-modal="true" aria-label={t.online.away}>
      <div className="panel__box">
        <Kicker flavor="ALGUÉM SUMIU" gloss={t.online.away} className="panel__kicker" />
        {names.length > 0 && <p className="panel__lead">{t.online.awayWho(names)}</p>}
        <p className="panel__note">{t.online.awayCountdown(left)}</p>
      </div>
    </div>
  );
}

/**
 * 人が抜けて卓が畳まれたときの画面。
 *
 * **盤面は見せない。** もう1手も進まないので、残しておくと「自分の番を待っている」
 * ように見えてしまう。`Connecting` と同じ器にして、理由と出口だけを置く。
 */
function TableClosed({ game, onExit }: { game: OnlineGame; onExit: () => void }) {
  const t = useT();
  const left = (game.room?.seats ?? [])
    .filter((s) => s.name !== null && !s.isBot && s.disconnected)
    .map((s) => s.name)
    .filter((n): n is string => n !== null);

  return (
    <div className="app app--intro">
      <div className="grain" aria-hidden="true" />
      <div className="intro">
        <Kicker flavor="MESA DESFEITA" gloss={t.online.closed} className="intro__kicker" />
        <h1 className="intro__title">PIF PAF</h1>
        <div className="intro__rule" />
        {left.length > 0 && <p className="intro__body">{t.online.closedBy(left)}</p>}
        <p className="intro__warn">{t.online.closedNote}</p>
        <div className="intro__actions">
          <button
            className="btn btn--rules"
            onClick={() => {
              game.disconnect();
              onExit();
            }}
          >
            VOLTAR<Gloss flavor="VOLTAR" text={t.online.closedBack} />
          </button>
        </div>
      </div>
    </div>
  );
}

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

  // 卓に着く前。単機版のイントロ・掛け金画面と同じ扱い
  useAmbience(true);

  const ready = roomId.trim().length === 4;
  const hasName = name.trim().length > 0;

  return (
    <div className="intro">
      <div className="grain" aria-hidden="true" />
      <div className="intro__panel">
        {/* まだ卓に着いていないので、メインメニューへ戻れる */}
        <BackButton onClick={onExit} />
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

          {/* 規則は単機版のイントロと同じく、細く長く敷く。戻る道は隅のボタン */}
          <button className="btn btn--rules btn--strip" type="button" onClick={onRules}>
            AS REGRAS<Gloss flavor="AS REGRAS" text={t.intro.rules} />
          </button>
        </div>

        {/* 卓に着く前に決めてもらう。単機版のイントロ・掛け金画面と同じ位置。
            CPUの速さはサーバーが持つので、ここでは言語だけ */}
        <SettingsControls />
      </div>
    </div>
  );
}

/* ───────────── 卓 ───────────── */

function Table({
  game,
  onRules,
  onExit,
}: {
  game: OnlineGame;
  onRules: () => void;
  /** 卓を降りてメインメニューへ。待機中の SAIR（＝オンラインの入口へ戻る）とは行き先が違う */
  onExit: () => void;
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

  // 対局中の設定は隅の歯車から開く（単機版と同じ。盤面に常時出す余地がない）
  const [settingsOpen, setSettingsOpen] = useState(false);

  // 卓を降りるかの確認。単機版と同じく、隅の印は一度受け止めてから効かせる
  const [leaveOpen, setLeaveOpen] = useState(false);

  // 人を待っているあいだは卓に着く前と同じ。始まったら止める
  useAmbience(room.phase === "WAITING");

  const mySeat = view.you;
  const iAmSeated = mySeat >= 0;
  const myTurn = game.isMyTurn;

  const canDrawStock = myTurn && (board.phase === "AWAITING_DRAW" || board.phase === "AWAITING_FIRST_DRAW");
  const canTakeDiscard = myTurn && board.phase === "AWAITING_DRAW" && board.topDiscard !== null;
  const canTakeVira = myTurn && board.phase === "AWAITING_FIRST_DRAW" && board.vira !== null;
  const canDiscard = myTurn && board.phase === "AWAITING_DISCARD" && selected !== null;
  const deciding = myTurn && board.phase === "AWAITING_KEEP_DECISION" && board.pendingCard !== null;
  const intercepting = myTurn && board.phase === "AWAITING_INTERCEPT";
  /**
   * 上がれるなら、その手（捨てる札を含む）。単機版の `humanBater` と同じもの。
   * 自分の番の捨てる場面でしか計算しないので、毎描画で走っても実際は静かな一瞬だけ。
   */
  const myBater =
    myTurn && board.phase === "AWAITING_DISCARD"
      ? findBaterAction(board.hand, board.wild)
      : null;

  const showFold = room.phase === "FOLD_DECISION" && iAmSeated &&
    room.seats[mySeat]?.decided === false;
  const showResult = room.phase === "ROUND_RESULT" || room.phase === "MATCH_OVER";

  useBoardSounds({
    live: room.phase === "PLAYING",
    stockCount: board.stockCount,
    discardCount: board.discardCount,
    myTurn,
    winner: board.winner,
    mySeat,
  });

  // サーバーに断られた手。単機版には無い場面（あちらは押せない形にしてある）
  useEffect(() => {
    if (game.error !== null) sfx.deny();
  }, [game.error]);

  return (
    <>
      <div className="app">
        <div className="grain" aria-hidden="true" />

        <header className="topbar">
          <div className="topbar__brand">
            <h1>PIF PAF</h1>
            <p>
              {/* 精算するとサーバーの round は次を指すので、結果表示中は1つ戻して見せる
                  （単機版も同じ扱いをしている） */}
              {t.topbar.round(showResult ? Math.max(1, room.round - 1) : room.round)} ／{" "}
              <span className="online__room">{room.roomId}</span>
            </p>
          </div>

          {/* 単機版と同じ並び。?・歯車・卓を降りる */}
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
            <SettingsButton onClick={() => setSettingsOpen(true)} />
            {/* 待機中は SAIR が、決着後は VOLTAR À MESA が、それぞれパネルの中にある。
                そこへ重ねると同じ操作が2か所に出るので、対局中だけ隅にも置く */}
            {room.phase !== "WAITING" && room.phase !== "MATCH_OVER" && (
              <LeaveButton onClick={() => setLeaveOpen(true)} />
            )}
          </div>

          <div className="topbar__wild">
            <span className="topbar__wildLabel">CORINGA</span>
            <span className="topbar__wildRank">
              {board.wild.rank}
              {SUIT_GLYPH[board.wild.suit]}
            </span>
            <span className="topbar__vira" data-vira-slot>
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
            .map((s) => {
              const info = board.seats[s.seat];
              return (
                <OpponentSeat
                  key={s.seat}
                  seat={s.seat}
                  name={s.name ?? t.online.emptySeat}
                  // 単機版が肩書きを置く行。オンラインでは席の素性を出す
                  title={s.disconnected ? t.online.offline : s.isBot ? t.online.botSeat : ""}
                  handCount={info?.handCount ?? 0}
                  chips={info?.chips ?? 0}
                  lostChips={showResult ? game.settlement?.losses[s.seat] : undefined}
                  folded={info?.folded === true}
                  isActive={board.actor === s.seat && room.phase === "PLAYING"}
                  eliminated={info?.out === true}
                  survived={view.match.winner === s.seat}
                />
              );
            })}
        </section>

        <section className="table">
          <div className="table__felt">
            <div className={`pile ${canDrawStock ? "pile--live" : ""}`}>
              <span className="pile__label">MONTE / {t.table.stock}</span>
              <div className="pile__stack" data-stock-pile>
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
              <div className="pile__stack" data-discard-pile>
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

        <section className="me" {...(iAmSeated ? { "data-seat": mySeat } : {})}>
          <div className="me__header">
            <span className="me__name">
              {iAmSeated ? (room.seats[mySeat]?.name ?? "?") : t.online.spectating}
            </span>
            {iAmSeated && (
              <span className="me__chips">
                <ChipStack count={board.seats[mySeat]?.chips ?? 0} />
                <strong>{board.seats[mySeat]?.chips ?? 0}</strong>
                {showResult && (game.settlement?.losses[mySeat] ?? 0) > 0 && (
                  <span className="seat__chipLoss">−{game.settlement?.losses[mySeat]}</span>
                )}
              </span>
            )}
            <button type="button" className="me__sort" onClick={sort}>
              {t.hand.sort}
            </button>
            <StatusBanner game={game} />
          </div>

          {intercepting && board.topDiscard !== null && (
            <InterceptBar
              card={board.topDiscard}
              wild={board.wild}
              onTake={() => game.act({ type: "INTERCEPT" })}
              onPass={() => game.act({ type: "PASS_INTERCEPT" })}
            />
          )}

          {deciding && board.pendingCard !== null && (
            <KeepBar
              card={board.pendingCard}
              wild={board.wild}
              onKeep={() => game.act({ type: "KEEP" })}
              onReject={() => game.act({ type: "REJECT" })}
            />
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
            {/* 見た目も押せる条件も単機版と同じ。上がれるときだけ赤く点く */}
            <button
              className={`btn btn--bater ${myBater ? "btn--armed" : ""}`}
              disabled={myBater === null}
              onClick={() => {
                if (myBater !== null) game.act(myBater);
              }}
            >
              BATER!<Gloss flavor="BATER!" text={myBater ? t.actions.canBater : t.actions.cannotBater} />
            </button>
          </div>
        </section>
      </div>

      {showFold && (
        <FoldPrompt
          hand={board.hand}
          wild={board.wild}
          chips={board.seats[mySeat]?.chips ?? 0}
          onPlay={() => game.setFold(false)}
          onFold={() => game.setFold(true)}
        />
      )}
      {showResult && <ResultPanel game={game} view={view} />}
      {room.phase === "WAITING" && <WaitingPanel game={game} />}

      {room.awaiting.length > 0 && <AwayOverlay room={room} />}

      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}

      {leaveOpen && (
        <LeaveConfirm
          warning={t.leave.warnOnline}
          onLeave={() => {
            setLeaveOpen(false);
            // **「降りる」と伝えてから**切る。ただ切ると、残った人が30秒待たされる
            game.leave();
            onExit();
          }}
          onStay={() => setLeaveOpen(false)}
        />
      )}
    </>
  );
}

/* ───────────── 部品 ───────────── */

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
  // 4人そろうまで始められない（オンラインは人と打つ場。CPU戦は単機版）
  const full = humans.length >= 4;
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

        {/* まず人を待つ。卓を抜ける道もここ
            （始まってしまえば単機版と同じで、途中では抜けられない） */}
        <div className="panel__actions">
          <button className="btn btn--keep" onClick={() => game.start()} disabled={!isHost || !full}>
            COMEÇAR<Gloss flavor="COMEÇAR" text={full ? t.online.startFull : t.online.needMore(4 - humans.length)} />
          </button>
          <button className="btn btn--reject" onClick={() => game.disconnect()}>
            SAIR<Gloss flavor="SAIR" text={t.online.leave} />
          </button>
        </div>

        {/* 集まらなかったときの逃げ道。人を待つのが主なので、細い帯で下に置く */}
        {!full && isHost && (
          <>
            <button
              className="btn btn--rules btn--strip online__callBots"
              onClick={() => game.start(true)}
            >
              CHAMAR A CPU
              <Gloss flavor="CHAMAR A CPU" text={t.online.callBots(4 - humans.length)} />
            </button>
            <p className="panel__dim">{t.online.callBotsHint}</p>
          </>
        )}
        {!isHost && <p className="panel__dim">{t.online.hostOnly}</p>}
      </div>
    </div>
  );
}

function ResultPanel({ game, view }: { game: OnlineGame; view: PlayerView }) {
  const t = useT();
  const room = game.room!;
  const revealed = view.game.revealedHand;
  const winner = view.match.lastWinner;
  const over = room.phase === "MATCH_OVER";

  /**
   * 次のラウンドは**繋がっている人が全員押すまで始まらない**。
   * 押しても何も変わらないと、届いていないのか卓が止まったのか分からない。
   * 押した側は操作を閉じ、誰を待っているのかを名前で出す。
   *
   * CPU と切れている席は待たない（サーバーの `maybeAdvance` と同じ見方）。
   */
  const iAmReady = room.seats[view.you]?.ready === true;
  const waitingFor = room.seats
    .filter((s) => s.name !== null && !s.isBot && !s.disconnected && !s.ready)
    .map((s) => s.name)
    .filter((n): n is string => n !== null);

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

        {revealed !== null && <MeldReveal hand={revealed.cards} wild={view.game.wild} />}

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

        {view.match.streak >= 2 && winner !== null && (
          <p className="result__streak">
            <Rich text={t.result.streak(room.seats[winner]?.name ?? "?", view.match.streak)} />
          </p>
        )}

        {over ? (
          <>
            <p className="panel__lead">
              {view.match.winner === view.you ? t.matchOver.winLead : t.matchOver.loseLead}
            </p>
            {/* 決着したらここが唯一の出口。単機版の VOLTAR À MESA と同じ位置・同じ見出し */}
            <div className="panel__actions">
              <button className="btn btn--again" onClick={() => game.disconnect()}>
                VOLTAR À MESA<Gloss flavor="VOLTAR À MESA" text={t.online.retry} />
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="panel__actions">
              <button className="btn btn--again" onClick={game.next} disabled={iAmReady}>
                CONTINUAR
                <Gloss
                  flavor="CONTINUAR"
                  text={iAmReady ? t.online.waitingForNext : t.result.next}
                />
              </button>
            </div>
            {iAmReady && waitingFor.length > 0 && (
              <p className="panel__note result__waiting">{t.result.waitingFor(waitingFor)}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
