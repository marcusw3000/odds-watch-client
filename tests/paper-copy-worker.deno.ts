import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("paper copy worker detects a paper buy and executes an approved copy once", async () => {
  const oldServe = Deno.serve, oldFetch = globalThis.fetch;
  const oldEnv = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "PAPER_COPY_CRON_SECRET"].map(k => [k, Deno.env.get(k)] as const);
  for (const [key, value] of [["SUPABASE_URL", "https://local.test"], ["SUPABASE_SERVICE_ROLE_KEY", "service"], ["PAPER_COPY_CRON_SECRET", "cron"]]) Deno.env.set(key, value);
  let inserted = 0, executed = 0;
  const now = Date.now(), strategy = { id: "11111111-1111-4111-8111-111111111111", user_id: "22222222-2222-4222-8222-222222222222", source_kind: "paper", source_id: "33333333-3333-4333-8333-333333333333", started_at: new Date(now-60_000).toISOString(), monitored_at: new Date(now-30_000).toISOString(), active: true, total_limit: 100, spent_usd: 0, per_trade_limit: 10, max_price_deviation: 0.03, round_id: "round" };
  const signal = { id: "44444444-4444-4444-8444-444444444444", status: "approved", market_id: "123", outcome: "Yes", source_price: 0.4, source_notional: 10, created_at: new Date(now).toISOString(), paper_copy_strategies: strategy };
  const json = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } });
  try {
    Object.defineProperty(Deno, "serve", { configurable: true, value: () => ({}) });
    globalThis.fetch = async (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init);
      const url = new URL(request.url), path = url.pathname, method = request.method;
      if (url.hostname === "gamma-api.polymarket.com") return json({ markets: [{ id: "123", question: "Mercado", acceptingOrders: true, closed: false, outcomes: '["Yes","No"]', clobTokenIds: '["777","778"]' }] });
      if (url.hostname === "clob.polymarket.com") return json({ asset_id: "777", asks: [{ price: "0.4", size: "100" }] });
      if (path.endsWith("/paper_copy_strategies")) return json(method === "GET" ? [strategy] : []);
      if (path.endsWith("/profiles")) return json([{ is_public: true, show_trades: true }]);
      if (path.endsWith("/polymarket_paper_trades")) return json([{ id: "55555555-5555-4555-8555-555555555555", market_id: "123", outcome_label: "Yes", side: "BUY", shares: 25, price: 0.4, notional_usd: 10, created_at: new Date(now-1000).toISOString() }]);
      if (path.endsWith("/rpc/create_paper_copy_signal")) { inserted++; return json(signal.id); }
      if (path.endsWith("/paper_copy_signals")) return json(method === "GET" ? [signal] : []);
      if (path.endsWith("/polymarket_paper_wallets")) return json({ balance_usd: 10000, round_id: "round" });
      if (path.endsWith("/rpc/execute_paper_copy_signal")) { const body = await request.json(); assertEquals(body.p_signal, signal.id); assertEquals(body.p_token, "777"); if (body.p_shares * body.p_price > 10) throw new Error("Limite excedido"); executed++; return json({ success: true }); }
      throw new Error(`Unexpected request ${method} ${url}`);
    };
    const { handlePaperCopyRequest } = await import("../supabase/functions/process-paper-copy/index.ts");
    const denied = await handlePaperCopyRequest(new Request("https://local.test", { method: "POST" }));
    assertEquals(denied.status, 401);
    const response = await handlePaperCopyRequest(new Request("https://local.test", { method: "POST", headers: { "x-copy-cron-secret": "cron" } }));
    assertEquals(response.status, 200);
    assertEquals(inserted, 1); assertEquals(executed, 1);
  } finally {
    Object.defineProperty(Deno, "serve", { configurable: true, value: oldServe });
    globalThis.fetch = oldFetch;
    for (const [key, value] of oldEnv) value === undefined ? Deno.env.delete(key) : Deno.env.set(key, value);
  }
});

Deno.test("Polymarket fills in one transaction are grouped before a signal is created", async () => {
  const oldServe = Deno.serve, oldFetch = globalThis.fetch;
  const oldEnv = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "PAPER_COPY_CRON_SECRET"].map(k => [k, Deno.env.get(k)] as const);
  for (const [key, value] of [["SUPABASE_URL", "https://local.test"], ["SUPABASE_SERVICE_ROLE_KEY", "service"], ["PAPER_COPY_CRON_SECRET", "cron"]]) Deno.env.set(key, value);
  const now = Date.now(); let calls = 0;
  const strategy = { id: "11111111-1111-4111-8111-111111111111", user_id: "22222222-2222-4222-8222-222222222222", source_kind: "polymarket", source_id: "0x1234567890123456789012345678901234567890", started_at: new Date(now-60_000).toISOString(), monitored_at: new Date(now-30_000).toISOString(), active: true };
  const trade = { side: "BUY", type: "TRADE", transaction_hash: `0x${"a".repeat(64)}`, token_id: "777", slug: "market", outcome: "Yes", outcome_index: 0, timestamp: Math.floor((now-1000)/1000) };
  const market = { id: "123", question: "Mercado", acceptingOrders: true, closed: false, outcomes: '["Yes","No"]', clobTokenIds: '["777","778"]' };
  const json = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } });
  try {
    Object.defineProperty(Deno, "serve", { configurable: true, value: () => ({}) });
    globalThis.fetch = async (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init);
      const url = new URL(request.url), path = url.pathname;
      if (url.hostname === "data-api.polymarket.com") return json({ data: [{ ...trade, size: 10, usdc_size: 4 }, { ...trade, size: 5, usdc_size: 2 }], pagination: { next_cursor: null } });
      if (url.hostname === "gamma-api.polymarket.com") return json([market]);
      if (path.endsWith("/paper_copy_strategies")) return json(request.method === "GET" ? [strategy] : []);
      if (path.endsWith("/paper_copy_signals")) return json([]);
      if (path.endsWith("/rpc/create_paper_copy_signal")) { const body = await request.json(); assertEquals(body.p_notional, 6); assertEquals(body.p_price, 0.4); calls++; return json("44444444-4444-4444-8444-444444444444"); }
      throw new Error(`Unexpected request ${request.method} ${url}`);
    };
    const { handlePaperCopyRequest } = await import("../supabase/functions/process-paper-copy/index.ts");
    const response = await handlePaperCopyRequest(new Request("https://local.test", { method: "POST", headers: { "x-copy-cron-secret": "cron" } }));
    assertEquals(response.status, 200); assertEquals(calls, 1);
  } finally {
    Object.defineProperty(Deno, "serve", { configurable: true, value: oldServe });
    globalThis.fetch = oldFetch;
    for (const [key, value] of oldEnv) value === undefined ? Deno.env.delete(key) : Deno.env.set(key, value);
  }
});

Deno.test("a private paper trader pauses the strategy without reading their trades", async () => {
  const oldServe=Deno.serve, oldFetch=globalThis.fetch;
  const oldEnv=["SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY","PAPER_COPY_CRON_SECRET"].map(k=>[k,Deno.env.get(k)] as const);
  for(const [key,value] of [["SUPABASE_URL","https://local.test"],["SUPABASE_SERVICE_ROLE_KEY","service"],["PAPER_COPY_CRON_SECRET","cron"]]) Deno.env.set(key,value);
  const now=Date.now(), strategy={id:"11111111-1111-4111-8111-111111111111",user_id:"22222222-2222-4222-8222-222222222222",source_kind:"paper",source_id:"33333333-3333-4333-8333-333333333333",started_at:new Date(now-60000).toISOString(),monitored_at:new Date(now-30000).toISOString(),active:true};
  let paused=false,cancelled=false,readTrades=false;
  const json=(data:unknown)=>new Response(JSON.stringify(data),{status:200,headers:{"content-type":"application/json"}});
  try {
    Object.defineProperty(Deno,"serve",{configurable:true,value:()=>({})});
    globalThis.fetch=async(input,init)=>{
      const request=input instanceof Request?input:new Request(input,init),path=new URL(request.url).pathname;
      if(path.endsWith("/paper_copy_strategies")){if(request.method==="GET")return json([strategy]); const body=await request.json(); if(body.active===false)paused=true; return json([]);}
      if(path.endsWith("/profiles"))return json([{is_public:false,show_trades:false}]);
      if(path.endsWith("/polymarket_paper_trades")){readTrades=true;return json([]);}
      if(path.endsWith("/paper_copy_signals")){if(request.method==="PATCH"){const body=await request.json();if(body.reason==="Trader não está mais disponível para cópia")cancelled=true;}return json([]);}
      throw new Error(`Unexpected request ${request.method} ${path}`);
    };
    const {handlePaperCopyRequest}=await import("../supabase/functions/process-paper-copy/index.ts");
    const response=await handlePaperCopyRequest(new Request("https://local.test",{method:"POST",headers:{"x-copy-cron-secret":"cron"}}));
    assertEquals(response.status,200);assertEquals(paused,true);assertEquals(cancelled,true);assertEquals(readTrades,false);
  } finally {
    Object.defineProperty(Deno,"serve",{configurable:true,value:oldServe});globalThis.fetch=oldFetch;
    for(const [key,value] of oldEnv)value===undefined?Deno.env.delete(key):Deno.env.set(key,value);
  }
});

Deno.test("paper sale copies only the matching proportional shares",async()=>{
  const oldServe=Deno.serve,oldFetch=globalThis.fetch;
  const env=["SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY","PAPER_COPY_CRON_SECRET"].map(k=>[k,Deno.env.get(k)] as const);
  for(const [k,v] of [["SUPABASE_URL","https://local.test"],["SUPABASE_SERVICE_ROLE_KEY","service"],["PAPER_COPY_CRON_SECRET","cron"]])Deno.env.set(k,v);
  const now=Date.now(),strategy={id:"11111111-1111-4111-8111-111111111111",user_id:"22222222-2222-4222-8222-222222222222",source_kind:"paper",source_id:"33333333-3333-4333-8333-333333333333",started_at:new Date(now-60000).toISOString(),monitored_at:new Date(now-30000).toISOString(),active:true,total_limit:100,spent_usd:8,per_trade_limit:10,max_price_deviation:0.03,round_id:"round"};
  const signal={id:"44444444-4444-4444-8444-444444444444",status:"approved",side:"SELL",market_id:"123",outcome:"Yes",source_price:0.6,source_notional:6,sell_fraction:0.5,created_at:new Date(now).toISOString(),paper_copy_strategies:strategy};let created=0,executed=0;
  const json=(data:unknown)=>new Response(JSON.stringify(data),{status:200,headers:{"content-type":"application/json"}});
  try {
    Object.defineProperty(Deno,"serve",{configurable:true,value:()=>({})});
    globalThis.fetch=async(input,init)=>{
      const req=input instanceof Request?input:new Request(input,init),url=new URL(req.url),path=url.pathname;
      if(url.hostname==="gamma-api.polymarket.com")return json({markets:[{id:"123",question:"Mercado",acceptingOrders:true,closed:false,outcomes:'["Yes","No"]',clobTokenIds:'["777","778"]'}]});
      if(url.hostname==="clob.polymarket.com")return json({asset_id:"777",bids:[{price:"0.6",size:"100"}]});
      if(path.endsWith("/paper_copy_strategies"))return json(req.method==="GET"?[strategy]:[]);
      if(path.endsWith("/profiles"))return json([{is_public:true,show_trades:true}]);
      if(path.endsWith("/polymarket_paper_trades"))return json([{id:"55555555-5555-4555-8555-555555555555",market_id:"123",outcome_label:"Yes",side:"SELL",shares:10,position_before:20,price:0.6,notional_usd:6,created_at:new Date(now-1000).toISOString()}]);
      if(path.endsWith("/rpc/create_paper_copy_sale_signal")){const body=await req.json();assertEquals(body.p_shares,10);assertEquals(body.p_before,20);created++;return json(signal.id);}
      if(path.endsWith("/paper_copy_signals"))return json(req.method==="GET" && !url.searchParams.has("source_at")?[signal]:[]);
      if(path.endsWith("/polymarket_paper_wallets"))return json({balance_usd:100,round_id:"round"});
      if(path.endsWith("/paper_copy_positions"))return json([{shares:20}]);
      if(path.endsWith("/rpc/execute_paper_copy_signal")){const body=await req.json();assertEquals(body.p_shares,10);assertEquals(body.p_price,0.6);executed++;return json({success:true});}
      throw new Error(`Unexpected request ${req.method} ${url}`);
    };
    const {handlePaperCopyRequest}=await import("../supabase/functions/process-paper-copy/index.ts");
    const response=await handlePaperCopyRequest(new Request("https://local.test",{method:"POST",headers:{"x-copy-cron-secret":"cron"}}));
    assertEquals(response.status,200);assertEquals(created,1);assertEquals(executed,1);
  } finally {Object.defineProperty(Deno,"serve",{configurable:true,value:oldServe});globalThis.fetch=oldFetch;for(const [k,v] of env)v===undefined?Deno.env.delete(k):Deno.env.set(k,v);}
});

Deno.test("Polymarket sale reconstructs the position before generating a signal",async()=>{
  const oldServe=Deno.serve,oldFetch=globalThis.fetch,env=["SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY","PAPER_COPY_CRON_SECRET"].map(k=>[k,Deno.env.get(k)] as const);
  for(const [k,v] of [["SUPABASE_URL","https://local.test"],["SUPABASE_SERVICE_ROLE_KEY","service"],["PAPER_COPY_CRON_SECRET","cron"]])Deno.env.set(k,v);
  const now=Date.now(),timestamp=Math.floor((now-5000)/1000),condition=`0x${"b".repeat(64)}`,strategy={id:"11111111-1111-4111-8111-111111111111",user_id:"22222222-2222-4222-8222-222222222222",source_kind:"polymarket",source_id:"0x1234567890123456789012345678901234567890",started_at:new Date(now-60000).toISOString(),monitored_at:new Date(now-30000).toISOString(),active:true};let created=0;
  const json=(data:unknown)=>new Response(JSON.stringify(data),{status:200,headers:{"content-type":"application/json"}});
  try {
    Object.defineProperty(Deno,"serve",{configurable:true,value:()=>({})});
    globalThis.fetch=async(input,init)=>{
      const req=input instanceof Request?input:new Request(input,init),url=new URL(req.url),path=url.pathname;
      if(url.hostname==="data-api.polymarket.com" && path==="/v2/activity")return json({data:[{side:"SELL",type:"TRADE",transaction_hash:`0x${"a".repeat(64)}`,condition_id:condition,token_id:"777",slug:"market",outcome:"Yes",outcome_index:0,timestamp,size:10,usdc_size:6}],pagination:{next_cursor:null}});
      if(url.hostname==="data-api.polymarket.com" && path==="/v2/positions")return json({data:[{token_id:"777",current_size:10,last_event_at:timestamp}],pagination:{next_cursor:null}});
      if(url.hostname==="gamma-api.polymarket.com")return json([{id:"123",question:"Mercado",acceptingOrders:true,closed:false,outcomes:'["Yes","No"]',clobTokenIds:'["777","778"]'}]);
      if(path.endsWith("/paper_copy_strategies"))return json(req.method==="GET"?[strategy]:[]);
      if(path.endsWith("/paper_copy_signals"))return json([]);
      if(path.endsWith("/rpc/create_paper_copy_sale_signal")){const body=await req.json();assertEquals(body.p_shares,10);assertEquals(body.p_before,20);created++;return json(null);}
      throw new Error(`Unexpected request ${req.method} ${url}`);
    };
    const {handlePaperCopyRequest}=await import("../supabase/functions/process-paper-copy/index.ts");
    const response=await handlePaperCopyRequest(new Request("https://local.test",{method:"POST",headers:{"x-copy-cron-secret":"cron"}}));
    assertEquals(response.status,200);assertEquals(created,1);
  }finally{Object.defineProperty(Deno,"serve",{configurable:true,value:oldServe});globalThis.fetch=oldFetch;for(const [k,v] of env)v===undefined?Deno.env.delete(k):Deno.env.set(k,v);}
});
