// 起動口。
//
//   node --experimental-strip-types server/index.ts
//   （Node 24 は .ts をそのまま実行できるので、ビルド段階は要らない）
//
// 環境変数:
//   PORT   … 待ち受けるポート（既定 8787）
//   HOST   … 待ち受けるアドレス（既定 127.0.0.1）
//
// **既定で localhost にしか出さない。** 外に出すかどうかは運用の判断で、
// 迷ったら閉じているほうが安全なため。公開するときは HOST=0.0.0.0 を明示する。

import { createWsServer } from "./ws";
import { Hub } from "./hub";

const PORT = Number(process.env["PORT"] ?? 8787);
const HOST = process.env["HOST"] ?? "127.0.0.1";

const hub = new Hub();
hub.start();

const server = createWsServer(
  {
    onOpen: (conn) => hub.handleOpen(conn),
    onMessage: (conn, text) => hub.handleMessage(conn, text),
    onClose: (conn) => hub.handleClose(conn),
  },
  // WebSocket ではない要求。動作確認に使う小さな窓だけ開けておく
  (req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, rooms: hub.listRooms() }));
      return;
    }
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("ここには何もありません\n");
  }
);

server.listen(PORT, HOST, () => {
  console.log(`pifpaf server: ws://${HOST}:${PORT}  (health: http://${HOST}:${PORT}/health)`);
});

const shutdown = (): void => {
  console.log("止めます");
  hub.stop();
  server.close(() => process.exit(0));
  // 接続が残っていても待ちすぎない
  setTimeout(() => process.exit(0), 3000).unref();
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
