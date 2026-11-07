// Builds a reviewable restore file from the disposable restored database only.
// It does not connect to or change the hosted project.
const fs = require('node:fs');
const zlib = require('node:zlib');
const { spawn } = require('node:child_process');
const container = 'codex-catalog-restore-check';
const outPath = 'polymarket-market-cache-half-restore-20261106.sql.gz.local';
const protectedRows = JSON.parse(fs.readFileSync('polymarket-protected-market-ids-20261106.json.local', 'utf8').replace(/^\uFEFF/, '')).rows;
const ids = protectedRows.map(row => row.market_id);
if (!ids.every(id => typeof id === 'string' && /^\d{1,20}$/.test(id))) throw new Error('Identificador protegido inválido.');
const protectedSql = ids.length ? ids.map(id => `'${id}'`).join(',') : "''";
const columns = ['source','market_id','slug','question','description','image_url','condition_id','protocol_version','outcomes','volume_usd','liquidity_usd','spread','end_date','source_updated_at','accepting_orders','restricted','source_payload','synced_at','category','market_status','event_id','status_checked_at'];
const projection = columns.map(column => column === 'source_payload' ? "'{}'::jsonb" : `m.${column}`).join(',');
const sql = `COPY (WITH ranked AS (
  SELECT market_id,row_number() OVER (ORDER BY volume_usd DESC NULLS LAST,market_id) AS rn,
    count(*) OVER () AS total FROM public.polymarket_market_cache WHERE market_status='open'
) SELECT ${projection} FROM public.polymarket_market_cache m LEFT JOIN ranked r ON r.market_id=m.market_id
  WHERE (m.market_status='open' AND r.rn <= (r.total+1)/2) OR m.market_id IN (${protectedSql})
  ORDER BY m.market_id) TO STDOUT;`;
const cp = spawn('docker', ['exec','-i',container,'psql','-U','postgres','-v','ON_ERROR_STOP=1','-c',sql], { stdio:['ignore','pipe','pipe'] });
const out = fs.createWriteStream(outPath + '.partial', { flags:'wx' });
const zip = zlib.createGzip({ level:6 });
let errors='', exit=null, finished=false;
const done = () => { if (exit === null || !finished) return; if (exit !== 0) { console.error(errors); process.exitCode=exit; return; } fs.renameSync(outPath+'.partial',outPath); console.log(`Arquivo de restauração compacta criado: ${outPath}`); };
cp.stderr.on('data', data => { errors += data; });
cp.on('error', error => { console.error(error.message); process.exitCode=1; out.destroy(); });
cp.on('close', code => { exit=code??1; zip.end('\\.\nCOMMIT;\n'); done(); });
out.on('error', error => { console.error(error.message); process.exitCode=1; cp.kill(); });
out.on('finish', () => { finished=true; done(); });
zip.write(`BEGIN;\nSET TRANSACTION READ WRITE;\nCOPY public.polymarket_market_cache (${columns.join(',')}) FROM stdin;\n`);
cp.stdout.pipe(zip,{ end:false });
zip.pipe(out);
