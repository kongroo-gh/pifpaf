// 1卓ぶんの権威状態。
//
// **通信手段を知らない。** WebSocket も setTimeout も出てこない。
// 変化したら `onChange` を呼ぶだけで、誰にどう届けるかは呼び出し側の仕事。
// こうしてあるのは、
//   - テストが素で書ける（差し込む時計も要らない）
//   - 置き場所を Node から Cloudflare Durable Objects へ移すとき、
//     書き換えるのが transport だけで済む
// ため。engine を UI から切り離した理由と同じ。
//
// CPU も自分では動かない。`needsBotStep()` が真のあいだ、呼び出し側が
// 好きな間合いで `stepBot()` を呼ぶ。人が見る「考えている風の間」は演出であって
// ルールではないので、ここに置くと決定性が壊れる。

import {
  dealGame,
  createInitialState,
  applyAction,
  currentActor,
  createMatch,
  settleRound,
  isAlive,
  alivePlayers,
  walkoverWinner,
  shouldFold,
  decideAction,
  isWildCard,
  DEFAULT_CHIPS,
} from "@pifpaf/engine";
import type { GameState, MatchState, GameAction, RoundResult, RoundSettlement } from "@pifpaf/engine";
import { maskFor, maskForSpectator } from "@pifpaf/protocol";
import type { PlayerView, RoomInfo, RoomPhase, RoomSeat } from "@pifpaf/protocol";

export const SEAT_COUNT = 4;

/** 席の主。null は空席。 */
type Occupant =
  | { kind: "HUMAN"; name: string; token: string; connected: boolean }
  | { kind: "BOT"; name: string }
  | null;

export interface RoomOptions {
  roomId: string;
  /** 配札の乱数。テストでは種を固定して渡す */
  rng?: () => number;
  /** 再接続用トークンの発行。テストでは決まった値を返す */
  makeToken?: () => string;
  /** 開始チップ */
  startingChips?: number;
  /** 状態が変わったら呼ばれる。ここで全員に配り直す */
  onChange?: () => void;
}

export type JoinResult =
  | { ok: true; seat: number; token: string; rejoined: boolean }
  | { ok: false; reason: string };

export type ActResult = { ok: true } | { ok: false; reason: string };

/** 人が集まらないときに呼ぶ CPU の呼び名。単機版の顔ぶれと同じ。 */
const BOT_NAMES = ["Dom Vieira", "Zé Navalha", "Dona Rosa", "O Fantasma"];

export class Room {
  readonly roomId: string;
  private hostSeat = -1;

  private seats: Occupant[] = Array.from({ length: SEAT_COUNT }, () => null);
  private phase: RoomPhase = "WAITING";

  private match: MatchState;
  private state: GameState;

  /** その席が自分の意思で降りたか。ラウンドごとに作り直す */
  private folded: boolean[] = Array.from({ length: SEAT_COUNT }, () => false);
  /** 降りるか否かを決め終えた席 */
  private decided: boolean[] = Array.from({ length: SEAT_COUNT }, () => false);
  /** 結果画面から次へ進んでよいと言った席 */
  private readyForNext = new Set<number>();

  private lastSettlement: RoundSettlement | null = null;
  /**
   * そのラウンドを取った席。**不戦勝を含む**ので `state.winner` とは別に持つ。
   * 打たずに終わったラウンドでは engine 側の winner は null のまま。
   */
  private roundWinner: number | null = null;
  /** 実際に打って決着したか。不戦勝なら false で、手札は開かない */
  private roundPlayed = false;

  private readonly rng: (() => number) | undefined;
  private readonly makeToken: () => string;
  private readonly startingChips: number;
  private readonly notify: () => void;
  /** 決着まで一気に進めている最中。途中経過は配らない（`onChange` を参照） */
  private quiet = false;

  constructor(options: RoomOptions) {
    this.roomId = options.roomId;
    this.rng = options.rng;
    this.makeToken = options.makeToken ?? defaultToken;
    this.startingChips = options.startingChips ?? DEFAULT_CHIPS;
    this.notify = options.onChange ?? (() => {});

    this.match = createMatch(SEAT_COUNT, this.startingChips);
    // 卓が始まるまでの置き場所。WAITING のあいだは誰にも配らない
    this.state = createInitialState(this.deal());
  }

  /* ───────────── 入退室 ───────────── */

  join(name: string, token?: string): JoinResult {
    // トークンが合えば元の席に戻す。通信が切れただけの人を締め出さない
    if (token !== undefined) {
      const seat = this.seats.findIndex(
        (o) => o !== null && o.kind === "HUMAN" && o.token === token
      );
      if (seat >= 0) {
        const o = this.seats[seat] as Extract<Occupant, { kind: "HUMAN" }>;
        o.connected = true;
        o.name = name;
        this.onChange();
        return { ok: true, seat, token, rejoined: true };
      }
    }

    if (this.phase !== "WAITING") {
      return { ok: false, reason: "対局中の卓には入れません" };
    }

    const seat = this.seats.findIndex((o) => o === null);
    if (seat < 0) return { ok: false, reason: "席が空いていません" };

    const fresh = this.makeToken();
    this.seats[seat] = { kind: "HUMAN", name, token: fresh, connected: true };
    if (this.hostSeat < 0) this.hostSeat = seat;
    this.onChange();
    return { ok: true, seat, token: fresh, rejoined: false };
  }

  /**
   * 接続が切れた。**席は空けない。**
   * 対局中に席を消すと残りの人が続けられなくなるので、席は残したまま
   * CPU が代わりに打つ（`isBotControlled`）。戻ってくれば操作を取り戻せる。
   */
  disconnect(seat: number): void {
    const o = this.seats[seat];
    if (o === null || o === undefined || o.kind !== "HUMAN") return;
    o.connected = false;

    // まだ始まっていない卓なら席を空けてしまってよい
    if (this.phase === "WAITING") {
      this.seats[seat] = null;
      if (this.hostSeat === seat) {
        this.hostSeat = this.seats.findIndex((occupant) => occupant?.kind === "HUMAN");
      }
      this.onChange();
      return;
    }

    // **その人を待っている最中に切れると、卓が永久に止まる。**
    // 抜けた席は CPU 扱いになるので、待っていたものをここで肩代わりする。
    if (this.phase === "FOLD_DECISION" && !this.decided[seat] && isAlive(this.match, seat)) {
      this.folded[seat] = shouldFold(this.state.hands[seat] ?? [], this.state.wild);
      this.decided[seat] = true;
      this.onChange();
      this.maybeStartPlay();
      return;
    }

    if (this.phase === "ROUND_RESULT") {
      this.onChange();
      this.maybeAdvance();
      return;
    }

    this.onChange();
  }

  /**
   * 開始する。
   *
   * **まず人を募り、集まらなければ CPU を呼ぶ**（2026-09-03・ユーザー指示）。
   * 既定（`fillWithBots` 省略）では4人そろうまで始まらない。人が来ないときだけ、
   * ホストが明示的に CPU を呼んで空席を埋められる。
   *
   * 以前は開始そのものが空席を CPU で埋めていた。それだと人を待つ前に
   * CPU戦が始まってしまい、オンラインに来た意味が薄れる。「待つ」を既定にし、
   * 「CPUで埋める」を別の操作に分けたのがこの形。
   */
  start(fillWithBots = false): ActResult {
    if (this.phase !== "WAITING") return { ok: false, reason: "すでに始まっています" };

    const humans = this.seats.filter((o) => o !== null && o.kind === "HUMAN").length;
    if (humans === 0) return { ok: false, reason: "人がいません" };

    if (fillWithBots) {
      for (let i = 0; i < SEAT_COUNT; i++) {
        if (this.seats[i] === null) {
          this.seats[i] = { kind: "BOT", name: BOT_NAMES[i] ?? `CPU ${i}` };
        }
      }
    } else if (humans < SEAT_COUNT) {
      return { ok: false, reason: `あと ${SEAT_COUNT - humans} 人そろってから始まります` };
    }

    this.match = createMatch(SEAT_COUNT, this.startingChips);
    this.beginRound();
    return { ok: true };
  }

  /* ───────────── ラウンドの進行 ───────────── */

  /**
   * 新しいラウンドを配る。単機版の `beginRound` と同じ手順。
   * 脱落者は「降りた者」と同じ扱いで手番を飛ばす（席番号を保つため）。
   */
  private beginRound(): void {
    const deal = this.deal();
    const dead = deal.hands.map((_, i) => !isAlive(this.match, i));
    const dealer = (this.match.round - 1) % SEAT_COUNT;

    this.state = createInitialState(deal, dealer, dead);
    this.folded = Array.from({ length: SEAT_COUNT }, () => false);
    this.decided = Array.from({ length: SEAT_COUNT }, () => false);
    this.readyForNext.clear();
    this.lastSettlement = null;
    this.roundWinner = null;
    this.roundPlayed = false;
    this.phase = "FOLD_DECISION";

    // 人が操作しない席は、その場で手札を見て決める
    for (let i = 0; i < SEAT_COUNT; i++) {
      if (dead[i]) {
        this.decided[i] = true;
        continue;
      }
      if (this.isBotControlled(i)) {
        this.folded[i] = shouldFold(deal.hands[i] ?? [], deal.wild);
        this.decided[i] = true;
      }
    }

    this.onChange();
    this.maybeStartPlay();
  }

  /** ラウンド開始前の「降りる／勝負する」。 */
  setFold(seat: number, fold: boolean): ActResult {
    if (this.phase !== "FOLD_DECISION") return { ok: false, reason: "いま決める場面ではありません" };
    if (!isAlive(this.match, seat)) return { ok: false, reason: "すでに脱落しています" };
    if (this.decided[seat]) return { ok: false, reason: "もう決めています" };

    this.folded[seat] = fold;
    this.decided[seat] = true;
    this.onChange();
    this.maybeStartPlay();
    return { ok: true };
  }

  /** 全員が決め終えたら手番を始める。 */
  private maybeStartPlay(): void {
    if (this.phase !== "FOLD_DECISION") return;
    if (!this.decided.every((d) => d)) return;

    // 降りた席は手番を飛ばす。engine の folded に畳み込む
    const skip = this.state.folded.map((f, i) => f || this.folded[i] === true);
    const starter = skip[this.state.currentPlayer]
      ? skip.findIndex((f) => !f)
      : this.state.currentPlayer;

    this.state = {
      ...this.state,
      folded: skip,
      currentPlayer: starter === -1 ? this.state.currentPlayer : starter,
    };

    // 降りた結果、打つ人が1人以下になったラウンドはここで畳む。
    // 1人だけ残ったら不戦勝。相手がいないので、打たせても上がれないまま山が尽きる
    const walkover = walkoverWinner(this.match, this.folded);
    if (walkover.decided) {
      this.finishRound(walkover.winner, false);
      return;
    }

    this.phase = "PLAYING";
    this.onChange();
  }

  /** 対局中の手。**その席の番かどうかはここで見る。** */
  act(seat: number, action: GameAction): ActResult {
    if (this.phase !== "PLAYING") return { ok: false, reason: "いま打つ場面ではありません" };
    if (currentActor(this.state) !== seat) return { ok: false, reason: "あなたの番ではありません" };

    const result = applyAction(this.state, action);
    if (!result.ok) return { ok: false, reason: result.error };

    this.state = result.state;
    if (this.state.phase === "ROUND_OVER") {
      this.finishRound(this.state.winner, true);
      return { ok: true };
    }

    this.onChange();
    return { ok: true };
  }

  /**
   * @param played 実際に打って決着したか。不戦勝なら false。
   *   打っていないラウンドで「10枚上がり」や「ワイルド使用」を数えると、
   *   失点も配当も狂う。
   */
  private finishRound(winner: number | null, played = true): void {
    const hand = played && winner !== null ? (this.state.hands[winner] ?? []) : [];
    this.roundWinner = winner;
    this.roundPlayed = played;

    const result: RoundResult = {
      winner,
      baterCom10: hand.length === 10,
      usedWild: hand.some((c) => isWildCard(c, this.state.wild)),
      // 「降りた」のは、生きていて自分の意思で降りた席だけ
      folded: this.folded
        .map((f, i) => (f && isAlive(this.match, i) ? i : -1))
        .filter((i) => i >= 0),
    };

    this.lastSettlement = settleRound(this.match, result);
    this.match = this.lastSettlement.state;
    this.phase = this.match.winner !== null ? "MATCH_OVER" : "ROUND_RESULT";
    this.readyForNext.clear();
    this.onChange();

    // 人が誰も見ていないなら、待たずに進める
    this.maybeAdvance();
  }

  /** 結果画面から次へ。つながっている人が全員押したら進む。 */
  next(seat: number): ActResult {
    if (this.phase !== "ROUND_RESULT") return { ok: false, reason: "いま進む場面ではありません" };
    this.readyForNext.add(seat);
    this.onChange();
    this.maybeAdvance();
    return { ok: true };
  }

  private maybeAdvance(): void {
    if (this.phase !== "ROUND_RESULT") return;

    // **脱落した人も待つ。** 繋がっている以上は結果を見ているので、
    // 勝手に次を配ると読む間もなく流れていく（CONTINUAR は全員に出ている）。
    // 生きている人だけを待っていた頃は、破産した人の前で局が飛んでいた。
    const waitingOn = this.humanSeats().filter(
      (i) => this.isConnected(i) && !this.readyForNext.has(i)
    );
    if (waitingOn.length > 0) return;

    this.beginRound();
  }

  /* ───────────── CPU ───────────── */

  /**
   * CPU が打つべき局面か。
   * 人が座っていても、つながっていない席は CPU が代わりに打つ
   * （待っても進まないので、卓が止まるほうが害が大きい）。
   */
  needsBotStep(): boolean {
    if (this.phase !== "PLAYING") return false;
    return this.isBotControlled(currentActor(this.state));
  }

  /**
   * 打っているのが CPU だけになった対局か。（2026-09-04・ユーザー指示）
   *
   * 人は誰も打っていないが、見ている人はいる、という状態。
   * こうなると人が手を出す場面はもう来ないので、間合いを置いて見せる意味がない。
   * 呼び出し側はこれが真のあいだ `runOutRound()` で決着まで飛ばしてよい。
   *
   * **見ている人が生きているかは問わない。** 降りた人も脱落した人も、
   * 席に着いたまま CPU の応酬を見せられる立場は同じ。
   * ここで生死を条件にしていたせいで、破産した人だけが1手ずつ見せられていた。
   */
  runsOnBotsAlone(): boolean {
    if (this.phase !== "PLAYING") return false;
    // 誰も見ていない卓は畳まれるのを待つだけ。急いで進める理由がない
    if (this.isAbandoned()) return false;
    return !this.humanSeats().some((i) => this.isPlaying(i));
  }

  /**
   * 決着まで一気に打つ。**途中経過は配らない。**
   * 見せないと決めた対戦の応酬を1手ずつ配ると、盤面が高速で瞬くだけになる。
   *
   * 間合い（setTimeout）は呼び出し側の持ち物なので、ここでは時計を触らない。
   */
  runOutRound(): void {
    if (!this.runsOnBotsAlone()) return;

    this.quiet = true;
    try {
      // 打ち切りの保険。engine 側で決着するはずだが、無限には回さない
      for (let i = 0; i < 500 && this.needsBotStep(); i += 1) this.stepBot();
    } finally {
      this.quiet = false;
    }
    this.onChange();
  }

  /** CPU の1手を進める。呼び出し側が間合いを決める。 */
  stepBot(): void {
    if (!this.needsBotStep()) return;

    const action = decideAction(this.state);
    if (action === null) {
      // 打つ手が無い＝engine が想定しない局面。卓を止めないよう畳む
      this.finishRound(null, false);
      return;
    }

    const seat = currentActor(this.state);
    const result = this.act(seat, action);
    if (!result.ok) {
      // AI が不正な手を出したなら engine 側の綻び。放置すると無限に回る
      this.finishRound(null, false);
    }
  }

  /* ───────────── 配信用 ───────────── */

  /** その席に見せてよい盤面。席を持たない接続には -1 を渡す。 */
  viewFor(seat: number): PlayerView {
    // 決着したラウンドでだけ勝者の手札を開く。
    // 不戦勝は打っていないので開かない（見せるものが無い）
    const showing = this.phase === "ROUND_RESULT" || this.phase === "MATCH_OVER";
    const reveal = showing && this.roundPlayed ? this.roundWinner : null;

    if (seat < 0 || seat >= SEAT_COUNT) {
      return maskForSpectator(this.state, this.match, reveal);
    }
    return maskFor(seat, this.state, this.match, reveal);
  }

  roomInfo(): RoomInfo {
    const seats: RoomSeat[] = this.seats.map((o, i) => ({
      seat: i,
      name: o === null ? null : o.name,
      isBot: o !== null && o.kind === "BOT",
      disconnected: o !== null && o.kind === "HUMAN" && !o.connected,
      decided: this.decided[i] === true,
      ready: this.readyForNext.has(i),
    }));
    return { roomId: this.roomId, hostSeat: this.hostSeat, phase: this.phase, seats, round: this.match.round };
  }

  settlement(): RoundSettlement | null {
    return this.lastSettlement;
  }

  currentPhase(): RoomPhase {
    return this.phase;
  }

  /** その席のトークン。transport が再接続を照合するのに使う。 */
  seatOfToken(token: string): number | null {
    const seat = this.seats.findIndex(
      (o) => o !== null && o.kind === "HUMAN" && o.token === token
    );
    return seat < 0 ? null : seat;
  }

  /** 人が誰も残っていない卓。transport が畳んでよい */
  isAbandoned(): boolean {
    return !this.seats.some((o) => o !== null && o.kind === "HUMAN" && o.connected);
  }

  /* ───────────── 内部 ───────────── */

  private deal() {
    return this.rng === undefined ? dealGame(SEAT_COUNT) : dealGame(SEAT_COUNT, this.rng);
  }

  private isBotControlled(seat: number): boolean {
    const o = this.seats[seat];
    if (o === null || o === undefined) return true;
    return o.kind === "BOT" || !o.connected;
  }

  private isConnected(seat: number): boolean {
    const o = this.seats[seat];
    return o !== null && o !== undefined && o.kind === "HUMAN" && o.connected;
  }

  /** その席の人が、いまこのラウンドを打っているか。降りた・脱落した・切れたは見ているだけ */
  private isPlaying(seat: number): boolean {
    return this.isConnected(seat) && isAlive(this.match, seat) && this.folded[seat] !== true;
  }

  /** 変化を知らせる。一気に進めている最中は、途中経過を配らない */
  private onChange(): void {
    if (this.quiet) return;
    this.notify();
  }

  private humanSeats(): number[] {
    return this.seats
      .map((o, i) => (o !== null && o.kind === "HUMAN" ? i : -1))
      .filter((i) => i >= 0);
  }
}

/** 実運用のトークン。推測できないものであればよい。 */
function defaultToken(): string {
  const c = globalThis.crypto;
  if (c !== undefined && typeof c.randomUUID === "function") return c.randomUUID();
  // randomUUID の無い環境向け。テストと開発でしか通らない
  return `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/** 卓が空いているかを外から見るための補助。 */
export function seatsAvailable(room: Room): number {
  return room.roomInfo().seats.filter((s) => s.name === null).length;
}

/** 生きている席の数。ロビー表示用。 */
export function aliveCount(match: MatchState): number {
  return alivePlayers(match).length;
}
