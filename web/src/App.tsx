import { useEffect, useState } from "react";
import type { Card, Wild } from "@pifpaf/engine";
import { useGame, HUMAN, LOAN_AMOUNT } from "./game/useGame";
import type { Speed } from "./game/useGame";
import { useExecution } from "./game/useExecution";
import { useHandOrder } from "./game/useHandOrder";
import { PERSONAS } from "./game/players";
import { PlayingCard, CardBack, SUIT_GLYPH, describeCard } from "./components/PlayingCard";
import { PlayerHand } from "./components/PlayerHand";
import { OpponentSeat } from "./components/OpponentSeat";
import { MeldReveal } from "./components/MeldReveal";
import { FoldPrompt, InterceptBar, KeepBar } from "./components/TablePrompts";
import { BulletHoleCluster } from "./components/BulletHole";
import { MoneyRain } from "./components/MoneyRain";
import { ChipStack } from "./components/ChipStack";
import { CardFlight } from "./components/CardFlight";
import { DealingScene } from "./components/DealingScene";
import { RuleBook } from "./components/RuleBook";
import { useT, personaName, personaTitle, withGloss, Rich, Kicker, Gloss } from "./i18n";
import { SettingsButton, SettingsPanel, SettingsControls } from "./components/Settings";
import { CardBurst } from "./components/CardBurst";
import { OnlineTable } from "./net/OnlineTable";

const WAGERS = [100, 250, 500];

/**
 * 配札の演出の速さ。CPUの速さ設定とは切り離して、常に「じっくり」で見せる。
 * 一局に一度きりの見せ場なので、進行を速くしている人にも同じ間合いで見せたい。
 * （CPUの手番の速さは別途ヘッダーで切り替えられる）
 */
const DEAL_SPEED_FACTOR = 1.5;

/** 初回だけルールブックを開く。2回目以降は自分で開いてもらう。 */
const RULES_SEEN_KEY = "pifpaf.rulesSeen";

function rulesSeen(): boolean {
  try {
    return window.localStorage.getItem(RULES_SEEN_KEY) === "1";
  } catch {
    return true; // 保存できない環境では毎回開かない
  }
}

function markRulesSeen(): void {
  try {
    window.localStorage.setItem(RULES_SEEN_KEY, "1");
  } catch {
    // 保存できなくても支障はない
  }
}

/**
 * オンラインかどうかは URL に持たせる（`?online=1`）。
 * 再読み込みや共有で同じ場所に戻れるようにするため、React state には置かない。
 */
function onlineFromUrl(): boolean {
  try {
    return new URLSearchParams(window.location.search).has("online");
  } catch {
    return false;
  }
}

function setOnlineInUrl(on: boolean): void {
  try {
    const url = new URL(window.location.href);
    if (on) url.searchParams.set("online", "1");
    else url.searchParams.delete("online");
    window.history.replaceState(null, "", url.toString());
  } catch {
    // 触れない環境でも、画面の切り替えだけはできる
  }
}

export default function App() {
  const t = useT();
  const game = useGame();
  const {
    screen,
    state,
    match,
    settlement,
    bankroll,
    wager,
    payout,
    payoutDetail,
    gameId,
    humanHand,
    humanFolded,
    foldedSeats,
    isHumanTurn,
    canIntercept,
    pickup,
    clearPickup,
    viraRevealed,
    revealVira,
    finishDealing,
    aliveSeats,
    humanBater,
    speed,
    setSpeed,
    topDiscard,
    canTakeDiscard,
    canDrawStock,
    canTakeVira,
    isDecidingKeep,
    selectedCardId,
    setSelectedCardId,
    sitDown,
    startMatch,
    decideFold,
    advance,
    backToTable,
    takeLoan,
    drawCard,
    takeDiscard,
    takeVira,
    keepPending,
    rejectPending,
    discardSelected,
    callBater,
    intercept,
    passIntercept,
  } = game;

  const { ordered: orderedHand, reorder, sort } = useHandOrder(humanHand, gameId);

  // オンライン対戦は単機版と同居させる。繋がらないときに遊べなくなるのを避けるため
  const [online, setOnline] = useState(onlineFromUrl);

  // 対局中の設定は隅の歯車から開く（盤面に常時出す余地がない）
  const [settingsOpen, setSettingsOpen] = useState(false);

  // 初回は自動で開く。以降はボタンから
  const [rulesOpen, setRulesOpen] = useState(() => !rulesSeen());
  const closeRules = () => {
    markRulesSeen();
    setRulesOpen(false);
  };
  const openRules = () => setRulesOpen(true);

  // 自分がラウンドを取ったときの祝い。終わるまで結果パネルを待たせる
  const humanWonRound = settlement?.state.lastWinner === HUMAN;
  const [celebrated, setCelebrated] = useState(false);
  useEffect(() => {
    if (screen !== "ROUND_RESULT") setCelebrated(false);
  }, [screen]);

  // 撃たれるのは破産した席だけ。結果表示のあいだに演出する。
  const showingResult = screen === "ROUND_RESULT" || screen === "MATCH_OVER";
  const execution = useExecution(settlement?.eliminated ?? [], showingResult);

  if (online) {
    return (
      <>
        <OnlineTable
          onExit={() => {
            setOnline(false);
            setOnlineInUrl(false);
          }}
          onRules={openRules}
        />
        {rulesOpen && <RuleBook onClose={closeRules} />}
      </>
    );
  }

  if (screen === "INTRO") {
    return (
      <>
        <Intro
          onStart={sitDown}
          bankroll={bankroll}
          onRules={openRules}
          speed={speed}
          onSpeed={setSpeed}
          onOnline={() => {
            setOnline(true);
            setOnlineInUrl(true);
          }}
        />
        {rulesOpen && <RuleBook onClose={closeRules} />}
      </>
    );
  }
  if (screen === "BETTING") {
    return (
      <>
        <Betting
          bankroll={bankroll}
          onBet={startMatch}
          onLoan={takeLoan}
          onRules={openRules}
          speed={speed}
          onSpeed={setSpeed}
        />
        {rulesOpen && <RuleBook onClose={closeRules} />}
      </>
    );
  }

  const humanChips = match.chips[HUMAN] ?? 0;
  const humanShot = execution.shot.has(HUMAN);
  const humanWonMatch = match.winner === HUMAN;

  return (
    <>
      <div className={`app ${humanShot ? "app--dead" : ""}`}>
        <div className="grain" aria-hidden="true" />

        <header className="topbar">
          <div className="topbar__brand">
            <h1>PIF PAF</h1>
            <p>
              {/* 精算するとmatch.roundは次を指すので、結果表示中は1つ戻して見せる */}
              {t.topbar.round(showingResult ? Math.max(1, match.round - 1) : match.round)} ／{" "}
              {t.topbar.wager} <strong>{wager}</strong>
            </p>
          </div>
          {/* 隅にまとめた小さなボタン。盤面が狭いので文字は持たせない */}
          <div className="topbar__tools">
            <button
              type="button"
              className="iconButton"
              onClick={openRules}
              aria-label={t.topbar.rules}
              title={t.topbar.rules}
            >
              <span className="iconButton__mark">?</span>
            </button>
            <SettingsButton onClick={() => setSettingsOpen(true)} />
          </div>

          <div className="topbar__wild">
            <span className="topbar__wildLabel">CORINGA</span>
            <span className="topbar__wildRank">
              {viraRevealed ? (
                <>
                  {state.wild.rank}
                  {SUIT_GLYPH[state.wild.suit]}
                </>
              ) : (
                <span className="topbar__wildHidden">?</span>
              )}
            </span>
            <span className="topbar__vira" data-vira-slot>
              {t.topbar.vira}
              {state.vira && viraRevealed ? (
                <button
                  type="button"
                  className={`viraButton ${canTakeVira ? "viraButton--live" : ""}`}
                  disabled={!canTakeVira}
                  onClick={takeVira}
                  aria-label={t.topbar.buyViraAria(describeCard(state.vira, state.wild, t))}
                >
                  <PlayingCard card={state.vira} wild={state.wild} size="sm" />
                </button>
              ) : (
                <span className="topbar__viraGone">{t.topbar.viraGone}</span>
              )}
            </span>
          </div>
        </header>

        <section className="opponents">
          {PERSONAS.filter((p) => !p.isHuman).map((persona) => (
            <OpponentSeat
              key={persona.index}
              seat={persona.index}
              name={personaName(t, persona.index)}
              /* 異名は訳さない。続く肩書きだけが言語で変わる。
                 ポルトガル語では異名がそのまま肩書きなので withGloss が重複を落とす */
              title={withGloss(persona.epithet, personaTitle(t, persona.index))}
              handCount={state.hands[persona.index]?.length ?? 0}
              chips={match.chips[persona.index] ?? 0}
              lostChips={showingResult ? settlement?.losses[persona.index] : undefined}
              folded={foldedSeats[persona.index] === true}
              isActive={
                screen === "PLAYING" &&
                state.currentPlayer === persona.index &&
                state.phase !== "ROUND_OVER"
              }
              receiving={pickup?.seat === persona.index}
              eliminated={execution.shot.has(persona.index)}
              survived={match.winner === persona.index}
              firing={execution.firingAt === persona.index}
            />
          ))}
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
                  onClick={drawCard}
                  aria-label={t.table.drawAria}
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
              <span className="pile__label">DESCARTE / {t.table.discard}</span>
              <div className="pile__stack" data-discard-pile>
                {topDiscard ? (
                  <button
                    type="button"
                    className="pile__button"
                    disabled={!canTakeDiscard}
                    onClick={takeDiscard}
                    aria-label={t.table.takeDiscardAria(describeCard(topDiscard, state.wild, t))}
                  >
                    <PlayingCard card={topDiscard} wild={state.wild} size="md" />
                  </button>
                ) : (
                  <div className="pile__empty" />
                )}
                <span className="pile__count">{state.discard.length}</span>
              </div>
              {canTakeDiscard && <span className="pile__hint">{t.table.takeHint}</span>}
            </div>
          </div>
        </section>

        <section
          data-seat={HUMAN}
          className={`me ${humanShot ? "me--eliminated" : ""} ${humanWonMatch ? "me--survived" : ""} ${
            pickup?.seat === HUMAN ? "me--receiving" : ""
          }`}
        >
          <div className="me__header">
            <span className="me__name">{personaName(t, HUMAN)}</span>
            <span className="me__chips">
              <ChipStack count={humanChips} />
              <strong>{humanChips}</strong>
              {showingResult && (settlement?.losses[HUMAN] ?? 0) > 0 && (
                <span className="seat__chipLoss">−{settlement?.losses[HUMAN]}</span>
              )}
            </span>
            <button type="button" className="me__sort" onClick={sort}>
              {t.hand.sort}
            </button>
            <TurnBanner
              screen={screen}
              folded={humanFolded}
              isHumanTurn={isHumanTurn}
              phase={state.phase}
              currentPlayer={state.currentPlayer}
            />
          </div>

          {/* 手番外で捨て札を拾って上がれる場面。採否バーと同じ位置に出す。 */}
          {canIntercept && topDiscard && (
            <InterceptBar
              card={topDiscard}
              wild={state.wild}
              onTake={intercept}
              onPass={passIntercept}
            />
          )}

          {/* 採否は手札のすぐ上で訊く。全画面のパネルにすると手札が隠れて
              「この札が要るか」を判断できない。 */}
          {isDecidingKeep && state.pendingCard && (
            <KeepBar
              card={state.pendingCard}
              wild={state.wild}
              onKeep={keepPending}
              onReject={rejectPending}
            />
          )}

          {/* 配り終えるまで手札は伏せておき、演出のあとに並べる。
              高さは同じ .hand で確保して、並んだ瞬間に盤面がずれないようにする。 */}
          {screen === "DEALING" ? (
            <div className="hand" aria-hidden="true" />
          ) : (
          <PlayerHand
            key={gameId}
            cards={orderedHand}
            wild={state.wild}
            selectedCardId={selectedCardId}
            lockedCardId={state.takenFromDiscard}
            selectable={isHumanTurn && state.phase === "AWAITING_DISCARD"}
            onSelect={setSelectedCardId}
            onReorder={reorder}
          />
          )}

          <div className="actions">
            <button className="btn btn--draw" disabled={!canDrawStock} onClick={drawCard}>
              COMPRAR<Gloss flavor="COMPRAR" text={t.actions.draw} />
            </button>
            <button
              className="btn btn--discard"
              disabled={
                !isHumanTurn || state.phase !== "AWAITING_DISCARD" || selectedCardId === null
              }
              onClick={discardSelected}
            >
              DESCARTAR<Gloss flavor="DESCARTAR" text={t.actions.discard} />
            </button>
            <button
              className={`btn btn--bater ${humanBater ? "btn--armed" : ""}`}
              disabled={humanBater === null}
              onClick={callBater}
            >
              BATER!<Gloss flavor="BATER!" text={humanBater ? t.actions.canBater : t.actions.cannotBater} />
            </button>
          </div>

          {humanShot && (
            <>
              <BulletHoleCluster />
              <div className="me__stamp">FALIDO</div>
            </>
          )}
        </section>
      </div>

      {screen === "FOLD" && (
        <FoldPrompt
          hand={orderedHand}
          wild={state.wild}
          chips={humanChips}
          onFold={() => decideFold(true)}
          onPlay={() => decideFold(false)}
        />
      )}

      {/* 破産した席が撃たれる瞬間の閃光。精算パネルと重ねると文字が読めなくなるので、
          MATCH_OVER に進む前のラウンド結果中に見せきる。 */}
      {rulesOpen && <RuleBook onClose={closeRules} />}

      {settingsOpen && (
        <SettingsPanel speed={speed} onSpeed={setSpeed} onClose={() => setSettingsOpen(false)} />
      )}

      {screen === "DEALING" && (
        <DealingScene
          vira={state.vira}
          wild={state.wild}
          dealtSeats={aliveSeats}
          speedFactor={DEAL_SPEED_FACTOR}
          onRevealVira={revealVira}
          onDone={finishDealing}
        />
      )}

      {pickup && (
        <CardFlight
          key={pickup.id}
          card={pickup.card}
          wild={state.wild}
          seat={pickup.seat}
          onDone={clearPickup}
        />
      )}

      {screen === "ROUND_RESULT" && execution.firingAt !== null && (
        <div className="muzzleFlash" aria-hidden="true" />
      )}

      {screen === "ROUND_RESULT" && humanWonRound && !celebrated && (
        <CardBurst
          cards={state.hands[HUMAN] ?? []}
          wild={state.wild}
          onDone={() => setCelebrated(true)}
        />
      )}

      {screen === "ROUND_RESULT" && execution.done && settlement &&
        (!humanWonRound || celebrated) && (
        <RoundResult
          settlement={settlement}
          winnerHand={state.winner === null ? null : (state.hands[state.winner] ?? null)}
          wild={state.wild}
          onNext={advance}
        />
      )}

      {screen === "MATCH_OVER" && (
        <>
          {humanWonMatch && <MoneyRain />}
          <MatchOver
            won={humanWonMatch}
            wager={wager}
            payout={payout}
            detail={payoutDetail}
            bankroll={bankroll}
            onBack={backToTable}
          />
        </>
      )}
    </>
  );
}

function TurnBanner({
  screen,
  folded,
  isHumanTurn,
  phase,
  currentPlayer,
}: {
  screen: string;
  folded: boolean;
  isHumanTurn: boolean;
  phase: string;
  currentPlayer: number;
}) {
  const t = useT();
  if (folded) return <span className="turnBanner turnBanner--folded">{t.turn.folded}</span>;
  if (screen !== "PLAYING" || phase === "ROUND_OVER") {
    return <span className="turnBanner turnBanner--over">{t.turn.over}</span>;
  }
  if (!isHumanTurn) {
    return <span className="turnBanner">{t.turn.waiting(personaName(t, currentPlayer))}</span>;
  }

  const message =
    phase === "AWAITING_FIRST_DRAW"
      ? t.turn.firstDraw
      : phase === "AWAITING_KEEP_DECISION"
        ? t.turn.keepDecision
        : phase === "AWAITING_DRAW"
          ? t.turn.draw
          : t.turn.discard;

  return <span className="turnBanner turnBanner--mine">{message}</span>;
}

/** ラウンドの決着。誰が取って、誰がいくら失ったか。 */
function RoundResult({
  settlement,
  winnerHand,
  wild,
  onNext,
}: {
  settlement: NonNullable<ReturnType<typeof useGame>["settlement"]>;
  winnerHand: Card[] | null;
  wild: Wild;
  onNext: () => void;
}) {
  const t = useT();
  const { losses, eliminated, state } = settlement;
  const winner = state.lastWinner;

  return (
    <div className="panel">
      <div className="panel__box">
        <Kicker flavor="FIM DA RODADA" gloss={t.result.kicker} className="panel__kicker" />
        <h2>
          {winner === null
            ? t.result.noWinner
            : winner === HUMAN
              ? t.result.youWon
              : t.result.theyWon(personaName(t, winner))}
        </h2>

        {winner !== null && winnerHand && (
          <MeldReveal hand={winnerHand} wild={wild} />
        )}

        <ul className="result__list">
          {losses.map((loss, seat) => {
            const out = eliminated.includes(seat);
            const isWinner = seat === winner;
            return (
              <li
                key={seat}
                className={`result__row ${isWinner ? "result__row--win" : ""} ${out ? "result__row--out" : ""}`}
              >
                <span className="result__name">{personaName(t, seat)}</span>
                <span className="result__delta">
                  {isWinner ? t.result.took : loss > 0 ? `−${loss}` : t.result.noChange}
                </span>
                <span className="result__chips">
                  <ChipStack count={state.chips[seat] ?? 0} />
                  <strong>{state.chips[seat] ?? 0}</strong>
                </span>
                {out && <span className="result__out">{t.result.bust}</span>}
              </li>
            );
          })}
        </ul>

        {state.streak >= 2 && winner !== null && (
          <p className="result__streak">
            <Rich text={t.result.streak(personaName(t, winner), state.streak)} />
          </p>
        )}

        <div className="panel__actions">
          <button className="btn btn--again" onClick={onNext}>
            CONTINUAR<Gloss flavor="CONTINUAR" text={t.result.next} />
          </button>
        </div>
      </div>
    </div>
  );
}

/** マッチの決着と精算。 */
function MatchOver({
  won,
  wager,
  payout,
  detail,
  bankroll,
  onBack,
}: {
  won: boolean;
  wager: number;
  payout: number;
  detail: ReturnType<typeof useGame>["payoutDetail"];
  bankroll: number;
  onBack: () => void;
}) {
  const t = useT();
  const winnings = Math.round(wager * payout);

  return (
    <div className={`panel panel--verdict ${won ? "panel--win" : "panel--lose"}`}>
      <div className="panel__box">
        {won ? (
          <>
            <h2 className="verdictTitle verdictTitle--win">VOCÊ SOBREVIVEU</h2>
            <p className="panel__lead">{t.matchOver.winLead}</p>

            {detail && (
              <div className="payout">
                <div className="payout__row">
                  <span>{t.matchOver.chipsLeft(detail.chipsLeft)}</span>
                  <span>{t.matchOver.times(detail.base.toFixed(1))}</span>
                </div>
                {detail.streakBonus > 0 && (
                  <div className="payout__row">
                    <span>{t.matchOver.streak(detail.streak)}</span>
                    <span>+{detail.streakBonus.toFixed(1)}</span>
                  </div>
                )}
                <div className="payout__row">
                  <span>{detail.clean ? t.matchOver.clean : t.matchOver.withWild}</span>
                  <span>{detail.clean ? "×1.0" : "×0.75"}</span>
                </div>
                <div className="payout__row payout__row--total">
                  <span>{t.matchOver.payout}</span>
                  <span>{t.matchOver.times(payout.toFixed(2))}</span>
                </div>
              </div>
            )}

            <p className="payout__cash">
              {wager} → <strong>{winnings}</strong>
            </p>
          </>
        ) : (
          <>
            <h2 className="verdictTitle verdictTitle--lose">VOCÊ ESTÁ FALIDO</h2>
            <p className="panel__lead">{t.matchOver.loseLead}</p>
            <p className="payout__cash payout__cash--lost">
              {wager} → <strong>0</strong>
            </p>
          </>
        )}

        <p className="panel__dim">{t.matchOver.bankroll(bankroll)}</p>

        <div className="panel__actions">
          <button className="btn btn--again" onClick={onBack}>
            {bankroll > 0 ? "VOLTAR À MESA" : t.matchOver.brokeTitle}
            <Gloss
              flavor={bankroll > 0 ? "VOLTAR À MESA" : t.matchOver.brokeTitle}
              text={bankroll > 0 ? t.matchOver.back : t.matchOver.broke}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

/** 掛け金を決める画面。 */
function Betting({
  bankroll,
  onBet,
  onLoan,
  onRules,
  speed,
  onSpeed,
}: {
  bankroll: number;
  onBet: (n: number) => void;
  onLoan: () => void;
  onRules: () => void;
  speed: Speed;
  onSpeed: (s: Speed) => void;
}) {
  const t = useT();
  const broke = bankroll <= 0;

  return (
    <div className="intro">
      <div className="grain" aria-hidden="true" />
      <div className="intro__panel">
        <Kicker flavor="A APOSTA" gloss={t.betting.kicker} className="intro__kicker" />
        <h1 className="betting__bankroll">{bankroll}</h1>
        <p className="intro__sub">{t.betting.bankroll}</p>
        <div className="intro__rule" />

        {broke ? (
          <>
            <p className="intro__body">
              {t.betting.brokeBody1}
              <br />
              {t.betting.brokeBody2}
            </p>
            <button className="btn btn--start" onClick={onLoan}>
              PEGAR EMPRESTADO<Gloss flavor="PEGAR EMPRESTADO" text={t.betting.borrow(LOAN_AMOUNT)} />
            </button>
          </>
        ) : (
          <>
            <p className="intro__body">
              {t.betting.body1}
              <br />
              {t.betting.body2}
            </p>
            <div className="betting__chips">
              {WAGERS.filter((w) => w <= bankroll).map((w) => (
                <button key={w} className="btn btn--bet" onClick={() => onBet(w)}>
                  {w}
                </button>
              ))}
              <button className="btn btn--bet btn--allin" onClick={() => onBet(bankroll)}>
                ALL IN<Gloss flavor="ALL IN" text={String(bankroll)} />
              </button>
            </div>
            <button className="btn btn--rules betting__rules" onClick={onRules}>
              AS REGRAS<Gloss flavor="AS REGRAS" text={t.betting.rules} />
            </button>
          </>
        )}

        {/* 一文無しのときもここに来るので、条件の外に出しておく */}
        <SettingsControls speed={speed} onSpeed={onSpeed} />
      </div>
    </div>
  );
}

function Intro({
  onStart,
  bankroll,
  onRules,
  speed,
  onSpeed,
  onOnline,
}: {
  onStart: () => void;
  bankroll: number;
  onRules: () => void;
  speed: Speed;
  onSpeed: (s: Speed) => void;
  onOnline: () => void;
}) {
  const t = useT();
  return (
    <div className="intro">
      <div className="grain" aria-hidden="true" />
      <div className="intro__panel">
        <p className="intro__kicker">BEM-VINDO À MESA</p>
        <h1 className="intro__title">PIF PAF</h1>
        <p className="intro__sub">A FAMÍLIA</p>
        <div className="intro__rule" />
        <p className="intro__body">
          {t.intro.body1}
          <br />
          {t.intro.body2}
        </p>
        <p className="intro__warn">{t.intro.warn}</p>
        <div className="intro__actions">
          <button className="btn btn--start" onClick={onStart}>
            SENTAR À MESA<Gloss flavor="SENTAR À MESA" text={t.intro.sit(bankroll)} />
          </button>
          <button className="btn btn--rules" onClick={onRules}>
            AS REGRAS<Gloss flavor="AS REGRAS" text={t.intro.rules} />
          </button>
        </div>
        <div className="intro__actions">
          <button className="btn btn--rules" onClick={onOnline}>
            ONLINE<Gloss flavor="ONLINE" text={t.online.enter} />
          </button>
        </div>
        {/* 卓に着く前に決めてもらう。対局中は隅の歯車から変えられる */}
        <SettingsControls speed={speed} onSpeed={onSpeed} />
        <p className="intro__foot">{t.intro.disclaimer}</p>
      </div>
    </div>
  );
}
