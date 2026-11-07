// One-time cache maintenance. Password is read without echo and never written to disk.
const fs = require('node:fs');
const zlib = require('node:zlib');
const { spawn } = require('node:child_process');
const mode = process.argv[2];
if (!['check', 'schedule-closures', 'trigger-closures', 'truncate', 'restore'].includes(mode)) throw new Error('Invalid mode');
const backup = 'polymarket-market-cache-half-restore-20261106.sql.gz.local';
const data = JSON.parse(fs.readFileSync('polymarket-protected-market-ids-20261106.json.local', 'utf8').replace(/^\uFEFF/, ''));
const ids = data.rows.map(row => row.market_id);
if (!ids.every(id => typeof id === 'string' && /^\d+$/.test(id))) throw new Error('Invalid protected IDs');
const values = ids.map(id => `'${id}'`).join(',');
const guard = `BEGIN;
SET TRANSACTION READ WRITE;
LOCK TABLE public.polymarket_favorites, public.polymarket_paper_positions IN SHARE MODE;
LOCK TABLE public.polymarket_market_cache IN ACCESS EXCLUSIVE MODE;
DO $guard$
BEGIN
 IF (SELECT active FROM cron.job WHERE jobname='sync-polymarket-catalog') IS DISTINCT FROM false THEN RAISE EXCEPTION 'Sync cron must be paused'; END IF;
 IF EXISTS (SELECT 1 FROM public.polymarket_catalog_sync_state WHERE lease_expires_at > now()) THEN RAISE EXCEPTION 'Sync lease still active'; END IF;
 IF (SELECT count(*) FROM public.polymarket_market_cache) <> 206083 THEN RAISE EXCEPTION 'Cache changed since backup'; END IF;
 IF EXISTS (SELECT market_id FROM public.polymarket_paper_positions UNION SELECT market_id FROM public.polymarket_favorites EXCEPT SELECT unnest(ARRAY[${values}]::text[])) THEN RAISE EXCEPTION 'Protected markets changed since backup'; END IF;
END $guard$;
TRUNCATE TABLE public.polymarket_market_cache;
COMMIT;`;
process.stdout.write('Aguardando senha do banco sem exibição...\n');
if (!process.stdin.isTTY) throw new Error('TTY required');
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.once('data', chunk => {
  const password = chunk.toString().trim();
  process.stdin.setRawMode(false);
  process.stdin.pause();
  const args = ['exec', '-i', '-e', 'PGPASSWORD', '-e', 'PGSSLMODE=require', 'codex-catalog-restore-check', 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-h', 'aws-1-sa-east-1.pooler.supabase.com', '-p', '5432', '-U', 'postgres.tztqsorbugjhwljbiano', '-d', 'postgres'];
  const child = spawn('docker', args, { env: { ...process.env, PGPASSWORD: password }, stdio: ['pipe', 'pipe', 'pipe'] });
  const report = stream => stream.on('data', part => process.stdout.write(part.toString().split(password).join('[REDACTED]')));
  report(child.stdout); report(child.stderr);
  child.on('error', err => { console.error(err.message); process.exitCode = 1; });
  child.on('close', code => { process.exitCode = code || 0; });
  if (mode === 'restore') {
    const unzip = zlib.createGunzip();
    fs.createReadStream(backup).on('error', err => child.stdin.destroy(err)).pipe(unzip).on('error', err => child.stdin.destroy(err)).pipe(child.stdin);
  } else {
    child.stdin.end(mode === 'check' ? "SELECT current_database(), current_setting('default_transaction_read_only');\n" : mode === 'schedule-closures' ? fs.readFileSync('supabase/tests/schedule-polymarket-closures.sql', 'utf8') : mode === 'trigger-closures' ? "SELECT net.http_post(url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='polymarket_project_url') || '/functions/v1/check-polymarket-closures', headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='polymarket_cron_secret')), body := '{}'::jsonb);" : guard);
  }
});
