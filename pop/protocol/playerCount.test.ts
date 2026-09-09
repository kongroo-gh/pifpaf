import { it, expect } from "vitest";
import { parseClientMessage, PROTOCOL_VERSION } from "./messages.ts";
it.each([3,4,5,6])("CREATE は %i 席を保持する", playerCount => {
  expect(parseClientMessage({t:"CREATE", version:PROTOCOL_VERSION, name:"host", playerCount, maxPlayers:6})).toMatchObject({playerCount, maxPlayers:6});
});
it.each([0,2,7,3.5,"6",null])("不正な人数 %s を拒否する", playerCount => {
 expect(parseClientMessage({t:"CREATE",version:PROTOCOL_VERSION,name:"host",playerCount})).toBeNull();
});
