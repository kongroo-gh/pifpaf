// 自前の WebSocket 実装のうち、規格に照らして「正しさが一意に決まる」部分。
//
// 繋いでみる検査は e2e.test.ts にある。こちらは、**間違えても静かに壊れる**
// 箇所を数値で固定するためのもの。ハンドシェイクの合言葉を記憶で書いて
// 一度つながらなくしたので、その再発を止める。

import { describe, it, expect } from "vitest";
import { computeAccept, encodeFrame, decodeFrame } from "./ws.ts";

describe("ハンドシェイク", () => {
  // RFC 6455 が載せている唯一の具体例。これが合えば合言葉も手順も合っている
  it("規格の例と一致する", () => {
    expect(computeAccept("dGhlIHNhbXBsZSBub25jZQ==")).toBe("s3pPLMBiTxaQ9kYGzzhZRbK+xOo=");
  });
});

/** クライアントが送る形（マスクあり）のフレームを組む。 */
function maskedFrame(opcode: number, payload: Buffer, mask = Buffer.from([1, 2, 3, 4])): Buffer {
  const masked = Buffer.from(payload);
  for (let i = 0; i < masked.length; i++) masked[i] = masked[i]! ^ mask[i % 4]!;

  const len = masked.length;
  let header: Buffer;
  if (len < 126) {
    header = Buffer.from([0x80 | opcode, 0x80 | len]);
  } else {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 0x80 | 126;
    header.writeUInt16BE(len, 2);
  }
  return Buffer.concat([header, mask, masked]);
}

describe("フレームの復号", () => {
  it("短いテキストを読む", () => {
    const frame = maskedFrame(0x1, Buffer.from("こんにちは", "utf8"));
    const decoded = decodeFrame(frame);
    if (decoded === null || decoded === "INVALID") throw new Error("読めない");

    expect(decoded.opcode).toBe(0x1);
    expect(decoded.fin).toBe(true);
    expect(decoded.payload.toString("utf8")).toBe("こんにちは");
    expect(decoded.consumed).toBe(frame.length);
  });

  it("126バイト以上の長さ指定を読む", () => {
    const text = "あ".repeat(200); // UTF-8 で 600 バイト
    const frame = maskedFrame(0x1, Buffer.from(text, "utf8"));
    const decoded = decodeFrame(frame);
    if (decoded === null || decoded === "INVALID") throw new Error("読めない");
    expect(decoded.payload.toString("utf8")).toBe(text);
  });

  it("途中までしか届いていなければ null（まだ待つ）", () => {
    const frame = maskedFrame(0x1, Buffer.from("hello"));
    expect(decodeFrame(frame.subarray(0, 3))).toBeNull();
    expect(decodeFrame(Buffer.alloc(0))).toBeNull();
  });

  // マスクされていないフレームをクライアントが送るのは規格違反。
  // 受け入れると、間に何かが挟まっている場合に誤って解釈する
  it("マスクの無いフレームは撥ねる", () => {
    const unmasked = Buffer.concat([Buffer.from([0x81, 0x05]), Buffer.from("hello")]);
    expect(decodeFrame(unmasked)).toBe("INVALID");
  });

  it("巨大すぎる長さは撥ねる", () => {
    const header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 0x80 | 127;
    header.writeUInt32BE(1, 2); // 上位32bitが非ゼロ＝4GB超
    header.writeUInt32BE(0, 6);
    expect(decodeFrame(header)).toBe("INVALID");
  });

  it("2つ続けて届いても1つずつ取り出せる", () => {
    const a = maskedFrame(0x1, Buffer.from("one"));
    const b = maskedFrame(0x1, Buffer.from("two"));
    const both = Buffer.concat([a, b]);

    const first = decodeFrame(both);
    if (first === null || first === "INVALID") throw new Error("読めない");
    expect(first.payload.toString()).toBe("one");

    const second = decodeFrame(both.subarray(first.consumed));
    if (second === null || second === "INVALID") throw new Error("読めない");
    expect(second.payload.toString()).toBe("two");
  });
});

describe("フレームの符号化", () => {
  it("サーバーからの送信にマスクは付けない", () => {
    const frame = encodeFrame(0x1, Buffer.from("hi"));
    expect(frame[0]).toBe(0x81); // FIN + テキスト
    expect(frame[1]! & 0x80).toBe(0); // マスクビットは立てない
    expect(frame[1]! & 0x7f).toBe(2);
    expect(frame.subarray(2).toString()).toBe("hi");
  });

  it("126バイト以上は2バイトの長さ欄になる", () => {
    const payload = Buffer.alloc(300, 0x61);
    const frame = encodeFrame(0x1, payload);
    expect(frame[1]! & 0x7f).toBe(126);
    expect(frame.readUInt16BE(2)).toBe(300);
    expect(frame.length).toBe(4 + 300);
  });
});
