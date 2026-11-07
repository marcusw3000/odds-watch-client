// Explicit project guard; creates two disposable users and deletes both at the end.
import { createClient } from "@supabase/supabase-js";
import { randomUUID, randomBytes } from "node:crypto";
const project = "tztqsorbugjhwljbiano", url = process.env.SUPABASE_URL, service = process.env.SUPABASE_SERVICE_ROLE_KEY, key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY, gateway = process.env.SUPABASE_GATEWAY_JWT, cronSecret = process.env.PAPER_COPY_CRON_SECRET;
if (url !== `https://${project}.supabase.co` || !service || !key || !gateway || !cronSecret) throw new Error("Configuração de teste não corresponde ao projeto esperado.");
const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
const users = [];
const check = (value, text) => { if (!value) throw new Error(text); };
let failed = false;
try {
  for (let i=0;i<2;i++) {
    const email=`copy-smoke-${randomUUID()}@example.invalid`, password=randomBytes(24).toString("base64url");
    const created=await admin.auth.admin.createUser({ email,password,email_confirm:true });
    check(!created.error && created.data.user?.id, `Falha ao criar usuário temporário (${created.error?.code ?? "desconhecida"}).`);
    const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    users.push({ id:created.data.user.id,client });
    const login=await client.auth.signInWithPassword({email,password}); check(!login.error,"Falha no login temporário.");
  }
  const [leader,follower]=users;
  const profile=await leader.client.from("profiles").update({display_name:"Trader temporário",is_public:true,show_trades:true}).eq("id",leader.id).select("id");
  check(!profile.error && profile.data?.length===1,"Não foi possível habilitar o perfil público temporário.");
  const wallet=await leader.client.rpc("get_polymarket_paper_wallet"); check(!wallet.error && wallet.data?.round_id,"Carteira do trader indisponível.");
  const save=await follower.client.rpc("save_paper_copy_strategy",{p_kind:"paper",p_source:leader.id,p_name:"Trader temporário",p_mode:"manual",p_total:100,p_per_trade:10}); check(!save.error && save.data,"Falha ao criar estratégia manual.");
  const trade=async () => { const result=await leader.client.functions.invoke("execute-polymarket-paper-trade",{body:{marketId:"561229",outcome:"Yes",side:"BUY",shares:10,requestId:randomUUID(),roundId:wallet.data.round_id,limitPrice:1}}); check(!result.error && result.data?.success,`Compra do trader falhou (${result.error?.name ?? "resposta inválida"}).`); };
  const worker=async () => { const response=await fetch(`${url}/functions/v1/process-paper-copy`,{method:"POST",headers:{Authorization:`Bearer ${gateway}`,"x-copy-cron-secret":cronSecret,"Content-Type":"application/json"},body:"{}"}); check(response.ok,`Processador indisponível (${response.status}).`); const result=await response.json(); check(result.failures===0,`Processador informou ${result.failures} falha(s).`); };
  await trade(); await worker();
  const pending=await follower.client.from("paper_copy_signals").select("*").eq("strategy_id",save.data).eq("status","pending"); check(!pending.error && pending.data?.length===1,"Sinal manual não foi detectado.");
  const notification=await follower.client.from("notifications").select("id,data").eq("user_id",follower.id); check(!notification.error && notification.data?.some(x=>x.data?.signal_id===pending.data[0].id),"Notificação manual não foi criada.");
  const approved=await follower.client.rpc("respond_paper_copy_signal",{p_signal:pending.data[0].id,p_accept:true}); check(!approved.error,"Aprovação manual falhou.");
  await worker();
  const done=await follower.client.from("paper_copy_signals").select("status").eq("id",pending.data[0].id).single(); check(!done.error && done.data?.status==="executed","Cópia manual não foi executada.");
  const before=await follower.client.from("polymarket_paper_trades").select("id"); check(!before.error && before.data?.length===1,"Compra copiada não entrou na carteira.");
  await worker(); const retried=await follower.client.from("polymarket_paper_trades").select("id"); check(!retried.error && retried.data?.length===1,"O processamento repetido duplicou a compra.");
  const auto=await follower.client.rpc("save_paper_copy_strategy",{p_kind:"paper",p_source:leader.id,p_name:"Trader temporário",p_mode:"automatic",p_total:100,p_per_trade:10}); check(!auto.error,"Falha ao ativar modo automático.");
  await trade(); await worker();
  const after=await follower.client.from("polymarket_paper_trades").select("id"); check(!after.error && after.data?.length===2,"Cópia automática não foi executada.");
  process.stdout.write("Cópia manual, notificação, execução, idempotência e modo automático: OK.\n");
} catch(error) { failed=true; process.stderr.write(`${error instanceof Error ? error.message : "Falha no teste temporário."}\n`); }
finally { for (const user of users) { await user.client.auth.signOut().catch(()=>{}); const deleted=await admin.auth.admin.deleteUser(user.id); if (deleted.error) { failed=true; process.stderr.write("Não foi possível remover um usuário temporário; revise a autenticação.\n"); } } if(users.length) process.stdout.write("Usuários temporários removidos.\n"); }
if(failed) process.exitCode=1;
