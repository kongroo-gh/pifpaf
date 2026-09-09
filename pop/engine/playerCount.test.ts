import { it, expect } from "vitest";
import { dealGame, createMatch, createInitialState, decideAction, applyAction, currentActor, settleRound, payoutMultiplier } from "./index.ts";
it.each([0,2,7,3.5,NaN])("不正な卓人数 %s を拒否する", n => {
 expect(() => dealGame(n)).toThrow();
 expect(() => createMatch(n)).toThrow();
});
it.each([3,4,5,6])("%i 席の配札・全CPU通しで104枚を保存し配当規則を維持する", n => {
 for(let seed=1;seed<=10;seed++) {
  let x=seed;
  const rng=()=>((x=(x*1664525+1013904223)>>>0)/4294967296);
  const deal=dealGame(n,rng);
  expect(deal.hands.map(h=>h.length)).toEqual(Array(n).fill(9));
  let state=createInitialState(deal,n-1);
  for(let step=0;step<2000;step++) {
   const cards=[...state.hands.flat(),...state.stock,...state.discard,...(state.vira?[state.vira]:[]),...(state.pendingCard?[state.pendingCard]:[])];
   expect(cards).toHaveLength(104); expect(new Set(cards.map(c=>c.id)).size).toBe(104);
   if(state.phase==="ROUND_OVER") break;
   expect(currentActor(state)).toBeGreaterThanOrEqual(0); expect(currentActor(state)).toBeLessThan(n);
   const action=decideAction(state); expect(action).not.toBeNull();
   const result=applyAction(state,action!); expect(result.ok).toBe(true);
   if(result.ok) state=result.state;
  }
  expect(state.phase).toBe("ROUND_OVER");
 }
 const result=settleRound(createMatch(n,2),{winner:n-1,baterCom10:false,usedWild:false,folded:[]});
 expect(result.state.winner).toBe(n-1); expect(result.losses).toEqual([...Array(n-1).fill(2),0]);
 expect(payoutMultiplier(result.state,n-1)).toBe(3);
});
