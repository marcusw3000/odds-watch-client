import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
Deno.test("snapshot uses server prices and rejects incomplete quotes",async()=>{
  const oldServe=Deno.serve,oldFetch=globalThis.fetch;
  const env=["SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY","SUPABASE_ANON_KEY","PAPER_COPY_CRON_SECRET"].map(k=>[k,Deno.env.get(k)] as const);
  for(const [k,v] of [["SUPABASE_URL","https://local.test"],["SUPABASE_SERVICE_ROLE_KEY","service"],["SUPABASE_ANON_KEY","anon"],["PAPER_COPY_CRON_SECRET","cron"]])Deno.env.set(k,v);
  let saved=0,missing=false;
  const json=(data:unknown)=>new Response(JSON.stringify(data),{status:200,headers:{"content-type":"application/json"}});
  try {
    Object.defineProperty(Deno,"serve",{configurable:true,value:()=>({})});
    globalThis.fetch=async(input,init)=>{
      const request=input instanceof Request?input:new Request(input,init),u=new URL(request.url),p=u.pathname;
      if(u.hostname==="gamma-api.polymarket.com")return json(missing?[]:[{id:"123",outcomes:'["Yes","No"]',clobTokenIds:'["777","778"]',outcomePrices:'["0.6","0.4"]'}]);
      if(p.endsWith("/rpc/paper_snapshot_candidates"))return json([{user_id:"11111111-1111-4111-8111-111111111111"}]);
      if(p.endsWith("/rpc/mark_paper_snapshot_attempt"))return json(null);
      if(p.endsWith("/polymarket_paper_wallets"))return json({round_id:"22222222-2222-4222-8222-222222222222",updated_at:"2026-11-07T00:00:00Z"});
      if(p.endsWith("/polymarket_paper_positions"))return json([{market_id:"123",outcome_label:"Yes",outcome_token_id:"777",shares:10,legacy_cost:0,verified_cost:4}]);
      if(p.endsWith("/rpc/save_paper_portfolio_snapshot")){const body=await request.json();assertEquals(body.p_positions_value,6);assertEquals(body.p_open_pnl,2);saved++;return json(null);}
      throw new Error(`Unexpected request ${p}`);
    };
    const {handleSnapshot}=await import("../supabase/functions/snapshot-paper-portfolio/index.ts");
    const call=()=>handleSnapshot(new Request("https://local.test",{method:"POST",headers:{"x-copy-cron-secret":"cron"}}));
    assertEquals((await call()).status,200);assertEquals(saved,1);
    missing=true;assertEquals((await call()).status,503);assertEquals(saved,1);
  } finally {Object.defineProperty(Deno,"serve",{configurable:true,value:oldServe});globalThis.fetch=oldFetch;for(const [k,v] of env)v===undefined?Deno.env.delete(k):Deno.env.set(k,v);}
});
