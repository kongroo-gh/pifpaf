// 最小限の WebSocket サーバー（RFC 6455）。
//
// **`ws` を入れずに標準ライブラリだけで組んである。** 理由は2つ。
//   - この用途で要るのはテキストフレームの送受信と ping/pong だけで、
//     ライブラリの1%も使わない
//   - 置き場所を Cloudflare Workers へ移すとき、あちらは `ws` を使えない。
//     依存が無ければ、差し替えるのはこのファイルだけで済む
//
// 実装していないもの: 拡張（permessage-deflate）、断片化フレームの結合を超える
// 大きさの制御、バイナリ用途。**この卓の通信は小さな JSON しか流れない**ので足りる。

import { createServer } from "node:http";
import type { IncomingMessage, Server } from "node:http";
import { createHash } from "node:crypto";
import type { Duplex } from "node:stream";

/**
 * RFC 6455 が定める固定の合言葉。ハンドシェイクの応答を作るのに使う。
 *
 * **記憶で書くと間違える。** 実際、最後の区切りの `C` の位置を取り違えて
 * 一度つながらなくなった。規格の例
 * （key `dGhlIHNhbXBsZSBub25jZQ==` → accept `s3pPLMBiTxaQ9kYGzzhZRbK+xOo=`）
 * で照合してあり、`ws.test.ts` がそれを固定している。
 */
const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

/**
 * ハンドシェイクの応答値。`Sec-WebSocket-Key` に合言葉を足して SHA-1 → base64。
 * 検査できるよう外に出してある（`ws.test.ts` が規格の例で固定している）。
 */
export function computeAccept(key: string): string {
  return createHash("sha1").update(key + GUID).digest("base64");
}

/** 1メッセージの上限。これを超えたら切る（悪意ある巨大フレーム対策） */
const MAX_MESSAGE_BYTES = 256 * 1024;

export interface WsConnection {
  readonly id: number;
  send(text: string): void;
  close(reason?: string): void;
  readonly closed: boolean;
  /** 好きなものを結びつけておける場所。ここでは席とトークンを入れる */
  data: Record<string, unknown>;
}

export interface WsHandlers {
  onOpen?(conn: WsConnection, req: IncomingMessage): void;
  onMessage?(conn: WsConnection, text: string): void;
  onClose?(conn: WsConnection): void;
}

let nextId = 1;

/**
 * HTTP サーバーを立て、Upgrade 要求を WebSocket に持ち上げる。
 * `staticHandler` を渡すと、通常の HTTP 要求はそちらに回す（動作確認用のページなど）。
 */
export function createWsServer(
  handlers: WsHandlers,
  staticHandler?: (req: IncomingMessage, res: import("node:http").ServerResponse) => void
): Server {
  const server = createServer((req, res) => {
    if (staticHandler !== undefined) {
      staticHandler(req, res);
      return;
    }
    res.writeHead(426, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("WebSocket でつないでください\n");
  });

  server.on("upgrade", (req, socket) => {
    const key = req.headers["sec-websocket-key"];
    if (typeof key !== "string" || req.headers["upgrade"]?.toLowerCase() !== "websocket") {
      socket.destroy();
      return;
    }

    const accept = computeAccept(key);
    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\n" +
        "Upgrade: websocket\r\n" +
        "Connection: Upgrade\r\n" +
        `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
    );

    attach(socket, req, handlers);
  });

  return server;
}

function attach(socket: Duplex, req: IncomingMessage, handlers: WsHandlers): void {
  let closed = false;
  let buffer = Buffer.alloc(0);
  /** 断片化されたテキストメッセージの積み上げ先 */
  let fragments: Buffer[] = [];

  const conn: WsConnection = {
    id: nextId++,
    data: {},
    get closed() {
      return closed;
    },
    send(text: string) {
      if (closed) return;
      socket.write(encodeFrame(0x1, Buffer.from(text, "utf8")));
    },
    close(reason = "") {
      if (closed) return;
      closed = true;
      // 1000 = 正常終了
      const payload = Buffer.concat([
        Buffer.from([0x03, 0xe8]),
        Buffer.from(reason.slice(0, 100), "utf8"),
      ]);
      socket.write(encodeFrame(0x8, payload));
      socket.end();
    },
  };

  const finish = (): void => {
    if (closed) {
      // close() 経由でもここに来る。二重に通知しない
      handlers.onClose?.(conn);
      return;
    }
    closed = true;
    handlers.onClose?.(conn);
  };

  socket.on("data", (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);

    for (;;) {
      const frame = decodeFrame(buffer);
      if (frame === null) break; // まだ足りない
      if (frame === "INVALID") {
        conn.close("壊れたフレーム");
        socket.destroy();
        return;
      }
      buffer = buffer.subarray(frame.consumed);

      switch (frame.opcode) {
        case 0x0: // 継続
        case 0x1: {
          // テキスト
          fragments.push(frame.payload);
          const total = fragments.reduce((n, b) => n + b.length, 0);
          if (total > MAX_MESSAGE_BYTES) {
            conn.close("メッセージが大きすぎます");
            socket.destroy();
            return;
          }
          if (frame.fin) {
            const text = Buffer.concat(fragments).toString("utf8");
            fragments = [];
            handlers.onMessage?.(conn, text);
          }
          break;
        }
        case 0x8:
          // 相手からの「閉じる」。**同じフレームを返してから切る。**
          // 返さずに TCP を切ると、相手には異常終了（1006）に見える
          if (!closed) {
            closed = true;
            socket.write(encodeFrame(0x8, frame.payload));
          }
          socket.end();
          return;
        case 0x9: // ping → pong を返す
          socket.write(encodeFrame(0xa, frame.payload));
          break;
        case 0xa: // pong。何もしない
          break;
        default:
          // バイナリなどは使わない
          conn.close("対応していない種別です");
          socket.destroy();
          return;
      }
    }
  });

  socket.on("close", finish);
  socket.on("error", () => {
    closed = true;
    socket.destroy();
  });

  handlers.onOpen?.(conn, req);
}

/** サーバーからの送信はマスクしない（RFC 6455 の定め）。 */
export function encodeFrame(opcode: number, payload: Buffer): Buffer {
  const len = payload.length;
  let header: Buffer;

  if (len < 126) {
    header = Buffer.from([0x80 | opcode, len]);
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    // 4GB 未満しか送らないので上位32bitは0
    header.writeUInt32BE(0, 2);
    header.writeUInt32BE(len, 6);
  }

  return Buffer.concat([header, payload]);
}

export interface DecodedFrame {
  fin: boolean;
  opcode: number;
  payload: Buffer;
  /** このフレームが消費したバイト数 */
  consumed: number;
}

/**
 * 先頭の1フレームを取り出す。
 * @returns 足りなければ null、壊れていれば "INVALID"
 */
export function decodeFrame(buf: Buffer): DecodedFrame | null | "INVALID" {
  if (buf.length < 2) return null;

  const first = buf[0]!;
  const second = buf[1]!;
  const fin = (first & 0x80) !== 0;
  const opcode = first & 0x0f;
  const masked = (second & 0x80) !== 0;
  let len = second & 0x7f;
  let offset = 2;

  if (len === 126) {
    if (buf.length < offset + 2) return null;
    len = buf.readUInt16BE(offset);
    offset += 2;
  } else if (len === 127) {
    if (buf.length < offset + 8) return null;
    const high = buf.readUInt32BE(offset);
    // 4GB 超は扱わない。こんなものを送ってくる相手は切る
    if (high !== 0) return "INVALID";
    len = buf.readUInt32BE(offset + 4);
    offset += 8;
  }

  if (len > MAX_MESSAGE_BYTES) return "INVALID";

  // クライアントからのフレームは必ずマスクされている（RFC 6455）
  if (!masked) return "INVALID";
  if (buf.length < offset + 4) return null;
  const maskKey = buf.subarray(offset, offset + 4);
  offset += 4;

  if (buf.length < offset + len) return null;
  const payload = Buffer.from(buf.subarray(offset, offset + len));
  for (let i = 0; i < payload.length; i++) {
    payload[i] = payload[i]! ^ maskKey[i % 4]!;
  }

  return { fin, opcode, payload, consumed: offset + len };
}
