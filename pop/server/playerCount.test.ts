import { describe, it, expect } from "vitest";
import { Room } from "./room.ts";

describe("3–6席のオンライン卓", () => {
  it.each([3, 4, 5, 6])("%i人の定員を守り明示CPU補充だけで開始する", (playerCount) => {
    const room = new Room({ roomId: "TEST", playerCount });
    expect(room.roomInfo().seats).toHaveLength(playerCount);
    expect(room.roomInfo().playerCount).toBe(playerCount);
    expect(room.join("host").ok).toBe(true);
    expect(room.start().ok).toBe(false);
    expect(room.start(true).ok).toBe(true);
    expect(room.roomInfo().seats.filter(s => s.isBot)).toHaveLength(playerCount - 1);
    for (let seat = 0; seat < playerCount; seat++) {
      const view = room.viewFor(seat);
      expect(view.you).toBe(seat);
      expect(view.game.hand).toHaveLength(9);
      expect(view.game.seats).toHaveLength(playerCount);
      expect(view.match.chips).toHaveLength(playerCount);
      expect(view.game).not.toHaveProperty("hands");
      expect(view.game).not.toHaveProperty("stock");
    }
    expect(room.join("extra").ok).toBe(false);
  });
});
