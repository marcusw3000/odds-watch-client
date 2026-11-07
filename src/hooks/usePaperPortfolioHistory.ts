import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PaperHistoryPeriod = "day" | "week" | "month" | "all";
export function usePaperPortfolioHistory(userId: string | undefined, roundId: string | undefined, period: PaperHistoryPeriod) {
  const client=useQueryClient();
  useEffect(()=>{
    if(!userId || !roundId)return;
    let cancelled=false;
    const capture=async()=>{try { const {error}=await supabase.functions.invoke("snapshot-paper-portfolio",{body:{}});if(!error && !cancelled)await client.invalidateQueries({queryKey:["paper-portfolio-history",userId,roundId]}); } catch { /* Keep any previously recorded history available. */ }};
    void capture();const timer=setInterval(capture,300_000);return()=>{cancelled=true;clearInterval(timer);};
  },[userId,roundId,client]);
  return useQuery({queryKey:["paper-portfolio-history",userId,roundId,period],enabled:Boolean(userId&&roundId),refetchInterval:60_000,queryFn:async()=>{
    const hours=period==="day"?24:period==="week"?168:period==="month"?720:null, cutoff=hours ? new Date(Date.now()-hours*3_600_000).toISOString() : null;
    const result: Array<{time:number;value:number}>=[]; let truncated=false;
    for(let page=0;page<10;page++){
      let query=(supabase as any).from("paper_portfolio_snapshots").select("observed_at,open_pnl").eq("round_id",roundId).order("observed_at",{ascending:false}).range(page*1000,page*1000+999);
      if(cutoff)query=query.gte("observed_at",cutoff);
      const {data,error}=await query;if(error)throw error;
      for(const row of data??[]){if(row.open_pnl==null)continue;const time=Date.parse(row.observed_at),value=Number(row.open_pnl);if(Number.isFinite(time)&&Number.isFinite(value))result.push({time,value});}
      if((data?.length??0)<1000)break;
      if(page===9)truncated=true;
    }
    return { points:result.reverse(), truncated };
  }});
}
