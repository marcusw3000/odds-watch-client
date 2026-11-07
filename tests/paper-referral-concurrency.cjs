// Run only against the explicitly named disposable Docker database.
const { execFileSync, execFile, spawn } = require('node:child_process');
const { promisify } = require('node:util');
const exec = promisify(execFile);
const container = 'codex-referral-final-check';
const uid = '00000000-0000-4000-8000-000000000011';
const owner = '00000000-0000-4000-8000-000000000012';
const round = '00000000-0000-4000-8000-000000000013';
const request = '00000000-0000-4000-8000-000000000014';
const args = ['exec', '-i', container, 'psql', '-U', 'postgres', '-A', '-t', '-q', '-v', 'ON_ERROR_STOP=1'];
const query = sql => execFileSync('docker', [...args, '-c', sql], { encoding: 'utf8' });

(async () => {
  try {
    query(`INSERT INTO auth.users(id) VALUES('${uid}'),('${owner}'); INSERT INTO public.paper_referral_codes(owner_id,code) VALUES('${owner}','ABCDEF123456'); INSERT INTO public.polymarket_paper_wallets(user_id,round_id) VALUES('${uid}','${round}');`);
    const trade = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let tradeError = '';
    trade.stderr.on('data', chunk => { tradeError += chunk.toString(); });
    const locked = new Promise((resolve, reject) => {
      trade.stdout.on('data', chunk => { if (chunk.toString().includes('LOCKED')) resolve(); });
      trade.on('error', reject);
      trade.on('exit', code => { if (code) reject(new Error(tradeError || 'trade failed')); });
    });
    const done = new Promise((resolve, reject) => { trade.on('exit', code => code === 0 ? resolve() : reject(new Error(tradeError || 'trade failed'))); });
    trade.stdin.end(`BEGIN;\nSELECT pg_advisory_xact_lock(hashtextextended('${uid}',190711));\n\\echo LOCKED\nSELECT public.execute_verified_paper_trade('${uid}','${request}','${round}','123','Example','Yes','456','BUY',1,0.5);\nSELECT pg_sleep(2);\nCOMMIT;\n`);
    await locked;
    const started = Date.now();
    const result = await exec('docker', [...args, '-c', `SELECT set_config('request.jwt.claim.sub','${uid}',false); SET ROLE authenticated; SELECT public.apply_paper_referral('ABCDEF123456');`]);
    await done;
    if (!result.stdout.includes('ineligible') || Date.now() - started < 1000) throw new Error('Referral did not wait for the verified trade.');
    console.log('Concurrent trade and referral serialized correctly.');
  } finally {
    query(`DELETE FROM auth.users WHERE id IN ('${uid}','${owner}');`);
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
