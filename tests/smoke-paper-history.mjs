import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
const project="tztqsorbugjhwljbiano",url=process.env.SUPABASE_URL,service=process.env.SUPABASE_SERVICE_ROLE_KEY,key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if(url!==`https://${project}.supabase.co`||!service||!key)throw new Error("Configuração incorreta.");
const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}}),client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const check=(x,m)=>{if(!x)throw new Error(m)};let id,failed=false;
try{
  const email=`history-smoke-${randomUUID()}@example.invalid`,password=randomBytes(24).toString("base64url");
  const created=await admin.auth.admin.createUser({email,password,email_confirm:true});check(!created.error&&created.data.user?.id,"Falha ao criar usuário temporário.");id=created.data.user.id;
  const login=await client.auth.signInWithPassword({email,password});check(!login.error,"Falha no login.");
  const wallet=await client.rpc("get_polymarket_paper_wallet");check(!wallet.error&&wallet.data?.round_id,"Carteira indisponível.");
  const trade=await client.functions.invoke("execute-polymarket-paper-trade",{body:{marketId:"561229",outcome:"Yes",side:"BUY",shares:10,requestId:randomUUID(),roundId:wallet.data.round_id,limitPrice:1}});check(!trade.error&&trade.data?.success,"Compra simulada falhou.");
  const capture=await client.functions.invoke("snapshot-paper-portfolio",{body:{}});check(!capture.error&&capture.data?.recorded===1,`Coleta não concluída (${capture.error?.name ?? "resposta inválida"}).`);
  const rows=await client.from("paper_portfolio_snapshots").select("round_id,positions_value,open_pnl").eq("round_id",wallet.data.round_id);check(!rows.error&&rows.data?.length===1&&Number(rows.data[0].positions_value)>0&&Number.isFinite(Number(rows.data[0].open_pnl)),"Histórico de preços não foi salvo.");
  const forbidden=await client.from("paper_portfolio_snapshots").insert({user_id:id,round_id:wallet.data.round_id,observed_hour:new Date().toISOString(),positions_value:999,open_pnl:999,realized_pnl:999});check(Boolean(forbidden.error),"Gravação direta de histórico foi aceita.");
  const reset=await client.rpc("reset_polymarket_paper_wallet");check(!reset.error,"Reset falhou.");
  const newWallet=await client.rpc("get_polymarket_paper_wallet");check(!newWallet.error&&newWallet.data?.round_id!==wallet.data.round_id,"Rodada não mudou.");
  const captureNew=await client.functions.invoke("snapshot-paper-portfolio",{body:{}});check(!captureNew.error&&captureNew.data?.recorded===1,"Nova rodada não recebeu amostra.");
  const fresh=await client.from("paper_portfolio_snapshots").select("round_id,positions_value,open_pnl").eq("round_id",newWallet.data.round_id);check(!fresh.error&&fresh.data?.length===1&&Number(fresh.data[0].positions_value)===0,"Histórico da nova rodada incorreto.");
  process.stdout.write("Histórico, cotação no servidor, permissões e reset: OK.\n");
}catch(error){failed=true;process.stderr.write(`${error instanceof Error?error.message:"Falha no teste."}\n`)}
finally{await client.auth.signOut().catch(()=>{});if(id){const deleted=await admin.auth.admin.deleteUser(id);if(deleted.error){failed=true;process.stderr.write("Usuário temporário não foi removido.\n")}else process.stdout.write("Usuário temporário removido.\n")}}
if(failed)process.exitCode=1;
