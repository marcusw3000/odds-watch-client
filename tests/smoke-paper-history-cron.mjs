import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
const project="tztqsorbugjhwljbiano",url=process.env.SUPABASE_URL,service=process.env.SUPABASE_SERVICE_ROLE_KEY,key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if(url!==`https://${project}.supabase.co`||!service||!key)throw new Error("Configuração incorreta.");
const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}}),client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});let id,failed=false;
const check=(ok,message)=>{if(!ok)throw new Error(message)};
try{
  const email=`history-cron-${randomUUID()}@example.invalid`,password=randomBytes(24).toString("base64url");
  const created=await admin.auth.admin.createUser({email,password,email_confirm:true});check(!created.error&&created.data.user?.id,"Falha ao criar usuário temporário.");id=created.data.user.id;
  const login=await client.auth.signInWithPassword({email,password});check(!login.error,"Login temporário falhou.");
  const wallet=await client.rpc("get_polymarket_paper_wallet");check(!wallet.error&&wallet.data?.round_id,"Carteira indisponível.");
  const trade=await client.functions.invoke("execute-polymarket-paper-trade",{body:{marketId:"561229",outcome:"Yes",side:"BUY",shares:10,requestId:randomUUID(),roundId:wallet.data.round_id,limitPrice:1}});check(!trade.error&&trade.data?.success,"Compra simulada falhou.");
  process.stdout.write("Aguardando a coleta agendada do histórico...\n");let found=false;const deadline=Date.now()+360000;
  while(Date.now()<deadline){const result=await client.from("paper_portfolio_snapshots").select("positions_value,open_pnl").eq("round_id",wallet.data.round_id);check(!result.error,"Consulta do histórico falhou.");if(result.data?.length&&Number(result.data[0].positions_value)>0){found=true;break;}await new Promise(resolve=>setTimeout(resolve,5000));}
  check(found,"O cron não registrou a amostra no prazo de teste.");process.stdout.write("Coleta automática de histórico em segundo plano: OK.\n");
}catch(error){failed=true;process.stderr.write(`${error instanceof Error?error.message:"Falha no teste."}\n`)}
finally{await client.auth.signOut().catch(()=>{});if(id){const result=await admin.auth.admin.deleteUser(id);if(result.error){failed=true;process.stderr.write("Usuário temporário não foi removido.\n")}else process.stdout.write("Usuário temporário removido.\n")}}
if(failed)process.exitCode=1;
