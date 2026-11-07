import { createClient } from "@supabase/supabase-js";
import { randomUUID, randomBytes } from "node:crypto";
const project="tztqsorbugjhwljbiano", url=process.env.SUPABASE_URL, service=process.env.SUPABASE_SERVICE_ROLE_KEY, key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if(url!==`https://${project}.supabase.co` || !service || !key) throw new Error("Configuração incorreta.");
const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}}), users=[];
const check=(ok,message)=>{if(!ok)throw new Error(message)};
let failed=false;
try {
  for(let i=0;i<2;i++){
    const email=`copy-cron-${randomUUID()}@example.invalid`,password=randomBytes(24).toString("base64url");
    const result=await admin.auth.admin.createUser({email,password,email_confirm:true}); check(!result.error && result.data.user?.id,"Falha ao criar usuário temporário.");
    const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}); users.push({id:result.data.user.id,client});
    const login=await client.auth.signInWithPassword({email,password}); check(!login.error,"Falha na autenticação.");
  }
  const [leader,follower]=users;
  const profile=await leader.client.from("profiles").update({display_name:"Teste do cron",is_public:true,show_trades:true}).eq("id",leader.id).select("id"); check(!profile.error && profile.data?.length===1,"Perfil temporário indisponível.");
  const wallet=await leader.client.rpc("get_polymarket_paper_wallet"); check(!wallet.error && wallet.data?.round_id,"Carteira indisponível.");
  const strategy=await follower.client.rpc("save_paper_copy_strategy",{p_kind:"paper",p_source:leader.id,p_name:"Teste do cron",p_mode:"automatic",p_total:100,p_per_trade:10}); check(!strategy.error && strategy.data,"Estratégia indisponível.");
  const trade=await leader.client.functions.invoke("execute-polymarket-paper-trade",{body:{marketId:"561229",outcome:"Yes",side:"BUY",shares:10,requestId:randomUUID(),roundId:wallet.data.round_id,limitPrice:1}}); check(!trade.error && trade.data?.success,"Compra simulada falhou.");
  process.stdout.write("Aguardando execução do agendador...\n");
  const deadline=Date.now()+120_000; let success=false;
  while(Date.now()<deadline){
    const signals=await follower.client.from("paper_copy_signals").select("status,reason").eq("strategy_id",strategy.data);
    check(!signals.error,"Falha ao consultar sinais.");
    if(signals.data?.some(s=>s.status==="executed")){success=true;break;}
    const skipped=signals.data?.find(s=>s.status==="skipped"); if(skipped) throw new Error(`Cópia ignorada: ${skipped.reason ?? "sem motivo"}`);
    await new Promise(resolve=>setTimeout(resolve,3000));
  }
  check(success,"O cron não concluiu a cópia no prazo de teste.");
  const trades=await follower.client.from("polymarket_paper_trades").select("id"); check(!trades.error && trades.data?.length===1,"Carteira não recebeu a cópia.");
  const original=await follower.client.from("paper_copy_positions").select("shares").eq("strategy_id",strategy.data).eq("market_id","561229").single(); check(!original.error && Number(original.data?.shares)>0,"Posição copiada indisponível.");
  const sale=await leader.client.functions.invoke("execute-polymarket-paper-trade",{body:{marketId:"561229",outcome:"Yes",side:"SELL",shares:5,requestId:randomUUID(),roundId:wallet.data.round_id,limitPrice:0.000001}}); check(!sale.error && sale.data?.success,"Venda simulada do trader falhou.");
  process.stdout.write("Aguardando venda proporcional pelo agendador...\n");
  const saleDeadline=Date.now()+120_000;let saleDone=false;
  while(Date.now()<saleDeadline){
    const signals=await follower.client.from("paper_copy_signals").select("status,reason").eq("strategy_id",strategy.data).eq("side","SELL");check(!signals.error,"Falha ao consultar venda.");
    if(signals.data?.some(s=>s.status==="executed")){saleDone=true;break;}
    const skipped=signals.data?.find(s=>s.status==="skipped");if(skipped)throw new Error(`Venda ignorada: ${skipped.reason ?? "sem motivo"}`);
    await new Promise(resolve=>setTimeout(resolve,3000));
  }
  check(saleDone,"O cron não concluiu a venda no prazo de teste.");
  const remaining=await follower.client.from("paper_copy_positions").select("shares").eq("strategy_id",strategy.data).eq("market_id","561229").single();
  check(!remaining.error && Math.abs(Number(remaining.data?.shares)-Number(original.data.shares)/2)<0.000002,"A venda não correspondeu à proporção do trader.");
  process.stdout.write("Agendamento, compra e venda proporcional simuladas: OK.\n");
} catch(error) { failed=true;process.stderr.write(`${error instanceof Error ? error.message : "Falha no teste temporário."}\n`); }
finally { for(const user of users){await user.client.auth.signOut().catch(()=>{});const result=await admin.auth.admin.deleteUser(user.id);if(result.error){failed=true;process.stderr.write("Não foi possível remover um usuário temporário.\n");}} if(users.length)process.stdout.write("Usuários temporários removidos.\n"); }
if(failed)process.exitCode=1;
