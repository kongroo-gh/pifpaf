import { useMemo } from "react";
import { rankIndex, type Card } from "@pifpaf/engine";
import { useGame, HUMAN } from "./game/useGame";
import { useExecution } from "./game/useExecution";
import { PERSONAS, personaOf } from "./game/players";
import { PlayingCard, CardBack } from "./components/PlayingCard";
import { OpponentSeat } from "./components/OpponentSeat";
import { BulletHoleCluster } from "./components/BulletHole";

const SUIT_ORDER = ["S", "H", "D", "C"];

/** 表示用に手札を並べ替える。engineはカードIDしか見ないので並びを変えても影響しない。 */
function sortForDisplay(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    const suitDiff = SUIT_ORDER.indexOf(a.suit) - SUIT_ORDER.indexOf(b.suit);
    if (suitDiff !== 0) return suitDiff;
    return rankIndex(a.rank) - rankIndex(b.rank);
  });
}

export default function App() {
  const game = useGame();
  const {
    screen,
    state,
    vira,
    humanHand,
    isHumanTurn,
    humanBater,
    selectedCardId,
    setSelectedCardId,
    startGame,
    drawCard,
    discardSelected,
    callBater,
  } = game;

  const execution = useExecution(state.winner, screen === "EXECUTION");
  const sortedHand = useMemo(() => sortForDisplay(humanHand), [humanHand]);

  if (screen === "INTRO") {
    return <Intro onStart={startGame} />;
  }

  const humanEliminated = execution.eliminated.has(HUMAN);
  const humanSurvived = execution.verdictReady && state.winner === HUMAN;
  const topDiscard = state.discard[state.discard.length - 1];

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
          <span className="topbar__wildRank">{state.wildRank}</span>
          {vira && (
            <span className="topbar__vira">
              ヴィラ <PlayingCard card={vira} wildRank={state.wildRank} size="sm" />
            </span>
          )}
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
          <div className="pile">
            <span className="pile__label">MONTE / 山札</span>
            <div className="pile__stack">
              <CardBack size="md" />
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

          <div className="pile">
            <span className="pile__label">DESCARTE / 捨て札</span>
            <div className="pile__stack">
              {topDiscard ? (
                <PlayingCard card={topDiscard} wildRank={state.wildRank} size="md" />
              ) : (
                <div className="pile__empty" />
              )}
              <span className="pile__count">{state.discard.length}</span>
            </div>
          </div>
        </div>
      </section>

      <section className={`me ${humanEliminated ? "me--eliminated" : ""} ${humanSurvived ? "me--survived" : ""}`}>
        <div className="me__header">
          <span className="me__name">{personaOf(HUMAN).name}</span>
          <span className="me__title">{personaOf(HUMAN).title}</span>
          <TurnBanner
            isHumanTurn={isHumanTurn}
            phase={state.phase}
            currentPlayer={state.currentPlayer}
          />
        </div>

        <div className="hand">
          {sortedHand.map((card) => (
            <PlayingCard
              key={card.id}
              card={card}
              wildRank={state.wildRank}
              selected={selectedCardId === card.id}
              disabled={!isHumanTurn || state.phase !== "AWAITING_DISCARD"}
              onClick={
                isHumanTurn && state.phase === "AWAITING_DISCARD"
                  ? (c) => setSelectedCardId(c.id === selectedCardId ? null : c.id)
                  : undefined
              }
            />
          ))}
        </div>

        <div className="actions">
          <button
            className="btn btn--draw"
            disabled={!isHumanTurn || state.phase !== "AWAITING_DRAW"}
            onClick={drawCard}
          >
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

    {execution.firingAt !== null && <div className="muzzleFlash" aria-hidden="true" />}
    {execution.verdictReady && <Verdict winner={state.winner} onRestart={startGame} />}
    </>
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
  return (
    <span className="turnBanner turnBanner--mine">
      {phase === "AWAITING_DRAW" ? "あんたの番だ。引きな。" : "1枚捨てろ。"}
    </span>
  );
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
