// 通信で流れるメッセージ。
//
// 方針:
// - **クライアントは状態を送らない。意図だけ送る。** 手札や盤面を送らせると、
//   改竄の検査が必要になる。サーバーが持っている状態に対して「引く」「捨てる」を
//   適用するだけなら、検査は「その席の番か」だけで済む。
// - 判定結果もサーバーが出す。web にルール判定を持たせない原則をそのまま延ばす。
// - すべて JSON で往復する。型は共有するが、**受信時は必ず検証する**
//   （相手が本当にこの型を送ってくる保証はない）。

import type { GameAction } from "@pifpaf/engine";
import type { PlayerView } from "./view.ts";

/** 通信仕様の版。合わないクライアントは弾く。 */
export const PROTOCOL_VERSION = 2;

/** 卓の進み具合。ロビー表示に使う。 */
export type RoomPhase =
  /** 人が揃うのを待っている */
  | "WAITING"
  /** ラウンド開始前。各自が降りるか決めている */
  | "FOLD_DECISION"
  /** 対局中 */
  | "PLAYING"
  /** ラウンドの結果を見せている */
  | "ROUND_RESULT"
  /** マッチが決着した */
  | "MATCH_OVER";

export interface RoomSeat {
  seat: number;
  /** 表示名。人が座っていなければ null */
  name: string | null;
  /** CPU が埋めている席か */
  isBot: boolean;
  /** 人が座っているが今つながっていない */
  disconnected: boolean;
  /** このラウンドの降りるか否かを決め終えたか */
  decided: boolean;
  /**
   * 結果画面で「次へ」を押したか。
   * 押したあと誰を待っているのかを画面に出すために配る
   * （押しても何も変わらないと、届いていないのかと思われる）。
   */
  ready: boolean;
}

export interface RoomInfo {
  roomId: string;
  /** 卓を作った人の席。開始操作をできるのはこの席だけ */
  hostSeat: number;
  phase: RoomPhase;
  seats: RoomSeat[];
  /** 何ラウンド目か */
  round: number;
}

/* ─────────── クライアント → サーバー ─────────── */

export type ClientMessage =
  /** 新しい卓を作る。短い接続コードはサーバーが発行する */
  | { t: "CREATE"; version: number; name: string }
  /** 入室。席が空いていれば座る */
  | { t: "JOIN"; version: number; roomId: string; name: string; token?: string }
  /**
   * 開始する。既定は4人そろってから。
   * `fillWithBots` を立てたときだけ、空席を CPU で埋めて始める
   * （人が集まらなかったときのホストの判断）。
   */
  | { t: "START"; fillWithBots?: boolean }
  /** ラウンド開始前の「降りる／勝負する」 */
  | { t: "FOLD"; fold: boolean }
  /** 対局中の手 */
  | { t: "ACTION"; action: GameAction }
  /** 結果表示から次のラウンドへ */
  | { t: "NEXT" }
  /** 生存確認への返事 */
  | { t: "PONG" };

/* ─────────── サーバー → クライアント ─────────── */

export type ServerMessage =
  /**
   * 入室できた。`token` は再接続用。
   * 通信が切れても同じ席に戻れるよう、クライアントが保存しておく。
   */
  | { t: "JOINED"; roomId: string; seat: number; token: string }
  /** 卓の状況。ロビーと対局中の両方で流れる */
  | { t: "ROOM"; room: RoomInfo }
  /** 盤面。**席ごとに中身が違う** */
  | { t: "VIEW"; view: PlayerView }
  /** ラウンドの精算 */
  | { t: "SETTLEMENT"; losses: number[]; eliminated: number[] }
  /** 断られた操作。理由は engine の文言をそのまま返す（開発用） */
  | { t: "REJECTED"; reason: string }
  /** 続けられない事態。接続は閉じる */
  | { t: "FATAL"; reason: string }
  | { t: "PING" };

/* ─────────── 受信時の検証 ─────────── */
//
// JSON.parse したものは any でしかない。型注釈を付けただけでは何も守れないので、
// 形を確かめてから通す。ここを省くと不正な入力でサーバーが落ちる。

export function parseClientMessage(raw: unknown): ClientMessage | null {
  if (typeof raw !== "object" || raw === null) return null;
  const m = raw as Record<string, unknown>;

  switch (m["t"]) {
    case "CREATE":
      if (typeof m["version"] !== "number" || typeof m["name"] !== "string") return null;
      return { t: "CREATE", version: m["version"], name: sanitizeName(m["name"]) };

    case "JOIN":
      if (typeof m["version"] !== "number") return null;
      if (typeof m["roomId"] !== "string" || m["roomId"].length === 0) return null;
      if (typeof m["name"] !== "string") return null;
      if (m["token"] !== undefined && typeof m["token"] !== "string") return null;
      return {
        t: "JOIN",
        version: m["version"],
        roomId: m["roomId"].slice(0, 40),
        // 表示名は他人の画面に出るので、長さを切って制御文字を落とす
        name: sanitizeName(m["name"]),
        ...(typeof m["token"] === "string" ? { token: m["token"] } : {}),
      };

    case "START":
      // 立っているときだけ CPU を呼ぶ。壊れた値は「呼ばない」に倒す
      return { t: "START", fillWithBots: m["fillWithBots"] === true };

    case "FOLD":
      if (typeof m["fold"] !== "boolean") return null;
      return { t: "FOLD", fold: m["fold"] };

    case "ACTION": {
      const action = parseAction(m["action"]);
      return action === null ? null : { t: "ACTION", action };
    }

    case "NEXT":
      return { t: "NEXT" };

    case "PONG":
      return { t: "PONG" };

    default:
      return null;
  }
}

function parseAction(raw: unknown): GameAction | null {
  if (typeof raw !== "object" || raw === null) return null;
  const a = raw as Record<string, unknown>;

  switch (a["type"]) {
    case "DRAW": {
      const from = a["from"];
      if (from !== undefined && from !== "STOCK" && from !== "DISCARD") return null;
      return from === undefined ? { type: "DRAW" } : { type: "DRAW", from };
    }
    case "INTERCEPT":
      return { type: "INTERCEPT" };
    case "PASS_INTERCEPT":
      return { type: "PASS_INTERCEPT" };
    case "TAKE_VIRA":
      return { type: "TAKE_VIRA" };
    case "KEEP":
      return { type: "KEEP" };
    case "REJECT":
      return { type: "REJECT" };
    case "DISCARD":
      if (typeof a["cardId"] !== "string") return null;
      return { type: "DISCARD", cardId: a["cardId"] };
    case "BATER":
      if (a["cardId"] !== undefined && typeof a["cardId"] !== "string") return null;
      return typeof a["cardId"] === "string"
        ? { type: "BATER", cardId: a["cardId"] }
        : { type: "BATER" };
    default:
      return null;
  }
}

/** 表示名の掃除。他人の画面に出るものなので、ここで丸めておく。 */
export function sanitizeName(raw: string): string {
  // 制御文字と改行を落とし、前後の空白を詰めてから長さを切る。
  // エスケープで書くのは、生の制御文字はコピーや保存の途中で消えるため。
  const cleaned = raw
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 16);
  return cleaned === "" ? "?" : cleaned;
}
