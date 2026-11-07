// Test-only: advance a disposable strategy's start time to replay a recent public buy.
import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
const project="tztqsorbugjhwljbiano", url=process.env.SUPABASE_URL, service=process.env.SUPABASE_SERVICE_ROLE_KEY, key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if(url!==`https://${project}.supabase.co` || !service || !key) throw new Error("Configuração incorreta.");
const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
const check=(ok,message)=>{if(!ok)throw new Error(message)};
let id,client,failed=false;
try {
  const board=await fetch("https://data-api.polymarket.com/v2/leaderboard?time_period=day&limit=20").then(r=>r.json());
  let source=null;
  for(const row of board.data ?? []) {
    const q=new URLSearchParams({user:row.user_id,type:"TRADE",side:"BUY",limit:"5",start:String(Math.floor(Date.now()/1000)-240)});
    const response=await fetch(`https://data-api.polymarket.com/v2/activity?${q}`); if(!response.ok) continue;
    const activity=await response.json();
    for(const buy of activity.data ?? []) {
      if(buy.side!=="BUY" || buy.is_combo || !buy.slug || !buy.token_id || !buy.outcome) continue;
      const gamma=await fetch(`https://gamma-api.polymarket.com/markets?${new URLSearchParams({slug:buy.slug,limit:"1"})}`).then(r=>r.json());
      const market=gamma?.[0]; if(!market || market.closed || !market.acceptingOrders) continue;
      let labels,tokens; try { labels=typeof market.outcomes==="string"?JSON.parse(market.outcomes):market.outcomes; tokens=typeof market.clobTokenIds==="string"?JSON.parse(market.clobTokenIds):market.clobTokenIds; } catch { continue; }
      if(!Array.isArray(labels) || !Array.isArray(tokens) || tokens[labels.indexOf(buy.outcome)]!==buy.token_id) continue;
      source={wallet:row.user_id,name:row.user_name || "Trader Polymarket"};break;
    }
    if(source)break;
  }
  check(source,"Nenhuma compra pública recente e negociável foi encontrada para o teste.");
  const email=`copy-poly-${randomUUID()}@example.invalid`,password=randomBytes(24).toString("base64url");
  const created=await admin.auth.admin.createUser({email,password,email_confirm:true}); check(!created.error && created.data.user?.id,"Falha ao criar usuário temporário."); id=created.data.user.id;
  client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}); const login=await client.auth.signInWithPassword({email,password});check(!login.error,"Falha na autenticação.");
  const strategy=await client.rpc("save_paper_copy_strategy",{p_kind:"polymarket",p_source:source.wallet,p_name:source.name,p_mode:"manual",p_total:100,p_per_trade:10}); check(!strategy.error && strategy.data,"Falha ao criar estratégia temporária.");
  const start=new Date(Date.now()-240000).toISOString();
  const adjust=await admin.from("paper_copy_strategies").update({started_at:start,monitored_at:start}).eq("id",strategy.data).eq("user_id",id);check(!adjust.error,"Falha ao preparar replay exclusivamente para teste.");
  process.stdout.write("Aguardando o cron identificar uma compra pública recente...\n");
  const deadline=Date.now()+120000; let signal;
  while(Date.now()<deadline) {
    const result=await client.from("paper_copy_signals").select("id,status").eq("strategy_id",strategy.data).eq("status","pending");check(!result.error,"Consulta de sinais falhou.");
    if(result.data?.length){signal=result.data[0];break;} await new Promise(resolve=>setTimeout(resolve,3000));
  }
  check(signal,"O cron não detectou a compra pública no prazo.");
  const notices=await client.from("notifications").select("id,data").eq("user_id",id);check(!notices.error && notices.data?.some(n=>n.data?.signal_id===signal.id),"Notificação não encontrada.");
  process.stdout.write("Detecção de atividade da Polymarket e notificação manual pelo cron: OK.\n");
} catch(error){failed=true;process.stderr.write(`${error instanceof Error ? error.message : "Falha no teste."}\n`);}
finally { if(client)await client.auth.signOut().catch(()=>{});if(id){const deleted=await admin.auth.admin.deleteUser(id);if(deleted.error){failed=true;process.stderr.write("Não foi possível remover o usuário temporário.\n");}else process.stdout.write("Usuário temporário removido.\n");} }
if(failed)process.exitCode=1;
