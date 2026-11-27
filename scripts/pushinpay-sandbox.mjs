import { open, readFile, rename, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createPushinPaySandboxPix, getPushinPaySandboxPix } from '../src/services/PushinPaySandbox.server.ts';

const statePath = new URL('../pushinpay-sandbox.local', import.meta.url);
const lockPath = new URL('../pushinpay-sandbox-lock.local', import.meta.url);
const token = process.env.PUSHINPAY_SANDBOX_TOKEN?.trim();
const [command, argument] = process.argv.slice(2);

if (!token) throw new Error('Configure PUSHINPAY_SANDBOX_TOKEN no ambiente local.');
if (!['criar', 'consultar', 'listar'].includes(command)) {
  throw new Error('Use criar <centavos>, consultar <identificador local> ou listar.');
}

let lock;
try {
  lock = await open(lockPath, 'wx');
} catch (error) {
  if (error.code === 'EEXIST') throw new Error('Outra operação de homologação está em andamento.');
  throw error;
}

try {
  let state;
  try {
    state = JSON.parse(await readFile(statePath, 'utf8'));
    if (!Array.isArray(state)) throw new Error('Registro inválido.');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    state = [];
  }
  const save = async () => {
    const temporary = new URL(`../pushinpay-sandbox-${randomUUID()}.local`, import.meta.url);
    await writeFile(temporary, JSON.stringify(state, null, 2), { flag: 'wx', mode: 0o600 });
    await rename(temporary, statePath);
  };

  if (command === 'criar') {
    const cents = Number(argument);
    if (!/^\d+$/.test(argument ?? '') || !Number.isSafeInteger(cents) || cents < 50) {
      throw new Error('Informe um valor inteiro em centavos, de pelo menos 50.');
    }
    const entry = { localId: randomUUID(), valueCents: cents, status: 'resultado_desconhecido', createdAt: new Date().toISOString() };
    state.push(entry);
    await save();
    const charge = await createPushinPaySandboxPix(cents, token);
    Object.assign(entry, charge, { status: 'created' });
    await save();
    console.log(JSON.stringify(entry, null, 2));
  } else if (command === 'consultar') {
    const entry = state.find(item => item.localId === argument);
    if (!entry?.id) throw new Error('Cobrança local sem identificador confirmado. Verifique no painel da Pushin Pay.');
    if (Date.now() - (entry.lastCheckedAt ?? 0) < 60000) throw new Error('Aguarde um minuto antes de consultar novamente.');
    entry.lastCheckedAt = Date.now();
    await save();
    const result = await getPushinPaySandboxPix(entry.id, entry.valueCents, token);
    entry.status = result.status;
    await save();
    console.log(JSON.stringify(entry, null, 2));
  } else {
    console.log(JSON.stringify(state, null, 2));
  }
} finally {
  await lock.close();
  const { unlink } = await import('node:fs/promises');
  await unlink(lockPath);
}
