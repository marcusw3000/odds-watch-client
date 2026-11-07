import { afterEach, describe, expect, it, vi } from "vitest";
import { getPolymarketTrader } from "@/services/PolymarketTrader.server";
import { getPolymarketBiggestWins } from "@/services/PolymarketLeaderboard.server";
afterEach(()=>vi.unstubAllGlobals());
const wallet="0x1234567890123456789012345678901234567890";
describe("public Polymarket profiles",()=>{
  it("maps public stats, prices and P&L without treating missing values as zero",async()=>{
    vi.stubGlobal("fetch",vi.fn(async(input:RequestInfo|URL)=>{
      const url=new URL(String(input));let body:unknown;
      if(url.pathname==="/public-profile")body={name:"Trader"};
      else if(url.pathname==="/v2/user-stats")body={data:{biggest_win:10,trades:2,all_time_pnl:{position_pnl:-5,volume_usdc:100}}};
      else if(url.pathname==="/v2/value")body={data:{value:50}};
      else if(url.pathname==="/v2/user-pnl")body={data:{points:[{timestamp:1,position_pnl:-5},{timestamp:2,position_pnl:null}]}};
      else body={data:[{title:"Market",outcome:"Yes",token_id:"1",current_size:10,current_price:0.5,avg_price:0.4,current_value:5,unrealized_pnl:1}]};
      return new Response(JSON.stringify(body),{status:200});
    }));
    const result=await getPolymarketTrader(wallet,"1w");
    expect(result).toMatchObject({name:"Trader",portfolioValue:50,biggestWin:10,marketsTraded:2,allTimePnl:-5,points:[{time:1000,value:-5}],positions:[{title:"Market",shares:10,current:0.5}]});
    await expect(getPolymarketTrader("bad","1w")).rejects.toThrow();
  });
  it("maps biggest winning positions without inventing event ids",async()=>{
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response(JSON.stringify({data:[{user_id:wallet,win_rank:1,pnl:5,initial_value:10,final_value:15,user_name:"Trader",event_title:"Event",event_id:0,kind:"combo"}]}),{status:200})));
    expect(await getPolymarketBiggestWins(new URLSearchParams("period=month"))).toMatchObject([{name:"Trader",pnl:5,eventId:null}]);
  });
});
