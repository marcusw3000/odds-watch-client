// Run after `npm run build` with the same public environment used by the build.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createRequestHandler } from 'react-router';

const serverDir = new URL('../build/server/', import.meta.url);
const files = ['index.js', ...(await readdir(new URL('assets/', serverDir))).filter(name => name.endsWith('.js')).map(name => `assets/${name}`)];
for (const file of files) {
  const source = await readFile(new URL(file, serverDir), 'utf8');
  assert.doesNotMatch(source, /(?:from\s*|import\s*\(|require\s*\()\s*['"]react-router(?:-dom|\/dom)?['"]/, `External router dependency in ${file}`);
}
const build = await import('../build/server/index.js');
const response = await createRequestHandler(build, 'production')(new Request('http://localhost/auth'));
assert.equal(response.status, 200);
const html = await response.text();
assert.match(html, /<html/i);
assert.match(html, /OddsWatch/i);
console.log('SSR de produção respondeu com HTTP 200 e React Router incluído no bundle.');
process.exit(0);
