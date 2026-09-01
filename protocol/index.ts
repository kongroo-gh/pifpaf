// オンライン対戦の通信仕様。web と server の両方がここ経由で参照する。
//
// **副作用のあるものは置かない。** 型と純粋関数だけ。
// engine と同じく、この package は通信手段（WebSocket か何か）を知らない。
// 実際の送受信は server/ と web/net/ が持つ。

export type { SeatView, PublicGameState, PlayerView } from "./view";
export { maskFor, maskForSpectator } from "./mask";

export type {
  RoomPhase,
  RoomSeat,
  RoomInfo,
  ClientMessage,
  ServerMessage,
} from "./messages";
export { PROTOCOL_VERSION, parseClientMessage, sanitizeName } from "./messages";
