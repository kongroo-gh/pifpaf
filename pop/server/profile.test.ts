import { describe, expect, it } from "vitest";
import { Room } from "./room.ts";

describe("オンラインプロフィール", () => {
  it("人のアバターを卓情報へ配る", () => {
    const room = new Room({ roomId: "AVTR", makeToken: () => "token" });
    room.join("旅人", undefined, 6);
    expect(room.roomInfo().seats[0]).toMatchObject({ name: "旅人", avatarId: 6, isBot: false });
  });

  it("再接続時に選び直したアバターを反映する", () => {
    const room = new Room({ roomId: "AVTR", makeToken: () => "token" });
    const joined = room.join("旅人", undefined, 1);
    if (!joined.ok) throw new Error("入室失敗");
    room.disconnect(joined.seat);
    room.join("旅人", joined.token, 5);
    expect(room.roomInfo().seats[0]?.avatarId).toBe(5);
  });

  it("CPUには人物名と一致する固有アバターを割り当てる", () => {
    const room = new Room({ roomId: "AVTR", playerCount: 6, makeToken: () => "token" });
    room.join("旅人", undefined, 0);
    room.start(true);
    expect(room.roomInfo().seats.map((seat) => ({ name: seat.name, avatarId: seat.avatarId }))).toEqual([
      { name: "旅人", avatarId: 0 },
      { name: "Zé Navalha", avatarId: 1 },
      { name: "Luís", avatarId: 2 },
      { name: "O Fantasma", avatarId: 3 },
      { name: "Dona Rosa", avatarId: 4 },
      { name: "Luna", avatarId: 5 },
    ]);
  });
});
