// 実際にポートを開いて、本物のクライアントで往復させる。
//
// `ws.ts` は自前実装なので、ハンドシェイクとフレームの組み立てが
// 本当に規格どおりかを机上で確かめても意味がない。**繋いでみる**しかない。
// クライアント側は Node 22 以降が持っている `WebSocket`（undici）を使う。
// これは自前実装ではないので、両者が合っていれば規格に合っている。

import { describe, it, expect, afterEach } from "vitest";
import type { Server } from "node:http";
import { createWsServer } from "./ws.ts";
import { Hub } from "./hub.ts";
import { PROTOCOL_VERSION } from "@pifpaf/protocol";
import type { ServerMessage } from "@pifpaf/protocol";

let running: Server | null = null;
let hub: Hub | null = null;
/** 開いた口は必ず閉じる。1つでも残ると server.close() が返ってこない */
const opened: TestClient[] = [];

afterEach(async () => {
  for (const c of opened) c.close();
  opened.length = 0;
  hub?.stop();
  hub = null;
  if (running !== null) {
    // 検査が途中で失敗しても止まらないよう、残った接続は強制的に切る
    running.closeAllConnections?.();
    await new Promise<void>((resolve) => running!.close(() => resolve()));
    running = null;
  }
});

async function startServer(): Promise<string> {
  hub = new Hub();
  hub.start();
  const h = hub;
  const server = createWsServer({
    onOpen: (c) => h.handleOpen(c),
    onMessage: (c, t) => h.handleMessage(c, t),
    onClose: (c) => h.handleClose(c),
  });
  running = server;

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("ポートが取れない");
  return `ws://127.0.0.1:${address.port}`;
}

/** 受け取ったメッセージを溜めておく、テスト用の薄い口。 */
class TestClient {
  readonly received: ServerMessage[] = [];
  private socket: WebSocket;

  private constructor(socket: WebSocket) {
    this.socket = socket;
    socket.addEventListener("message", (ev) => {
      this.received.push(JSON.parse(String(ev.data)) as ServerMessage);
    });
  }

  static async connect(url: string): Promise<TestClient> {
    const socket = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      socket.addEventListener("open", () => resolve(), { once: true });
      socket.addEventListener("error", () => reject(new Error("繋がらない")), { once: true });
    });
    const client = new TestClient(socket);
    opened.push(client);
    return client;
  }

  send(msg: unknown): void {
    this.socket.send(JSON.stringify(msg));
  }

  /** JSON 化せずそのまま送る。壊れた入力を試すのに使う */
  sendRaw(text: string): void {
    this.socket.send(text);
  }

  close(): void {
    this.socket.close();
  }

  /** 条件に合うメッセージが来るまで待つ。 */
  async waitFor<T extends ServerMessage["t"]>(
    type: T,
    timeoutMs = 3000
  ): Promise<Extract<ServerMessage, { t: T }>> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const hit = this.received.find((m) => m.t === type);
      if (hit !== undefined) return hit as Extract<ServerMessage, { t: T }>;
      if (Date.now() > deadline) {
        throw new Error(
          `${type} が来ない。来たのは: ${this.received.map((m) => m.t).join(", ")}`
        );
      }
      await new Promise((r) => setTimeout(r, 20));
    }
  }

  last<T extends ServerMessage["t"]>(type: T): Extract<ServerMessage, { t: T }> | undefined {
    const hits = this.received.filter((m) => m.t === type);
    return hits[hits.length - 1] as Extract<ServerMessage, { t: T }> | undefined;
  }
}

/**
 * 4人そろえて START まで進めた卓を返す。
 * オンライン卓は4人そろわないと始まらないので、対局中を試すテストはここを通る。
 * 返すのは全クライアントと、ホスト（[0]）の JOINED。
 */
async function startedTable(
  url: string
): Promise<{ clients: TestClient[]; host: Extract<ServerMessage, { t: "JOINED" }> }> {
  const clients = await Promise.all([0, 1, 2, 3].map(() => TestClient.connect(url)));
  const [a, b, c, d] = clients as [TestClient, TestClient, TestClient, TestClient];

  a.send({ t: "CREATE", version: PROTOCOL_VERSION, name: "あ" });
  const host = await a.waitFor("JOINED");
  for (const [client, name] of [
    [b, "い"],
    [c, "う"],
    [d, "え"],
  ] as const) {
    client.send({ t: "JOIN", version: PROTOCOL_VERSION, roomId: host.roomId, name });
    await client.waitFor("JOINED");
  }

  a.send({ t: "START" });
  // START が通ると FOLD_DECISION に移る。ここまで来て初めて「始まった」
  const deadline = Date.now() + 3000;
  while (a.last("ROOM")?.room.phase !== "FOLD_DECISION") {
    if (Date.now() > deadline) throw new Error("START しても始まらない");
    await new Promise((r) => setTimeout(r, 20));
  }
  return { clients, host };
}

describe("繋いで往復する", () => {
  it("CREATE すると短いコード、席、トークンが返る", async () => {
    const url = await startServer();
    const client = await TestClient.connect(url);

    client.send({ t: "CREATE", version: PROTOCOL_VERSION, name: "あ" });
    const joined = await client.waitFor("JOINED");

    expect(joined.seat).toBe(0);
    expect(joined.roomId).toMatch(/^[A-Z2-9]{4}$/);
    expect(joined.token).toMatch(/.+/);
    client.close();
  });

  it("通信仕様が合わないと入れない", async () => {
    const url = await startServer();
    const client = await TestClient.connect(url);

    client.send({ t: "CREATE", version: PROTOCOL_VERSION + 99, name: "あ" });
    const fatal = await client.waitFor("FATAL");

    expect(fatal.reason).toContain("再読み込み");
    client.close();
  });

  it("知らない形のメッセージは断るだけで、落ちない", async () => {
    const url = await startServer();
    const client = await TestClient.connect(url);

    client.send({ t: "なんだこれ" });
    await client.waitFor("REJECTED");

    // まだ生きているので、続けて卓を作れる
    client.send({ t: "CREATE", version: PROTOCOL_VERSION, name: "あ" });
    await client.waitFor("JOINED");
    client.close();
  });

  it("JSON でない文字列を送っても落ちない", async () => {
    const url = await startServer();
    const client = await TestClient.connect(url);

    // send() は JSON 化してしまうので、生のまま送る
    client.sendRaw("これはJSONではない{");
    const rejected = await client.waitFor("REJECTED");
    expect(rejected.reason).toContain("JSON");
    client.close();
  });

  it("2人が同じ卓に入ると、別々の席になる", async () => {
    const url = await startServer();
    const a = await TestClient.connect(url);
    const b = await TestClient.connect(url);

    a.send({ t: "CREATE", version: PROTOCOL_VERSION, name: "あ" });
    const ja = await a.waitFor("JOINED");
    b.send({ t: "JOIN", version: PROTOCOL_VERSION, roomId: ja.roomId, name: "い" });
    const jb = await b.waitFor("JOINED");

    expect(ja.seat).not.toBe(jb.seat);

    // 相手が来たことは両方に伝わる
    const roomA = a.last("ROOM");
    expect(roomA?.room.seats.filter((s) => s.name !== null)).toHaveLength(2);

    a.close();
    b.close();
  });

  it("配られる盤面に相手の手札は入っていない", async () => {
    const url = await startServer();
    const a = await TestClient.connect(url);
    const b = await TestClient.connect(url);

    a.send({ t: "CREATE", version: PROTOCOL_VERSION, name: "あ" });
    const host = await a.waitFor("JOINED");
    b.send({ t: "JOIN", version: PROTOCOL_VERSION, roomId: host.roomId, name: "い" });
    await b.waitFor("JOINED");

    a.send({ t: "START" });
    await a.waitFor("VIEW");
    await b.waitFor("VIEW");

    const viewA = a.last("VIEW")!.view;
    const viewB = b.last("VIEW")!.view;

    expect(viewA.game.hand).toHaveLength(9);
    expect(viewB.game.hand).toHaveLength(9);

    // 生の文字列で見ても、相手の札の id は現れない
    const jsonA = JSON.stringify(viewA);
    for (const card of viewB.game.hand) {
      expect(jsonA).not.toContain(card.id);
    }

    a.close();
    b.close();
  });

  it("4人そろわないと START しても始まらない", async () => {
    const url = await startServer();
    const a = await TestClient.connect(url);
    const b = await TestClient.connect(url);

    a.send({ t: "CREATE", version: PROTOCOL_VERSION, name: "あ" });
    const ja = await a.waitFor("JOINED");
    b.send({ t: "JOIN", version: PROTOCOL_VERSION, roomId: ja.roomId, name: "い" });
    await b.waitFor("JOINED");

    a.send({ t: "START" });
    const rejected = await a.waitFor("REJECTED");
    expect(rejected.reason).toContain("そろ");
    // 断られただけで、卓はまだ人を待っている
    expect(a.last("ROOM")!.room.phase).toBe("WAITING");

    a.close();
    b.close();
  });

  it("集まらなければ CPU を呼んで始められる", async () => {
    const url = await startServer();
    const a = await TestClient.connect(url);
    const b = await TestClient.connect(url);

    a.send({ t: "CREATE", version: PROTOCOL_VERSION, name: "あ" });
    const ja = await a.waitFor("JOINED");
    b.send({ t: "JOIN", version: PROTOCOL_VERSION, roomId: ja.roomId, name: "い" });
    await b.waitFor("JOINED");

    // 人を待つのをやめ、空席を CPU に任せる
    a.send({ t: "START", fillWithBots: true });

    const deadline = Date.now() + 3000;
    while (a.last("ROOM")?.room.phase === "WAITING") {
      if (Date.now() > deadline) throw new Error("CPU を呼んでも始まらない");
      await new Promise((r) => setTimeout(r, 20));
    }

    const seats = a.last("ROOM")!.room.seats;
    expect(seats.filter((s) => s.isBot)).toHaveLength(2);
    expect(seats.filter((s) => s.name !== null && !s.isBot)).toHaveLength(2);

    a.close();
    b.close();
  });

  it("他人の番に打とうとすると断られる", async () => {
    const url = await startServer();
    const { clients } = await startedTable(url);
    // clients の添字が席番号（CREATE は席0、以降 JOIN 順）
    const [a] = clients as [TestClient];

    for (const client of clients) client.send({ t: "FOLD", fold: false });
    await new Promise((r) => setTimeout(r, 200));

    const view = a.last("VIEW")!.view;
    // 自分の番でないところから打たせる
    const impostor = clients[(view.game.actor + 1) % 4]!;
    impostor.send({ t: "ACTION", action: { type: "DRAW" } });

    const rejected = await impostor.waitFor("REJECTED");
    expect(rejected.reason).toContain("番ではありません");

    for (const client of clients) client.close();
  });

  it("対局中に1人抜けたら、残った人の画面に「畳んだ」が届く", async () => {
    const url = await startServer();
    const { clients, host } = await startedTable(url);
    const watcher = clients[1]!;

    clients[0]!.close();

    const deadline = Date.now() + 3000;
    while (watcher.last("ROOM")?.room.phase !== "CLOSED") {
      if (Date.now() > deadline) {
        throw new Error(`畳まれない（phase=${watcher.last("ROOM")?.room.phase}）`);
      }
      await new Promise((r) => setTimeout(r, 20));
    }
    // 抜けた人が誰かは残った画面から見える（席は消さない）
    const seat = watcher.last("ROOM")!.room.seats[host.seat]!;
    expect(seat.disconnected).toBe(true);
    expect(seat.name).not.toBeNull();

    // 畳んだ卓には、トークンを持っていても戻れない
    const again = await TestClient.connect(url);
    again.send({
      t: "JOIN",
      version: PROTOCOL_VERSION,
      roomId: host.roomId,
      name: "あ",
      token: host.token,
    });
    const refused = await again.waitFor("REJECTED");
    expect(refused.reason).toContain("畳まれ");

    again.close();
    for (const client of clients.slice(1)) client.close();
  });

  it("打つ人が CPU だけになったら、対戦を見せずに結果まで飛ぶ", async () => {
    const url = await startServer();
    // 人が集まらないので CPU を呼んだ卓。観戦役は降りて見ているだけにする
    const observer = await TestClient.connect(url);
    observer.send({ t: "CREATE", version: PROTOCOL_VERSION, name: "あ" });
    await observer.waitFor("JOINED");
    observer.send({ t: "START", fillWithBots: true });

    const started = Date.now() + 3000;
    while (observer.last("ROOM")?.room.phase !== "FOLD_DECISION") {
      if (Date.now() > started) throw new Error("START しても始まらない");
      await new Promise((r) => setTimeout(r, 20));
    }

    const before = observer.received.filter((m) => m.t === "VIEW").length;
    observer.send({ t: "FOLD", fold: true });

    // 1手ずつ間合い（900ms）を置いて流したら数十秒かかる場面。
    // 見せる相手がいないので飛ばしており、結果はすぐ届く
    const t0 = Date.now();
    const deadline = t0 + 4000;
    for (;;) {
      const phase = observer.last("ROOM")?.room.phase;
      if (phase === "ROUND_RESULT" || phase === "MATCH_OVER") break;
      if (Date.now() > deadline) throw new Error(`結果まで来ない（phase=${phase}）`);
      await new Promise((r) => setTimeout(r, 20));
    }
    expect(Date.now() - t0).toBeLessThan(3000);

    // 途中経過は配らないが、決着した盤面は届いている
    const after = observer.received.filter((m) => m.t === "VIEW").length;
    expect(after).toBeGreaterThan(before);
    observer.close();
  });
});
