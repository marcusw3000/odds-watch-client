// Read-only check: reconstruct a recent public sale against a position snapshot.
import { inferSalePositions } from "../supabase/functions/_shared/paperCopy.ts";
const json=async url=>{const r=await fetch(url,{signal:AbortSignal.timeout(8000)});if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json()};
const board=await json("https://data-api.polymarket.com/v2/leaderboard?time_period=day&limit=40");let checked=false;
for(const trader of board.data??[]){
  try{
    const q=new URLSearchParams({user:trader.user_id,type:"TRADE",side:"SELL",limit:"3"});const sells=await json(`https://data-api.polymarket.com/v2/activity?${q}`);
    for(const sale of sells.data??[]){
      if(!sale.condition_id||!sale.token_id||sale.is_combo||Number(sale.timestamp)>Math.floor(Date.now()/1000)-5)continue;
      let position;for(const status of ["OPEN","CLOSED"]){const p=await json(`https://data-api.polymarket.com/v2/positions?${new URLSearchParams({user:trader.user_id,condition:sale.condition_id,status,filter_amount:"0",limit:"100"})}`);if(p.pagination?.next_cursor)break;position=p.data?.find(x=>x.token_id===sale.token_id);if(position)break;}
      if(!position||position.current_size==null||position.last_event_at==null)continue;
      const a=await json(`https://data-api.polymarket.com/v2/activity?${new URLSearchParams({user:trader.user_id,type:"TRADE,SPLIT,MERGE,REDEEM,CONVERSION,MIGRATION,DIRECTIONAL_SPLIT,DIRECTIONAL_MERGE,THRESHOLD_COMPOSE,THRESHOLD_DECOMPOSE",start:String(sale.timestamp),limit:"1000"})}`);if(a.pagination?.next_cursor)continue;
      if(a.data.some(r=>r.type!=="TRADE"&&(r.condition_id===sale.condition_id||(r.event_slug&&r.event_slug===sale.event_slug))&&r.timestamp>=sale.timestamp))continue;
      const groups=new Map();for(const row of a.data){if(row.type!=="TRADE"||row.token_id!==sale.token_id||!["BUY","SELL"].includes(row.side)||!row.transaction_hash)continue;const id=`${row.transaction_hash}:${row.side}`,item=groups.get(id)??{key:id,side:row.side,shares:0,time:Number(row.timestamp)};item.shares+=Number(row.size);groups.set(id,item)}
      const positions=inferSalePositions([...groups.values()],Number(position.current_size),Number(position.last_event_at),Math.floor(Date.now()/1000)-2),before=positions.get(`${sale.transaction_hash}:SELL`);
      if(before&&before>=Number(sale.size)){console.log("Venda pública: posição anterior reconstruída e proporção validada.");checked=true;break}
    }
  }catch{/* Try the next public trader; incomplete or ambiguous data must fail closed. */}
  if(checked)break;
}
if(!checked){console.error("Nenhuma venda pública com dados coerentes disponível nesta amostra.");process.exitCode=2;}
