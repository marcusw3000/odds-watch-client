// Run exclusively against the disposable restored Docker instance; never targets production.
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const container = 'codex-catalog-restore-check';
const backup = JSON.parse(fs.readFileSync('polymarket-protected-market-ids-20261106.json.local', 'utf8').replace(/^\uFEFF/, ''));
const ids = backup.rows.map(row => row.market_id);
if (!ids.every(id => typeof id === 'string' && /^\d{1,20}$/.test(id))) throw new Error('Identificador protegido inválido.');
const values = ids.length ? ids.map(id => `('${id}')`).join(',') : null;
const setup = `CREATE TEMP TABLE protected_ids(market_id text PRIMARY KEY); ${values ? `INSERT INTO protected_ids VALUES ${values} ON CONFLICT DO NOTHING;` : ''}
SELECT 'bytes_before',pg_total_relation_size('public.polymarket_market_cache');
CREATE TEMP TABLE victims AS
SELECT market_id FROM public.polymarket_market_cache m WHERE m.market_status='closed' AND NOT EXISTS(SELECT 1 FROM protected_ids p WHERE p.market_id=m.market_id)
UNION ALL
(SELECT market_id FROM public.polymarket_market_cache m WHERE m.market_status='open' AND NOT EXISTS(SELECT 1 FROM protected_ids p WHERE p.market_id=m.market_id)
 ORDER BY volume_usd ASC NULLS FIRST,market_id LIMIT (SELECT count(*)/2 FROM public.polymarket_market_cache WHERE market_status='open'));
SELECT 'removed_rows',count(*) FROM victims;
DELETE FROM public.polymarket_market_cache m USING victims v WHERE m.market_id=v.market_id;
VACUUM (ANALYZE) public.polymarket_market_cache;
SELECT 'bytes_after_vacuum',pg_total_relation_size('public.polymarket_market_cache');
SELECT 'remaining_rows',count(*) FROM public.polymarket_market_cache;
SELECT 'protected_missing',count(*) FROM protected_ids p WHERE NOT EXISTS(SELECT 1 FROM public.polymarket_market_cache m WHERE m.market_id=p.market_id);`;
const result = execFileSync('docker', ['exec','-i',container,'psql','-U','postgres','-A','-t','-v','ON_ERROR_STOP=1'], { input: setup, encoding:'utf8', maxBuffer:1024*1024 });
console.log(result.trim());
