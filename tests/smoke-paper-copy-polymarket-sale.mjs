// Uses only public activity and a disposable follower; replay is limited to that test strategy.
import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
const project="tztqsorbugjhwljbiano",url=process.env.SUPABASE_URL,service=process.env.SUPABASE_SERVICE_ROLE_KEY,key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if(url!==`https://${project}.supabase.co`||!service||!key)throw new Error("Configuração incorreta.");
const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});const check=(ok,message)=>{if(!ok)throw new Error(message)};let id,client,failed=false;
try{
  const board=await fetch("https://data-api.polymarket.com/v2/leaderboard?time_period=day&limit=40").then(r=>r.json());let selected=null;
  for(const trader of board.data??[]){
    const q=new URLSearchParams({user:trader.user_id,type:"TRADE,SPLIT,MERGE,REDEEM,CONVERSION,MIGRATION,DIRECTIONAL_SPLIT,DIRECTIONAL_MERGE,THRESHOLD_COMPOSE,THRESHOLD_DECOMPOSE",limit:"500",start:String(Math.floor(Date.now()/1000)-600)});
    const response=await fetch(`https://data-api.polymarket.com/v2/activity?${q}`);if(!response.ok)continue;const activity=await response.json();if(activity.pagination?.next_cursor)continue;
    for(const sale of activity.data??[]){
      if(sale.type!=="TRADE"||sale.side!=="SELL"||sale.is_combo||!sale.slug||!sale.outcome||!sale.token_id||!sale.condition_id||Number(sale.timestamp)>Math.floor(Date.now()/1000)-8)continue;
      if((activity.data??[]).some(x=>x.token_id===sale.token_id&&x.transaction_hash!==sale.transaction_hash&&x.timestamp===sale.timestamp))continue;
      if((activity.data??[]).some(x=>x.type!=="TRADE"&&(x.condition_id===sale.condition_id||(x.event_slug&&x.event_slug===sale.event_slug))&&Number(x.timestamp)>=Number(sale.timestamp)))continue;
      const market=await fetch(`https://gamma-api.polymarket.com/markets?${new URLSearchParams({slug:sale.slug,limit:"1"})}`).then(r=>r.json()).catch(()=>[]);if(!market?.[0]||market[0].closed||!market[0].acceptingOrders)continue;
      let labels,tokens;try{labels=JSON.parse(market[0].outcomes);tokens=JSON.parse(market[0].clobTokenIds)}catch{continue}if(tokens[labels.indexOf(sale.outcome)]!==sale.token_id)continue;
      let position;for(const status of ["OPEN","CLOSED"]){const pos=await fetch(`https://data-api.polymarket.com/v2/positions?${new URLSearchParams({user:trader.user_id,condition:sale.condition_id,status,filter_amount:"0",limit:"100"})}`).then(r=>r.json()).catch(()=>null);if(pos?.pagination?.next_cursor)break;position=pos?.data?.find(p=>p.token_id===sale.token_id);if(position)break;}
      if(!position||position.current_size==null||position.last_event_at==null||Number(position.last_event_at)>Math.floor(Date.now()/1000)-3)continue;
      selected={wallet:trader.user_id,name:trader.user_name||"Trader Polymarket",sale};break;
    }if(selected)break;
  }
  check(selected,"Nenhuma venda pública recente com posição verificável foi encontrada.");
  const email=`copy-poly-sale-${randomUUID()}@example.invalid`,password=randomBytes(24).toString("base64url"),created=await admin.auth.admin.createUser({email,password,email_confirm:true});check(!created.error&&created.data.user?.id,"Falha ao criar usuário temporário.");id=created.data.user.id;
  client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});const login=await client.auth.signInWithPassword({email,password});check(!login.error,"Falha no login.");
  const strategy=await client.rpc("save_paper_copy_strategy",{p_kind:"polymarket",p_source:selected.wallet,p_name:selected.name,p_mode:"manual",p_total:100,p_per_trade:10});check(!strategy.error&&strategy.data,"Falha ao criar estratégia.");
  const start=new Date((Number(selected.sale.timestamp)-30)*1000).toISOString(),adjust=await admin.from("paper_copy_strategies").update({started_at:start,monitored_at:start}).eq("id",strategy.data).eq("user_id",id);check(!adjust.error,"Falha ao preparar replay temporário.");
  process.stdout.write("Aguardando detecção de venda pública da Polymarket...\n");let found;const deadline=Date.now()+120000;
  while(Date.now()<deadline){const result=await client.from("paper_copy_signals").select("side,source_position_before,reason,source_key").eq("strategy_id",strategy.data).eq("side","SELL");check(!result.error,"Consulta de sinais falhou.");found=result.data?.find(x=>x.source_key.includes(selected.sale.transaction_hash.toLowerCase())&&Number(x.source_position_before)>0);if(found)break;await new Promise(resolve=>setTimeout(resolve,3000));}
  check(found,"A venda pública não foi reconhecida com posição anterior verificável no prazo.");process.stdout.write("Detecção de venda pública e proporção de origem: OK.\n");
}catch(error){failed=true;process.stderr.write(`${error instanceof Error?error.message:"Falha no teste."}\n`)}
finally{if(client)await client.auth.signOut().catch(()=>{});if(id){const result=await admin.auth.admin.deleteUser(id);if(result.error){failed=true;process.stderr.write("Usuário temporário não foi removido.\n")}else process.stdout.write("Usuário temporário removido.\n")}}
if(failed)process.exitCode=1;
