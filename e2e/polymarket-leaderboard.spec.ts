import { expect, test } from "@playwright/test";

test("public ranking loads another page, profiles and biggest wins",async({page})=>{
  const first="0x1234567890123456789012345678901234567890",second="0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
  await page.route("**/api/polymarket/leaderboard?*",route=>{
    const cursor=new URL(route.request().url()).searchParams.get("cursor");
    return route.fulfill({json:cursor?{entries:[{rank:2,address:second,name:"Segundo trader",image:null,pnl:4,volume:50}],nextCursor:null}:{entries:[{rank:1,address:first,name:"Primeiro trader",image:null,pnl:10,volume:100}],nextCursor:"next_123"}});
  });
  await page.route("**/api/polymarket/biggest-wins?*",route=>route.fulfill({json:{wins:[{rank:1,address:first,name:"Primeiro trader",title:"Evento público",initial:10,final:20,pnl:10,kind:"market",eventId:"1"}]}}));
  await page.goto("/leaderboard");
  await page.getByRole("tab",{name:"Polymarket"}).click();
  await expect(page.getByRole("link",{name:/Primeiro trader/}).first()).toHaveAttribute("href",`/polymarket/trader/${first}`);
  await expect(page.getByText("Evento público")).toBeVisible();
  await expect(page.getByText("Volume (shares)")).toBeVisible();
  await page.getByRole("button",{name:"Carregar mais"}).click();
  await expect(page.getByRole("link",{name:/Segundo trader/}).first()).toHaveAttribute("href",`/polymarket/trader/${second}`);
  await expect(page.getByRole("button",{name:"Carregar mais"})).toHaveCount(0);
});
