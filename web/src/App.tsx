import { useState } from "react";
import type { Card, Wild } from "@pifpaf/engine";
import { LOSS_PLAY, LOSS_FOLD, LOSS_COM10, classifyAsMelds } from "@pifpaf/engine";
import { useGame, HUMAN, LOAN_AMOUNT } from "./game/useGame";
import { useExecution } from "./game/useExecution";
import { useHandOrder } from "./game/useHandOrder";
import { PERSONAS, personaOf } from "./game/players";
import { PlayingCard, CardBack, SUIT_GLYPH, describeCard } from "./components/PlayingCard";
import { PlayerHand } from "./components/PlayerHand";
import { OpponentSeat } from "./components/OpponentSeat";
import { BulletHoleCluster } from "./components/BulletHole";
import { MoneyRain } from "./components/MoneyRain";
import { ChipStack } from "./components/ChipStack";
import { CardFlight } from "./components/CardFlight";
import { DealingScene } from "./components/DealingScene";
import { RuleBook } from "./components/RuleBook";

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

export default function App() {
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
    speedLabel,
    cycleSpeed,
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

  // 初回は自動で開く。以降はボタンから
  const [rulesOpen, setRulesOpen] = useState(() => !rulesSeen());
  const closeRules = () => {
    markRulesSeen();
    setRulesOpen(false);
  };
  const openRules = () => setRulesOpen(true);

  // 撃たれるのは破産した席だけ。結果表示のあいだに演出する。
  const showingResult = screen === "ROUND_RESULT" || screen === "MATCH_OVER";
  const execution = useExecution(settlement?.eliminated ?? [], showingResult);

  if (screen === "INTRO") {
    return (
      <>
        <Intro onStart={sitDown} bankroll={bankroll} onRules={openRules} />
        {rulesOpen && <RuleBook onClose={closeRules} />}
      </>
    );
  }
  if (screen === "BETTING") {
    return (
      <>
        <Betting bankroll={bankroll} onBet={startMatch} onLoan={takeLoan} onRules={openRules} />
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
              第{showingResult ? Math.max(1, match.round - 1) : match.round}ラウンド ／ 掛け金{" "}
              <strong>{wager}</strong>
            </p>
          </div>
          <button type="button" className="rulesButton" onClick={openRules}>
            <span className="rulesButton__mark">?</span>
            <span className="rulesButton__label">ルール</span>
          </button>

          <button
            type="button"
            className="speedToggle"
            onClick={cycleSpeed}
            aria-label={`CPUの速さ: ${speedLabel}。押すと切り替わる`}
          >
            <span className="speedToggle__label">CPUの速さ</span>
            <span className="speedToggle__value">{speedLabel}</span>
          </button>

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
              ヴィラ
              {state.vira && viraRevealed ? (
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
              <span className="pile__label">MONTE / 山札</span>
              <div className="pile__stack" data-stock-pile>
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
              <div className="pile__stack" data-discard-pile>
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

        <section
          data-seat={HUMAN}
          className={`me ${humanShot ? "me--eliminated" : ""} ${humanWonMatch ? "me--survived" : ""} ${
            pickup?.seat === HUMAN ? "me--receiving" : ""
          }`}
        >
          <div className="me__header">
            <span className="me__name">{personaOf(HUMAN).name}</span>
            <span className="me__chips">
              <ChipStack count={humanChips} />
              <strong>{humanChips}</strong>
              {showingResult && (settlement?.losses[HUMAN] ?? 0) > 0 && (
                <span className="seat__chipLoss">−{settlement?.losses[HUMAN]}</span>
              )}
            </span>
            <button type="button" className="me__sort" onClick={sort}>
              整列
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
              COMPRAR<small>山札から引く</small>
            </button>
            <button
              className="btn btn--discard"
              disabled={
                !isHumanTurn || state.phase !== "AWAITING_DISCARD" || selectedCardId === null
              }
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

      {screen === "ROUND_RESULT" && execution.done && settlement && (
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
  if (folded) return <span className="turnBanner turnBanner--folded">降りた</span>;
  if (screen !== "PLAYING" || phase === "ROUND_OVER") {
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

/** ラウンド開始前。手札を見て、勝負するか降りるかを決める。 */
function FoldPrompt({
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
  return (
    <div className="panel">
      <div className="panel__box">
        <p className="panel__kicker">A MÃO — 手札を見て決めろ</p>
        <h2>勝負するか、降りるか</h2>
        <div className="foldPrompt__hand">
          {hand.map((c) => (
            <PlayingCard key={c.id} card={c} wild={wild} size="sm" />
          ))}
        </div>
        <p className="panel__note">
          勝負して負ければ <strong>{LOSS_PLAY}チップ</strong>、
          10枚上がりを食らえば <strong>{LOSS_COM10}チップ</strong> 失う。
          <br />
          降りれば <strong>{LOSS_FOLD}チップ</strong> で済むが、このラウンドは勝てない。
          <br />
          <span className="panel__dim">手持ち {chips} チップ</span>
        </p>
        <div className="panel__actions">
          <button className="btn btn--keep" onClick={onPlay}>
            JOGAR<small>勝負する</small>
          </button>
          <button className="btn btn--reject" onClick={onFold}>
            CORRER<small>降りる（−{LOSS_FOLD}）</small>
          </button>
        </div>
      </div>
    </div>
  );
}

/** ラウンドの決着。誰が取って、誰がいくら失ったか。 */
/**
 * 上がった手札を公開する。どう組めていたのかが分かるよう、役ごとに分けて見せる。
 * 分類は engine の classifyAsMelds に任せる（web側で役を判定しない）。
 */
function MeldReveal({ hand, wild }: { hand: Card[]; wild: Wild }) {
  const melds = classifyAsMelds(hand, wild);

  // 上がった手なら必ず分類できるはずだが、
  // 割り込みなどで余り札が付く形もあるので、駄目なら素の手札を並べる
  if (melds === null) {
    return (
      <div className="reveal">
        <p className="reveal__label">上がり手</p>
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
        上がり手 <span className="reveal__count">{hand.length}枚</span>
      </p>
      {melds.map((meld, i) => (
        <div className="reveal__group" key={i}>
          <span className="reveal__type">
            {meld.type === "TRINCA" ? "組" : "階段"}
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
  const { losses, eliminated, state } = settlement;
  const winner = state.lastWinner;

  return (
    <div className="panel">
      <div className="panel__box">
        <p className="panel__kicker">FIM DA RODADA — ラウンド終了</p>
        <h2>
          {winner === null
            ? "決着つかず"
            : winner === HUMAN
              ? "あんたが取った"
              : `${personaOf(winner).name} が取った`}
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
                <span className="result__name">{personaOf(seat).name}</span>
                <span className="result__delta">
                  {isWinner ? "取った" : loss > 0 ? `−${loss}` : "±0"}
                </span>
                <span className="result__chips">
                  <ChipStack count={state.chips[seat] ?? 0} />
                  <strong>{state.chips[seat] ?? 0}</strong>
                </span>
                {out && <span className="result__out">破産</span>}
              </li>
            );
          })}
        </ul>

        {state.streak >= 2 && winner !== null && (
          <p className="result__streak">
            {personaOf(winner).name} が <strong>{state.streak}連勝</strong>
          </p>
        )}

        <div className="panel__actions">
          <button className="btn btn--again" onClick={onNext}>
            CONTINUAR<small>次のラウンドへ</small>
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
  const winnings = Math.round(wager * payout);

  return (
    <div className={`panel panel--verdict ${won ? "panel--win" : "panel--lose"}`}>
      <div className="panel__box">
        {won ? (
          <>
            <h2 className="verdictTitle verdictTitle--win">VOCÊ SOBREVIVEU</h2>
            <p className="panel__lead">テーブルに残ったのはあんただけだ。</p>

            {detail && (
              <div className="payout">
                <div className="payout__row">
                  <span>残りチップ {detail.chipsLeft}</span>
                  <span>{detail.base.toFixed(1)}倍</span>
                </div>
                {detail.streakBonus > 0 && (
                  <div className="payout__row">
                    <span>{detail.streak}連勝</span>
                    <span>+{detail.streakBonus.toFixed(1)}</span>
                  </div>
                )}
                <div className="payout__row">
                  <span>{detail.clean ? "ワイルド無しの上がり" : "ワイルドを使った上がり"}</span>
                  <span>{detail.clean ? "×1.0" : "×0.75"}</span>
                </div>
                <div className="payout__row payout__row--total">
                  <span>配当</span>
                  <span>{payout.toFixed(2)}倍</span>
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
            <p className="panel__lead">チップが尽きた。掛け金は戻らない。</p>
            <p className="payout__cash payout__cash--lost">
              {wager} → <strong>0</strong>
            </p>
          </>
        )}

        <p className="panel__dim">所持金 {bankroll}</p>

        <div className="panel__actions">
          <button className="btn btn--again" onClick={onBack}>
            {bankroll > 0 ? "VOLTAR À MESA" : "..."}
            <small>{bankroll > 0 ? "卓に戻る" : "一文無しだ"}</small>
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
}: {
  bankroll: number;
  onBet: (n: number) => void;
  onLoan: () => void;
  onRules: () => void;
}) {
  const broke = bankroll <= 0;

  return (
    <div className="intro">
      <div className="grain" aria-hidden="true" />
      <div className="intro__panel">
        <p className="intro__kicker">A APOSTA — 掛け金</p>
        <h1 className="betting__bankroll">{bankroll}</h1>
        <p className="intro__sub">所持金</p>
        <div className="intro__rule" />

        {broke ? (
          <>
            <p className="intro__body">
              一文無しだ。ファミリーが立て替えてくれるそうだが、
              <br />
              返せなかったときのことは、聞かないほうがいい。
            </p>
            <button className="btn btn--start" onClick={onLoan}>
              PEGAR EMPRESTADO<small>{LOAN_AMOUNT} 借りる</small>
            </button>
          </>
        ) : (
          <>
            <p className="intro__body">
              4人卓、持ちチップ7枚。最後まで残れば配当がつく。
              <br />
              勝率はおよそ4分の1。配当は残りチップと連勝で 2.0〜5.7倍。
            </p>
            <div className="betting__chips">
              {WAGERS.filter((w) => w <= bankroll).map((w) => (
                <button key={w} className="btn btn--bet" onClick={() => onBet(w)}>
                  {w}
                </button>
              ))}
              <button className="btn btn--bet btn--allin" onClick={() => onBet(bankroll)}>
                ALL IN<small>{bankroll}</small>
              </button>
            </div>
            <button className="btn btn--rules betting__rules" onClick={onRules}>
              AS REGRAS<small>ルールを読む</small>
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * 一番手が山札から引いた札を見せて、手札に入れるか訊く。
 * 断ると手札に入れずに捨てて、山札からもう1枚引く（引き直せるのは1回だけ）。
 */
/**
 * 手番を待たずに、捨てられた札を拾って上がれる場面。
 * 同時に複数が成立した場合は、捨てた人の次の席から順に訊かれる（engine側で決まる）。
 */
function InterceptBar({
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
  return (
    <div className="keepBar keepBar--intercept">
      <div className="keepBar__card">
        <PlayingCard card={card} wild={wild} size="md" />
      </div>
      <div className="keepBar__text">
        <p className="keepBar__kicker">BATER NO LIXO — 手番を待たずに</p>
        <p className="keepBar__title">その捨て札で上がれる</p>
        <p className="keepBar__note">
          <span className="keepBar__noteLong">自分の番でなくても拾って上がれる。</span>
          見送れば<strong>次の者</strong>に権利が移る。
        </p>
      </div>
      <div className="keepBar__actions">
        <button className="btn btn--bater btn--armed" onClick={onTake}>
          BATER!<small>拾って上がる</small>
        </button>
        <button className="btn btn--reject" onClick={onPass}>
          PASSAR<small>見送る</small>
        </button>
      </div>
    </div>
  );
}

function KeepBar({
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
    <div className="keepBar">
      <div className="keepBar__card">
        <PlayingCard card={card} wild={wild} size="md" />
      </div>
      <div className="keepBar__text">
        <p className="keepBar__kicker">PRIMEIRA MÃO — 一番手の特権</p>
        <p className="keepBar__title">この札を手札に入れるか</p>
        <p className="keepBar__note">
          {/* 狭い画面では前半を畳む（CSSで制御） */}
          <span className="keepBar__noteLong">下の手札と見比べて決めろ。並べ替えてもいい。</span>
          引き直せるのは<strong>一度きり</strong>。
        </p>
      </div>
      <div className="keepBar__actions">
        <button className="btn btn--keep" onClick={onKeep}>
          FICAR<small>手札に入れる</small>
        </button>
        <button className="btn btn--reject" onClick={onReject}>
          RECUSAR<small>捨てて引き直す</small>
        </button>
      </div>
    </div>
  );
}

function Intro({
  onStart,
  bankroll,
  onRules,
}: {
  onStart: () => void;
  bankroll: number;
  onRules: () => void;
}) {
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
          全員が7枚のチップを積む。負けるたびに減り、尽きた者から店を出られなくなる。
        </p>
        <p className="intro__warn">最後の一人になるまで、誰も帰れない。</p>
        <div className="intro__actions">
          <button className="btn btn--start" onClick={onStart}>
            SENTAR À MESA<small>席に着く（所持金 {bankroll}）</small>
          </button>
          <button className="btn btn--rules" onClick={onRules}>
            AS REGRAS<small>ルールを読む</small>
          </button>
        </div>
        <p className="intro__foot">※ 演出です。実際に撃たれることはありません。</p>
      </div>
    </div>
  );
}
