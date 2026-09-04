// 卓と接続の突き合わせ。
//
// `Room` は通信を知らず、`ws.ts` はゲームを知らない。その二つを繋ぐのがここ。
// **CPU の間合い（setTimeout）もここが持つ。** Room に置くと決定性が壊れるので、
// 「人に見せるための間」は通信側の関心事として外に出してある。

import { Room } from "./room.ts";
import type { WsConnection } from "./ws.ts";
import { PROTOCOL_VERSION, parseClientMessage } from "@pifpaf/protocol";
import type { ClientMessage, ServerMessage } from "@pifpaf/protocol";

/** CPU が1手打つまでの間。単機版の「ふつう」に合わせてある */
const BOT_DELAY_MS = 900;

/** 応答が無い接続を切るまで */
const PING_INTERVAL_MS = 25_000;
const PONG_TIMEOUT_MS = 60_000;

/** 人が誰もいなくなった卓を畳むまで */
const EMPTY_ROOM_TTL_MS = 5 * 60_000;

/**
 * 消えた人の戻りを待つ時間（2026-09-04・ユーザー指示）。
 * このあいだ卓は止まる。戻らなければ卓を畳む。
 *
 * 短すぎると電車に入っただけで卓が消え、長すぎると残った人が待たされる。
 * 自動再接続は 0.5 秒から倍々で最大10秒間隔なので、30秒あれば数回は試せる。
 */
const ABSENCE_GRACE_MS = 30_000;

interface Member {
  conn: WsConnection;
  roomId: string;
  seat: number;
  lastSeen: number;
}

export class Hub {
  private rooms = new Map<string, Room>();
  private members = new Map<number, Member>();
  /** 卓ごとの CPU タイマー。二重に走らせない */
  private botTimers = new Map<string, ReturnType<typeof setTimeout>>();
  /** 卓ごとの「戻りを待つ」タイマー */
  private absenceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private emptySince = new Map<string, number>();

  private housekeeping: ReturnType<typeof setInterval> | null = null;

  start(): void {
    if (this.housekeeping !== null) return;
    this.housekeeping = setInterval(() => this.sweep(), PING_INTERVAL_MS);
    // Node を止めない。卓が無いときにプロセスが終われるようにしておく
    this.housekeeping.unref?.();
  }

  stop(): void {
    if (this.housekeeping !== null) clearInterval(this.housekeeping);
    this.housekeeping = null;
    for (const timer of this.botTimers.values()) clearTimeout(timer);
    this.botTimers.clear();
    for (const timer of this.absenceTimers.values()) clearTimeout(timer);
    this.absenceTimers.clear();
  }

  handleOpen(conn: WsConnection): void {
    // JOIN が来るまで席は決まらない
    conn.data["joined"] = false;
  }

  handleMessage(conn: WsConnection, text: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      this.send(conn, { t: "REJECTED", reason: "JSON として読めません" });
      return;
    }

    const msg = parseClientMessage(parsed);
    if (msg === null) {
      this.send(conn, { t: "REJECTED", reason: "知らない形のメッセージです" });
      return;
    }

    const member = this.members.get(conn.id);
    if (member !== undefined) member.lastSeen = Date.now();

    if (msg.t === "CREATE") {
      this.handleCreate(conn, msg);
      return;
    }
    if (msg.t === "JOIN") {
      this.handleJoin(conn, msg);
      return;
    }
    if (msg.t === "PONG") return;

    if (member === undefined) {
      this.send(conn, { t: "REJECTED", reason: "先に JOIN してください" });
      return;
    }
    const room = this.rooms.get(member.roomId);
    if (room === undefined) {
      this.send(conn, { t: "FATAL", reason: "卓が消えています" });
      conn.close();
      return;
    }

    this.handleRoomMessage(room, member, msg);
  }

  handleClose(conn: WsConnection): void {
    const member = this.members.get(conn.id);
    if (member === undefined) return;
    this.members.delete(conn.id);

    const room = this.rooms.get(member.roomId);
    if (room === undefined) return;

    room.disconnect(member.seat);
    this.syncAbsence(room);
    this.broadcast(room);
    this.scheduleBot(room);

    if (room.isAbandoned()) this.emptySince.set(room.roomId, Date.now());
  }

  /**
   * 「戻りを待つ」時計の面倒を見る。**時計を持つのはここだけ。**
   * 待ち始めたら期限を切り、戻ってきたら止める。
   */
  private syncAbsence(room: Room): void {
    const running = this.absenceTimers.get(room.roomId);

    if (!room.isAwaiting()) {
      if (running !== undefined) {
        clearTimeout(running);
        this.absenceTimers.delete(room.roomId);
        room.setAwaitingUntil(null);
      }
      return;
    }

    // すでに待っているなら期限は延ばさない。何度も切れる人を待ち続けないため
    if (running !== undefined) return;

    room.setAwaitingUntil(Date.now() + ABSENCE_GRACE_MS);
    const timer = setTimeout(() => {
      this.absenceTimers.delete(room.roomId);
      if (!this.rooms.has(room.roomId)) return;
      room.giveUpWaiting();
      this.broadcast(room);
    }, ABSENCE_GRACE_MS);
    timer.unref?.();
    this.absenceTimers.set(room.roomId, timer);
  }

  /* ───────────── 中身 ───────────── */

  private handleCreate(conn: WsConnection, msg: Extract<ClientMessage, { t: "CREATE" }>): void {
    if (!this.checkVersion(conn, msg.version) || this.members.has(conn.id)) return;
    const roomId = this.makeRoomCode();
    const room = new Room({ roomId, onChange: () => this.broadcast(room) });
    this.rooms.set(roomId, room);
    this.joinRoom(conn, room, msg.name);
  }

  private handleJoin(conn: WsConnection, msg: Extract<ClientMessage, { t: "JOIN" }>): void {
    if (!this.checkVersion(conn, msg.version)) return;

    // 同じ接続で二度 JOIN しない
    if (this.members.has(conn.id)) {
      this.send(conn, { t: "REJECTED", reason: "すでに入室しています" });
      return;
    }

    const room = this.rooms.get(msg.roomId.toUpperCase());
    if (room === undefined) {
      this.send(conn, { t: "FATAL", reason: "その接続コードの卓は見つかりません" });
      return;
    }

    this.joinRoom(conn, room, msg.name, msg.token);
  }

  private joinRoom(conn: WsConnection, room: Room, name: string, token?: string): void {
    const roomId = room.roomId;

    const joined = room.join(name, token);
    if (!joined.ok) {
      this.send(conn, { t: "REJECTED", reason: joined.reason });
      return;
    }

    // 同じ席に別の接続が残っていたら、古いほうを切る（多重ログイン対策）
    for (const [id, m] of this.members) {
      if (m.roomId === roomId && m.seat === joined.seat && id !== conn.id) {
        this.send(m.conn, { t: "FATAL", reason: "別の端末から同じ席に入りました" });
        m.conn.close();
        this.members.delete(id);
      }
    }

    this.members.set(conn.id, {
      conn,
      roomId,
      seat: joined.seat,
      lastSeen: Date.now(),
    });
    this.emptySince.delete(roomId);

    this.send(conn, {
      t: "JOINED",
      roomId,
      seat: joined.seat,
      token: joined.token,
    });
    // 戻ってきたぶん、待ちが解けているかもしれない
    this.syncAbsence(room);
    this.broadcast(room);
    this.scheduleBot(room);
  }

  private checkVersion(conn: WsConnection, version: number): boolean {
    if (version === PROTOCOL_VERSION) return true;
    this.send(conn, { t: "FATAL", reason: "ゲームの版が更新されています。画面を再読み込みしてください" });
    conn.close();
    return false;
  }

  private makeRoomCode(): string {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    for (let attempt = 0; attempt < 100; attempt++) {
      let code = "";
      for (let i = 0; i < 4; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
      if (!this.rooms.has(code)) return code;
    }
    return Date.now().toString(36).slice(-6).toUpperCase();
  }

  private handleRoomMessage(room: Room, member: Member, msg: ClientMessage): void {
    switch (msg.t) {
      case "START": {
        if (room.roomInfo().hostSeat !== member.seat) {
          this.send(member.conn, { t: "REJECTED", reason: "開始できるのはホストだけです" });
          break;
        }
        const r = room.start(msg.fillWithBots === true);
        if (!r.ok) this.send(member.conn, { t: "REJECTED", reason: r.reason });
        break;
      }
      case "FOLD": {
        const r = room.setFold(member.seat, msg.fold);
        if (!r.ok) this.send(member.conn, { t: "REJECTED", reason: r.reason });
        break;
      }
      case "ACTION": {
        const r = room.act(member.seat, msg.action);
        if (!r.ok) {
          this.send(member.conn, { t: "REJECTED", reason: r.reason });
          // 断られたということは、その人の画面が古い。今の盤面を送り直す
          this.sendView(room, member);
        }
        break;
      }
      case "NEXT": {
        const r = room.next(member.seat);
        if (!r.ok) this.send(member.conn, { t: "REJECTED", reason: r.reason });
        break;
      }
      case "LEAVE": {
        // 自分から降りた人は待っても戻らない。猶予を挟まずに畳む
        room.leave(member.seat);
        this.syncAbsence(room);
        break;
      }
      default:
        break;
    }
    this.scheduleBot(room);
  }

  /**
   * CPU の番なら、少し待ってから1手打つ。
   * 打ったあとに `onChange` → `broadcast` が走り、必要ならまた自分を予約する。
   */
  private scheduleBot(room: Room): void {
    if (!room.needsBotStep()) return;

    // 打っているのが CPU だけになった卓は、間合いを置いて見せる相手がいない。
    // 待たせるだけなので決着まで飛ばし、結果だけを配る（単機版と同じ扱い）。
    //
    // **保留中の間合いより先に見る。** 前の局の予約が残っているうちに次の局が
    // 始まると、その予約が消えるまで飛ばせず、1手ぶん間合い付きで漏れる
    if (room.runsOnBotsAlone()) {
      const pending = this.botTimers.get(room.roomId);
      if (pending !== undefined) {
        clearTimeout(pending);
        this.botTimers.delete(room.roomId);
      }
      room.runOutRound();
      return;
    }

    if (this.botTimers.has(room.roomId)) return;

    const timer = setTimeout(() => {
      this.botTimers.delete(room.roomId);
      if (!this.rooms.has(room.roomId)) return;
      room.stepBot();
      this.scheduleBot(room);
    }, BOT_DELAY_MS);

    timer.unref?.();
    this.botTimers.set(room.roomId, timer);
  }

  /** その卓の全員に、それぞれの視点で配る。 */
  private broadcast(room: Room): void {
    const info = room.roomInfo();
    const settlement = room.settlement();

    for (const member of this.members.values()) {
      if (member.roomId !== room.roomId) continue;
      this.send(member.conn, { t: "ROOM", room: info });
      this.sendView(room, member);
      if (settlement !== null) {
        this.send(member.conn, {
          t: "SETTLEMENT",
          losses: settlement.losses,
          eliminated: settlement.eliminated,
        });
      }
    }

    // 配ったあとで CPU の番になっているかもしれない
    this.scheduleBot(room);
  }

  private sendView(room: Room, member: Member): void {
    this.send(member.conn, { t: "VIEW", view: room.viewFor(member.seat) });
  }

  private send(conn: WsConnection, msg: ServerMessage): void {
    conn.send(JSON.stringify(msg));
  }

  /** 反応の無い接続を切り、誰もいない卓を畳む。 */
  private sweep(): void {
    const now = Date.now();

    for (const [id, member] of this.members) {
      if (member.conn.closed) {
        this.members.delete(id);
        continue;
      }
      if (now - member.lastSeen > PONG_TIMEOUT_MS) {
        member.conn.close("応答がありません");
        this.members.delete(id);
        const room = this.rooms.get(member.roomId);
        if (room !== undefined) {
          room.disconnect(member.seat);
          this.syncAbsence(room);
          this.broadcast(room);
        }
        continue;
      }
      this.send(member.conn, { t: "PING" });
    }

    for (const [roomId, room] of this.rooms) {
      if (!room.isAbandoned()) {
        this.emptySince.delete(roomId);
        continue;
      }
      const since = this.emptySince.get(roomId);
      if (since === undefined) {
        this.emptySince.set(roomId, now);
        continue;
      }
      if (now - since > EMPTY_ROOM_TTL_MS) {
        for (const timers of [this.botTimers, this.absenceTimers]) {
          const timer = timers.get(roomId);
          if (timer !== undefined) clearTimeout(timer);
          timers.delete(roomId);
        }
        this.rooms.delete(roomId);
        this.emptySince.delete(roomId);
      }
    }
  }

  /** 動作確認用。いま立っている卓の一覧。 */
  listRooms(): { roomId: string; phase: string; humans: number }[] {
    return [...this.rooms.values()].map((room) => {
      const info = room.roomInfo();
      return {
        roomId: info.roomId,
        phase: info.phase,
        humans: info.seats.filter((s) => s.name !== null && !s.isBot).length,
      };
    });
  }
}
