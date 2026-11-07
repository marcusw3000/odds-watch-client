// Run only against the isolated PostgreSQL fixture created for this test.
const { execFile, execFileSync } = require("node:child_process");
const { promisify } = require("node:util");
const run = promisify(execFile);
const db = "codex-paper-ranking-isolated";
const args = (sql) => ["exec", db, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-c", sql];
const query = (sql) => execFileSync("docker", args(sql), { encoding: "utf8" }).trim();
const exec = (sql) => run("docker", args(sql));
const user = "b3881da7-352b-4b42-bb51-3d07882d5a3d";
const round = "9d74c928-60bb-4f87-9325-9fa46ee82541";
const request = "915c695e-0244-40ae-b853-bce0842a638f";
const call = (id, shares) => `SELECT public.execute_verified_paper_trade('${user}','${id}','${round}','1','Test','Yes','123','BUY',${shares},1);`;

(async () => {
  query(`INSERT INTO auth.users(id) VALUES('${user}'); INSERT INTO public.polymarket_paper_wallets(user_id,round_id) VALUES('${user}','${round}');`);
  const first = await Promise.allSettled([exec(call(request, 100)), exec(call(request, 100))]);
  if (first.some((v) => v.status !== "fulfilled")) throw new Error("concurrent idempotent retry failed");
  if (query(`SELECT count(*) FROM public.polymarket_paper_trades WHERE user_id='${user}'`) !== "1") throw new Error("duplicate trade registered");
  const second = await Promise.allSettled([exec(call("96064fb8-a930-4bb3-965b-1dc2e3ca02ae", 6000)), exec(call("f6e2420e-26eb-4b67-a135-d9c5968e89e9", 6000))]);
  if (second.filter((v) => v.status === "fulfilled").length !== 1) throw new Error("concurrent overspending was not prevented");
  if (query(`SELECT balance_usd FROM public.polymarket_paper_wallets WHERE user_id='${user}'`) !== "3900.000000") throw new Error("incorrect balance after concurrent buys");
  process.stdout.write("Concurrent retries and balance protection passed.\n");
})().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
