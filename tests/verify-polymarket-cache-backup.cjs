// Checks the gzip stream, pg_dump COPY framing and row count without loading the backup in memory.
const fs = require('node:fs');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const { pipeline } = require('node:stream/promises');
const { StringDecoder } = require('node:string_decoder');

const filename = process.argv[2];
if (!filename) throw new Error('Informe o arquivo de backup.');
const table = process.argv[3] || 'polymarket_market_cache';
if (!['polymarket_market_cache','polymarket_event_cache'].includes(table)) throw new Error('Tabela não suportada.');
(async () => {
  const sha = crypto.createHash('sha256');
  await pipeline(fs.createReadStream(filename), sha);
  const checksum = sha.digest('hex');
  const input = fs.createReadStream(filename);
  const unzip = zlib.createGunzip();
  input.on('error', error => unzip.destroy(error));
  input.pipe(unzip);
  let inCopy = false, started = false, ended = false, rows = 0, pending = '';
  const decoder = new StringDecoder('utf8');
  const countLine = line => {
    if (!started && (line.startsWith(`COPY public.${table} `) || line.startsWith(`COPY "public"."${table}" `)) && line.endsWith('FROM stdin;')) { started = true; inCopy = true; return; }
    if (inCopy && line === '\\.') { inCopy = false; ended = true; return; }
    if (inCopy) rows++;
  };
  for await (const chunk of unzip) {
    const lines = (pending + decoder.write(chunk)).split('\n');
    pending = lines.pop();
    for (const line of lines) countLine(line);
  }
  pending += decoder.end();
  if (pending) countLine(pending);
  if (!started || !ended || rows === 0) throw new Error('Backup incompleto ou sem linhas da cache.');
  console.log(JSON.stringify({ rows, compressed_bytes: fs.statSync(filename).size, sha256: checksum }));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
