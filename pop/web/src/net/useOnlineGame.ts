// オンライン対戦の接続層。
//
// **ここにルール判定は無い。** サーバーが配ってきた盤面をそのまま持ち、
// 押されたボタンを意図として送るだけ。単機版の `useGame` が engine を
// 直に叩いていたところが、まるごと通信に置き換わった形になる。
//
// 単機版と同居させてあるのは、オンラインが繋がらないときに遊べなくなるのを
// 避けるため。画面はどちらの状態からも描けるよう、`App` 側で受け取る形を揃える。

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameAction } from "@pifpaf/engine";
import { PROTOCOL_VERSION } from "@pifpaf/protocol";
import type { PlayerView, RoomInfo, ServerMessage } from "@pifpaf/protocol";

/** 再接続の待ち時間。切れるたびに倍にして、上限で頭打ちにする */
const RECONNECT_MIN_MS = 500;
const RECONNECT_MAX_MS = 10_000;

const TOKEN_KEY = "pifpaf.online.token";
const NAME_KEY = "pifpaf.online.name";

export type ConnectionState =
  /** まだ繋ぎに行っていない */
  | "IDLE"
  | "CONNECTING"
  /** 繋がって席にも着いた */
  | "JOINED"
  /** 切れて、繋ぎ直しを待っている */
  | "RECONNECTING"
  /** 続けられない。理由は `error` */
  | "FAILED";

export interface OnlineGame {
  connection: ConnectionState;
  /** 直近の断りや失敗の理由。表示用 */
  error: string | null;
  /** 自分の席。まだ座っていなければ -1 */
  seat: number;
  room: RoomInfo | null;
  view: PlayerView | null;
  settlement: { losses: number[]; eliminated: number[] } | null;

  create: (name: string) => void;
  connect: (roomId: string, name: string) => void;
  disconnect: () => void;
  /**
   * 自分から卓を降りる。
   * **ただ切るのとは違う。** 切れただけならサーバーは戻りを待って卓を止めるが、
   * こちらは「戻らない」と伝えるので、残った人を待たせずに卓が畳まれる。
   */
  leave: () => void;

  /** 開始する。既定は4人そろってから。人が来ないときだけ CPU を呼んで埋める */
  start: (fillWithBots?: boolean) => void;
  setFold: (fold: boolean) => void;
  act: (action: GameAction) => void;
  next: () => void;

  /** 自分の番か。サーバーの判断をそのまま使う */
  isMyTurn: boolean;
}

/** 保存してある再接続トークン。卓ごとに分けて持つ。 */
function loadToken(roomId: string): string | undefined {
  try {
    const raw = window.localStorage.getItem(`${TOKEN_KEY}.${roomId}`);
    return raw === null ? undefined : raw;
  } catch {
    return undefined;
  }
}

function saveToken(roomId: string, token: string): void {
  try {
    window.localStorage.setItem(`${TOKEN_KEY}.${roomId}`, token);
  } catch {
    // 保存できなくても、その接続のあいだは遊べる
  }
}

export function loadName(): string {
  try {
    return window.localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveName(name: string): void {
  try {
    window.localStorage.setItem(NAME_KEY, name);
  } catch {
    // 同上
  }
}

/**
 * 本番の繋ぎ先。`render.yaml` の `name` から決まる Render の URL。
 *
 * **ここを既定に焼いてあるので、卓を動かすのに要る手作業は
 * 「Render で Blueprint からサービスを作る」だけ**。GitHub の変数設定は要らない。
 * 別名で立てたときや他所へ移したときだけ `VITE_WS_URL` で差し替える。
 */
const RENDER_WS_URL = "wss://pifpaf-online-kongroo.onrender.com";

/**
 * 繋ぎ先。
 *
 * 開発中は vite の隣で server を立てるので localhost:8787。
 * 本番は Render。GitHub Pages は静的配信しかできず WebSocket を置けないので、
 * 画面と卓は別の場所に居る。
 */
export function serverUrl(): string {
  const configured = import.meta.env["VITE_WS_URL"];
  if (typeof configured === "string" && configured !== "") return configured;

  if (import.meta.env.DEV) return "ws://127.0.0.1:8787";

  return RENDER_WS_URL;
}

/**
 * 届いた卓の情報を、**足りない項目を埋めてから**使う。
 *
 * 画面（GitHub Pages）と卓（Render）は別々に配信されるので、**新しい画面が
 * 古いサーバーに繋がる時間帯が必ずできる**。項目を足しただけなら古い画面は
 * 読み飛ばして無事だが、逆向きは無事では済まない。実際 `awaiting` を足したとき、
 * 古いサーバー相手に `room.awaiting.length` で落ちて画面が真っ黒になった。
 *
 * 受け取った側で埋めておけば、その時間帯は**その機能だけが無い**状態に落ちる。
 * 卓が止まったように見えるより、待ちの表示が出ないほうがはるかにましなので。
 */
function normalizeRoom(room: RoomInfo): RoomInfo {
  return {
    ...room,
    seats: (room.seats ?? []).map((s) => ({ ...s, ready: s.ready === true })),
    awaiting: room.awaiting ?? [],
    awaitingUntil: room.awaitingUntil ?? null,
  };
}

export function useOnlineGame(): OnlineGame {
  const [connection, setConnection] = useState<ConnectionState>("IDLE");
  const [error, setError] = useState<string | null>(null);
  const [seat, setSeat] = useState(-1);
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [view, setView] = useState<PlayerView | null>(null);
  const [settlement, setSettlement] = useState<OnlineGame["settlement"]>(null);

  const socket = useRef<WebSocket | null>(null);
  const retryDelay = useRef(RECONNECT_MIN_MS);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 繋ぎ直しに使う。ユーザーが「やめる」と言うまで保つ */
  const target = useRef<{ mode: "CREATE" | "JOIN"; roomId: string; name: string } | null>(null);
  /** 意図して切ったか。再接続すべきかの判断に使う */
  const intentionalClose = useRef(false);

  const send = useCallback((msg: unknown) => {
    const s = socket.current;
    if (s === null || s.readyState !== WebSocket.OPEN) return;
    s.send(JSON.stringify(msg));
  }, []);

  const open = useCallback(
    (mode: "CREATE" | "JOIN", roomId: string, name: string) => {
      if (retryTimer.current !== null) {
        clearTimeout(retryTimer.current);
        retryTimer.current = null;
      }

      intentionalClose.current = false;
      target.current = { mode, roomId, name };
      setConnection((prev) => (prev === "IDLE" ? "CONNECTING" : prev));

      let ws: WebSocket;
      try {
        ws = new WebSocket(serverUrl());
      } catch {
        setConnection("FAILED");
        setError("オンライン卓を開けませんでした。少し待ってからもう一度試してください");
        return;
      }
      socket.current = ws;

      ws.addEventListener("open", () => {
        setError(null);
        if (mode === "CREATE") send({ t: "CREATE", version: PROTOCOL_VERSION, name });
        else send({ t: "JOIN", version: PROTOCOL_VERSION, roomId, name, token: loadToken(roomId) });
      });

      ws.addEventListener("message", (event) => {
        let msg: ServerMessage;
        try {
          msg = JSON.parse(String(event.data)) as ServerMessage;
        } catch {
          return; // 読めないものは黙って捨てる
        }

        switch (msg.t) {
          case "JOINED":
            saveToken(msg.roomId, msg.token);
            target.current = { mode: "JOIN", roomId: msg.roomId, name };
            setSeat(msg.seat);
            setConnection("JOINED");
            // 繋がったので、次に切れたときの待ち時間を戻す
            retryDelay.current = RECONNECT_MIN_MS;
            break;
          case "ROOM":
            setRoom(normalizeRoom(msg.room));
            break;
          case "VIEW":
            setView(msg.view);
            break;
          case "SETTLEMENT":
            setSettlement({ losses: msg.losses, eliminated: msg.eliminated });
            break;
          case "REJECTED":
            setError(msg.reason);
            break;
          case "FATAL":
            setError(msg.reason);
            setConnection("FAILED");
            // 続けても仕方がないので、繋ぎ直しに行かない
            intentionalClose.current = true;
            break;
          case "PING":
            send({ t: "PONG" });
            break;
        }
      });

      ws.addEventListener("close", () => {
        socket.current = null;
        if (intentionalClose.current) {
          setConnection("IDLE");
          return;
        }

        setConnection("RECONNECTING");
        const wait = retryDelay.current;
        // 切れ続けたときに叩き続けないよう、待ち時間を倍にしていく
        retryDelay.current = Math.min(wait * 2, RECONNECT_MAX_MS);
        retryTimer.current = setTimeout(() => {
          const t = target.current;
          if (t !== null) open(t.mode, t.roomId, t.name);
        }, wait);
      });

      ws.addEventListener("error", () => {
        // close も続けて来る。再接続の状態表示は close 側に任せる
      });
    },
    [send]
  );

  const connect = useCallback(
    (roomId: string, name: string) => {
      saveName(name);
      setConnection("CONNECTING");
      setError(null);
      open("JOIN", roomId.trim().toUpperCase(), name);
    },
    [open]
  );

  const create = useCallback((name: string) => {
    saveName(name);
    setConnection("CONNECTING");
    setError(null);
    open("CREATE", "", name);
  }, [open]);

  const disconnect = useCallback(() => {
    intentionalClose.current = true;
    target.current = null;
    if (retryTimer.current !== null) clearTimeout(retryTimer.current);
    retryTimer.current = null;
    socket.current?.close();
    socket.current = null;
    setConnection("IDLE");
    setSeat(-1);
    setRoom(null);
    setView(null);
    setSettlement(null);
  }, []);

  const leave = useCallback(() => {
    // 先に「降りる」と伝えてから切る。切るだけだと、残った人が30秒待たされる
    send({ t: "LEAVE" });
    disconnect();
  }, [send, disconnect]);

  // 画面を閉じるときに後片付けする
  useEffect(() => {
    return () => {
      intentionalClose.current = true;
      if (retryTimer.current !== null) clearTimeout(retryTimer.current);
      socket.current?.close();
    };
  }, []);

  const start = useCallback(
    (fillWithBots = false) => send({ t: "START", fillWithBots }),
    [send]
  );
  const setFold = useCallback((fold: boolean) => send({ t: "FOLD", fold }), [send]);
  const act = useCallback((action: GameAction) => send({ t: "ACTION", action }), [send]);
  const next = useCallback(() => send({ t: "NEXT" }), [send]);

  const isMyTurn = useMemo(
    () => view !== null && seat >= 0 && view.game.actor === seat,
    [view, seat]
  );

  return {
    connection,
    error,
    seat,
    room,
    view,
    settlement,
    create,
    connect,
    disconnect,
    leave,
    start,
    setFold,
    act,
    next,
    isMyTurn,
  };
}
