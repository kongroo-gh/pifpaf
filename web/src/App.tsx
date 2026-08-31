import type { Card, Wild } from "@pifpaf/engine";
import { useGame, HUMAN } from "./game/useGame";
import { useExecution } from "./game/useExecution";
import { useHandOrder } from "./game/useHandOrder";
import { PERSONAS, personaOf } from "./game/players";
import { PlayingCard, CardBack, SUIT_GLYPH, describeCard } from "./components/PlayingCard";
import { PlayerHand } from "./components/PlayerHand";
import { OpponentSeat } from "./components/OpponentSeat";
import { BulletHoleCluster } from "./components/BulletHole";
import { GunShot } from "./components/GunShot";
import { MoneyRain } from "./components/MoneyRain";

export default function App() {
  const game = useGame();
  const {
    screen,
    state,
    gameId,
    humanHand,
    isHumanTurn,
    humanBater,
    topDiscard,
    canTakeDiscard,
    canDrawStock,
    isFirstTurn,
    canTakeVira,
    isDecidingKeep,
    selectedCardId,
    setSelectedCardId,
    startGame,
    drawCard,
    takeDiscard,
    takeVira,
    keepPending,
    rejectPending,
    discardSelected,
    callBater,
  } = game;

  const execution = useExecution(state.winner, screen === "EXECUTION");
  // 並び順は見た目だけの話なので web 側で持つ（engineはIDでしか見ない）
  const { ordered: orderedHand, reorder, sort } = useHandOrder(humanHand, gameId);

  if (screen === "INTRO") {
    return <Intro onStart={startGame} />;
  }

  const humanEliminated = execution.eliminated.has(HUMAN);
  const humanSurvived = execution.verdictReady && state.winner === HUMAN;

  return (
    // 注意：.app--dead の filter は包含ブロックを作るため、その内側に置いた
    // position:fixed の要素まで一緒に暗転してしまう。
    // 発砲フラッシュと判定パネルは .app の外に出しておくこと。
    <>
    <div className={`app ${humanEliminated ? "app--dead" : ""}`}>
      <div className="grain" aria-hidden="true" />

      <header className="topbar">
        <div className="topbar__brand">
          <h1>PIF PAF</h1>
          <p>A FAMÍLIA — 負けた者は、店から出られない</p>
        </div>
        <div className="topbar__wild">
          <span className="topbar__wildLabel">CORINGA / ワイルド</span>
          <span className="topbar__wildRank">{state.wild.rank}{SUIT_GLYPH[state.wild.suit]}</span>
          <span className="topbar__vira">
            ヴィラ
            {state.vira ? (
              // 一番手の最初の手番だけ、ここから買える
              <button
                type="button"
                className={`viraButton ${canTakeVira ? "viraButton--live" : ""}`}
                disabled={!canTakeVira}
                onClick={takeVira}
                aria-label={`ヴィラの ${describeCard(state.vira, state.wild)} を買う`}
              >
                <PlayingCard card={state.vira} wild={state.wild} size="sm" />
              </button>
            ) : (
              <span className="topbar__viraGone">買われた</span>
            )}
          </span>
        </div>
      </header>

      <section className="opponents">
        {PERSONAS.filter((p) => !p.isHuman).map((persona) => (
          <OpponentSeat
            key={persona.index}
            persona={persona}
            handCount={state.hands[persona.index]?.length ?? 0}
            isActive={state.currentPlayer === persona.index && state.phase !== "ROUND_OVER"}
            eliminated={execution.eliminated.has(persona.index)}
            survived={execution.verdictReady && state.winner === persona.index}
            firing={execution.firingAt === persona.index}
          />
        ))}
      </section>

      <section className="table">
        <div className="table__felt">
          <div className={`pile ${canDrawStock ? "pile--live" : ""}`}>
            <span className="pile__label">MONTE / 山札</span>
            <div className="pile__stack">
              <button
                type="button"
                className="pile__button"
                disabled={!canDrawStock}
                onClick={drawCard}
                aria-label="山札から1枚引く"
              >
                <CardBack size="md" />
              </button>
              <span className="pile__count">{state.stock.length}</span>
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
            <span className="pile__label">DESCARTE / 捨て札</span>
            <div className="pile__stack">
              {topDiscard ? (
                <button
                  type="button"
                  className="pile__button"
                  disabled={!canTakeDiscard}
                  onClick={takeDiscard}
                  aria-label={`捨て札の ${describeCard(topDiscard, state.wild)} を拾う`}
                >
                  <PlayingCard card={topDiscard} wild={state.wild} size="md" />
                </button>
              ) : (
                <div className="pile__empty" />
              )}
              <span className="pile__count">{state.discard.length}</span>
            </div>
            {canTakeDiscard && <span className="pile__hint">タップで拾う</span>}
          </div>
        </div>
      </section>

      <section className={`me ${humanEliminated ? "me--eliminated" : ""} ${humanSurvived ? "me--survived" : ""}`}>
        <div className="me__header">
          <span className="me__name">{personaOf(HUMAN).name}</span>
          <span className="me__title">{personaOf(HUMAN).title}</span>
          <button type="button" className="me__sort" onClick={sort}>
            整列
          </button>
          <TurnBanner
            isHumanTurn={isHumanTurn}
            phase={state.phase}
            currentPlayer={state.currentPlayer}
          />
        </div>

        <PlayerHand
          cards={orderedHand}
          wild={state.wild}
          selectedCardId={selectedCardId}
          // 拾ったばかりの札はこの手番では捨てられない
          lockedCardId={state.takenFromDiscard}
          selectable={isHumanTurn && state.phase === "AWAITING_DISCARD"}
          onSelect={setSelectedCardId}
          onReorder={reorder}
        />

        <div className="actions">
          <button className="btn btn--draw" disabled={!canDrawStock} onClick={drawCard}>
            COMPRAR<small>山札から引く</small>
          </button>
          <button
            className="btn btn--discard"
            disabled={!isHumanTurn || state.phase !== "AWAITING_DISCARD" || selectedCardId === null}
            onClick={discardSelected}
          >
            DESCARTAR<small>選んだ札を捨てる</small>
          </button>
          <button
            className={`btn btn--bater ${humanBater ? "btn--armed" : ""}`}
            disabled={humanBater === null}
            onClick={callBater}
          >
            BATER!<small>{humanBater ? "上がれる" : "まだ上がれない"}</small>
          </button>
        </div>

        {humanEliminated && (
          <>
            <BulletHoleCluster />
            <div className="me__stamp">ELIMINADO</div>
          </>
        )}
      </section>

    </div>

    {isDecidingKeep && state.pendingCard && (
      <KeepPrompt
        card={state.pendingCard}
        wild={state.wild}
        onKeep={keepPending}
        onReject={rejectPending}
      />
    )}
    {execution.firingAt !== null && <div className="muzzleFlash" aria-hidden="true" />}
    {/* 自分が撃たれるときだけ、銃がこちらを向く */}
    <GunShot phase={execution.gunPhase} />
    {/* 勝ったら金が降る。判定より先に降らせて、パネルはその上に出す */}
    {execution.verdictReady && state.winner === HUMAN && <MoneyRain />}
    {execution.verdictReady && <Verdict winner={state.winner} onRestart={startGame} />}
    </>
  );
}

/**
 * 一番手が山札から引いた札を見せて、手札に入れるか訊く。
 * 断ると手札に入れずに捨てて、山札からもう1枚引く（引き直せるのは1回だけ）。
 */
function KeepPrompt({
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
  return (
    <div className="keepPrompt">
      <div className="keepPrompt__panel">
        <p className="keepPrompt__kicker">PRIMEIRA MÃO — 一番手の特権</p>
        <h2>この札を手札に入れるか</h2>
        <div className="keepPrompt__card">
          <PlayingCard card={card} wild={wild} size="md" />
        </div>
        <p className="keepPrompt__note">
          断れば、この札は手札に入れず捨てて、山札からもう1枚引く。
          <br />
          引き直せるのは<strong>一度きり</strong>。次の札は選べない。
        </p>
        <div className="keepPrompt__actions">
          <button className="btn btn--keep" onClick={onKeep}>
            FICAR<small>手札に入れる</small>
          </button>
          <button className="btn btn--reject" onClick={onReject}>
            RECUSAR<small>捨てて引き直す</small>
          </button>
        </div>
      </div>
    </div>
  );
}

function TurnBanner({
  isHumanTurn,
  phase,
  currentPlayer,
}: {
  isHumanTurn: boolean;
  phase: string;
  currentPlayer: number;
}) {
  if (phase === "ROUND_OVER") {
    return <span className="turnBanner turnBanner--over">勝負あり</span>;
  }
  if (!isHumanTurn) {
    return <span className="turnBanner">{personaOf(currentPlayer).name} の番…</span>;
  }

  const message =
    phase === "AWAITING_FIRST_DRAW"
      ? "先手だ。ヴィラを買うか、山札から引くか。"
      : phase === "AWAITING_KEEP_DECISION"
        ? "その札、取るか捨てるか。"
        : phase === "AWAITING_DRAW"
          ? "山札か、捨て札から1枚。"
          : "1枚捨てろ。";

  return <span className="turnBanner turnBanner--mine">{message}</span>;
}

function Verdict({ winner, onRestart }: { winner: number | null; onRestart: () => void }) {
  const humanWon = winner === HUMAN;
  const isDraw = winner === null;

  return (
    <div className={`verdict ${humanWon ? "verdict--win" : isDraw ? "verdict--draw" : "verdict--lose"}`}>
      <div className="verdict__panel">
        {isDraw ? (
          <>
            <h2>O BARALHO ACABOU</h2>
            <p className="verdict__lead">山札が尽きた。今夜は誰も撃たれない。</p>
            <p className="verdict__sub">全員が生きて店を出た。次は、そうはいかない。</p>
          </>
        ) : humanWon ? (
          <>
            <h2>VOCÊ SOBREVIVEU</h2>
            <p className="verdict__lead">あんたが最初に上がった。</p>
            <p className="verdict__sub">
              テーブルには、あんたひとりが残っている。金を持って、静かに出て行きな。
            </p>
          </>
        ) : (
          <>
            <h2>VOCÊ ESTÁ MORTO</h2>
            <p className="verdict__lead">{personaOf(winner).name} が先に上がった。</p>
            <p className="verdict__sub">
              椅子を引く音がして、それきりだ。あんたの席は、もう空いている。
            </p>
          </>
        )}
        <button className="btn btn--again" onClick={onRestart}>
          MAIS UMA RODADA<small>もう一勝負</small>
        </button>
      </div>
    </div>
  );
}

function Intro({ onStart }: { onStart: () => void }) {
  return (
    <div className="intro">
      <div className="grain" aria-hidden="true" />
      <div className="intro__panel">
        <p className="intro__kicker">BEM-VINDO À MESA</p>
        <h1 className="intro__title">PIF PAF</h1>
        <p className="intro__sub">A FAMÍLIA</p>
        <div className="intro__rule" />
        <p className="intro__body">
          奥の部屋に、四つの椅子。灰皿は満杯で、誰も窓を開けない。
          <br />
          9枚の手札を組んで、最初に <strong>バテル</strong> と言った者だけが、
          自分の足でここを出られる。
        </p>
        <p className="intro__warn">残った三人は、店から出られない。</p>
        <button className="btn btn--start" onClick={onStart}>
          SENTAR À MESA<small>席に着く</small>
        </button>
        <p className="intro__foot">※ 演出です。実際に撃たれることはありません。</p>
      </div>
    </div>
  );
}
