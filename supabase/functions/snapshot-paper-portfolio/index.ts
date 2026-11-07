import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

const list = (value: unknown): unknown[] => { if (Array.isArray(value)) return value; if (typeof value === "string") { try { const parsed=JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; } } return []; };
export async function handleSnapshot(req: Request) {
  const cors = getCorsHeaders();
  const reply = (body: unknown, status=200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
  if (req.method === "OPTIONS") return new Response(null,{headers:cors});
  if (req.method !== "POST") return reply({error:"Método não permitido"},405);
  const url=Deno.env.get("SUPABASE_URL"), service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), anon=Deno.env.get("SUPABASE_ANON_KEY"), secret=Deno.env.get("PAPER_COPY_CRON_SECRET");
  if (!url || !service || !anon || !secret) return reply({error:"Serviço indisponível"},503);
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const scheduled=req.headers.get("x-copy-cron-secret")===secret;
  let candidates: string[]=[];
  if (scheduled) { const result=await admin.rpc("paper_snapshot_candidates"); if(result.error)return reply({error:"Fila indisponível"},503); candidates=(result.data??[]).map((row:{user_id:string})=>row.user_id); }
  else {
    const authorization=req.headers.get("Authorization"); if(!authorization?.startsWith("Bearer "))return reply({error:"Autenticação necessária"},401);
    const auth=createClient(url,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
    const claim=await auth.auth.getClaims(authorization.slice(7)); const user=claim.data?.claims?.sub;
    if(claim.error || typeof user!=="string" || !/^[0-9a-f-]{36}$/i.test(user))return reply({error:"Sessão inválida"},401);
    const [state,round]=await Promise.all([admin.from("paper_portfolio_snapshot_state").select("last_success_at,round_id").eq("user_id",user).maybeSingle(),admin.from("polymarket_paper_wallets").select("round_id").eq("user_id",user).maybeSingle()]);
    if(state.error || round.error)return reply({error:"Histórico indisponível"},503);
    if(state.data?.round_id===round.data?.round_id && state.data?.last_success_at && Date.now()-Date.parse(state.data.last_success_at)<300_000)return reply({recorded:0});
    candidates=[user];
  }
  let recorded=0, failed=0;
  for(const user of candidates) {
    try {
      const marked=await admin.rpc("mark_paper_snapshot_attempt",{p_user:user}); if(marked.error)throw marked.error;
      const [wallet,positions]=await Promise.all([admin.from("polymarket_paper_wallets").select("round_id,updated_at").eq("user_id",user).single(),admin.from("polymarket_paper_positions").select("market_id,outcome_label,outcome_token_id,shares,average_price,legacy_cost,verified_cost").eq("user_id",user).limit(1000)]);
      if(wallet.error||positions.error||!wallet.data || (positions.data?.length??0)>=1000)throw new Error("Carteira indisponível ou muito extensa");
      const rows=positions.data??[], ids=[...new Set(rows.map(p=>String(p.market_id)))], markets=new Map<string,Record<string,unknown>>();
      for(let i=0;i<ids.length;i+=20){
        const gamma=new URL("https://gamma-api.polymarket.com/markets"); gamma.searchParams.set("closed","any");gamma.searchParams.set("limit","20");for(const id of ids.slice(i,i+20))gamma.searchParams.append("id",id);
        const response=await fetch(gamma,{signal:AbortSignal.timeout(8000)});if(!response.ok)throw new Error("Cotações indisponíveis");const payload=await response.json();if(!Array.isArray(payload))throw new Error("Cotações inválidas");for(const row of payload)if(row && typeof row==="object")markets.set(String(row.id),row);
      }
      let value=0,cost=0;
      for(const p of rows){
        const market=markets.get(String(p.market_id));if(!market)throw new Error("Cotação ausente");const outcomes=list(market.outcomes), tokens=list(market.clobTokenIds), prices=list(market.outcomePrices);
        const idx=p.outcome_token_id && tokens.length ? tokens.findIndex(t=>String(t)===p.outcome_token_id) : outcomes.findIndex(o=>String(o)===p.outcome_label);
        const price=idx>=0 && prices[idx]!==null && prices[idx]!=="" ? Number(prices[idx]) : NaN, shares=Number(p.shares), entry= p.legacy_cost!=null && p.verified_cost!=null ? Number(p.legacy_cost)+Number(p.verified_cost) : Number(p.average_price)*shares;
        if(!Number.isFinite(price)||price<0||price>1||!Number.isFinite(shares)||shares<0||!Number.isFinite(entry))throw new Error("Cotação incompleta");value+=price*shares;cost+=entry;
      }
      const saved=await admin.rpc("save_paper_portfolio_snapshot",{p_user:user,p_round:wallet.data.round_id,p_wallet_updated:wallet.data.updated_at,p_positions_value:Number(value.toFixed(6)),p_open_pnl:Number((value-cost).toFixed(6))});if(saved.error)throw saved.error;recorded++;
    } catch(error) { failed++;console.error("[paper-history] snapshot failed",user,error); }
  }
  return reply({recorded,failed},failed ? 503 : 200);
}
Deno.serve(handleSnapshot);
