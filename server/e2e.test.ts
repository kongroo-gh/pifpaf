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

describe("繋いで往復する", () => {
  it("JOIN すると席とトークンが返る", async () => {
    const url = await startServer();
    const client = await TestClient.connect(url);

    client.send({ t: "JOIN", version: PROTOCOL_VERSION, roomId: "r1", name: "あ" });
    const joined = await client.waitFor("JOINED");

    expect(joined.seat).toBe(0);
    expect(joined.token).toMatch(/.+/);
    client.close();
  });

  it("通信仕様が合わないと入れない", async () => {
    const url = await startServer();
    const client = await TestClient.connect(url);

    client.send({ t: "JOIN", version: PROTOCOL_VERSION + 99, roomId: "r1", name: "あ" });
    const fatal = await client.waitFor("FATAL");

    expect(fatal.reason).toContain("通信仕様");
    client.close();
  });

  it("知らない形のメッセージは断るだけで、落ちない", async () => {
    const url = await startServer();
    const client = await TestClient.connect(url);

    client.send({ t: "なんだこれ" });
    await client.waitFor("REJECTED");

    // まだ生きているので、続けて JOIN できる
    client.send({ t: "JOIN", version: PROTOCOL_VERSION, roomId: "r1", name: "あ" });
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

    a.send({ t: "JOIN", version: PROTOCOL_VERSION, roomId: "同卓", name: "あ" });
    const ja = await a.waitFor("JOINED");
    b.send({ t: "JOIN", version: PROTOCOL_VERSION, roomId: "同卓", name: "い" });
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

    a.send({ t: "JOIN", version: PROTOCOL_VERSION, roomId: "秘密", name: "あ" });
    await a.waitFor("JOINED");
    b.send({ t: "JOIN", version: PROTOCOL_VERSION, roomId: "秘密", name: "い" });
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

  it("他人の番に打とうとすると断られる", async () => {
    const url = await startServer();
    const a = await TestClient.connect(url);
    const b = await TestClient.connect(url);

    a.send({ t: "JOIN", version: PROTOCOL_VERSION, roomId: "順番", name: "あ" });
    const ja = await a.waitFor("JOINED");
    b.send({ t: "JOIN", version: PROTOCOL_VERSION, roomId: "順番", name: "い" });
    await b.waitFor("JOINED");

    a.send({ t: "START" });
    await a.waitFor("VIEW");

    a.send({ t: "FOLD", fold: false });
    b.send({ t: "FOLD", fold: false });
    await new Promise((r) => setTimeout(r, 200));

    const view = a.last("VIEW")!.view;
    // 自分の番でないほうから打たせる
    const impostor = view.game.actor === ja.seat ? b : a;
    impostor.send({ t: "ACTION", action: { type: "DRAW" } });

    const rejected = await impostor.waitFor("REJECTED");
    expect(rejected.reason).toContain("番ではありません");

    a.close();
    b.close();
  });

  it("トークンを持って入り直すと同じ席に戻る", async () => {
    const url = await startServer();
    const a = await TestClient.connect(url);

    a.send({ t: "JOIN", version: PROTOCOL_VERSION, roomId: "復帰", name: "あ" });
    const first = await a.waitFor("JOINED");
    a.send({ t: "START" });
    await a.waitFor("VIEW");
    a.close();

    await new Promise((r) => setTimeout(r, 150));

    const again = await TestClient.connect(url);
    again.send({
      t: "JOIN",
      version: PROTOCOL_VERSION,
      roomId: "復帰",
      name: "あ",
      token: first.token,
    });
    const back = await again.waitFor("JOINED");

    expect(back.seat).toBe(first.seat);
    again.close();
  });

  it("CPU が勝手に打ち進めて、盤面が届き続ける", async () => {
    const url = await startServer();
    const a = await TestClient.connect(url);

    a.send({ t: "JOIN", version: PROTOCOL_VERSION, roomId: "自動", name: "あ" });
    await a.waitFor("JOINED");
    a.send({ t: "START" });
    await a.waitFor("VIEW");

    a.send({ t: "FOLD", fold: true }); // 降りて CPU に任せる

    const before = a.received.filter((m) => m.t === "VIEW").length;
    await new Promise((r) => setTimeout(r, 2500));
    const after = a.received.filter((m) => m.t === "VIEW").length;

    // CPU が打つたびに配られるので、増えている
    expect(after).toBeGreaterThan(before);
    a.close();
  });
});
