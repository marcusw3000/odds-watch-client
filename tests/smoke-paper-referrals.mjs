// Creates only disposable confirmed users, sends no email, and removes them in finally.
// Run explicitly with: node --env-file=.env.local tests/smoke-paper-referrals.mjs
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const publicKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url || !serviceKey || !publicKey || new URL(url).hostname !== 'tztqsorbugjhwljbiano.supabase.co') throw new Error('Projeto de teste incorreto ou variáveis ausentes.');
const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const ids = [];
const check = (condition, message) => { if (!condition) throw new Error(message); };

try {
  const clients = [];
  for (let i = 0; i < 3; i++) {
    const email = `paper-ref-${randomUUID()}@example.invalid`;
    const password = randomBytes(24).toString('base64url');
    const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw new Error('Falha ao criar conta temporária.');
    ids.push(created.data.user.id);
    const client = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const login = await client.auth.signInWithPassword({ email, password });
    if (login.error) throw new Error('Falha ao autenticar conta temporária.');
    clients.push(client);
  }
  const code = await clients[0].rpc('get_my_paper_referral_code');
  check(!code.error && /^[A-F0-9]{12}$/.test(code.data), 'Falha ao gerar código.');
  const self = await clients[0].rpc('apply_paper_referral', { p_code: code.data });
  check(!self.error && self.data === 'own_code', 'Autovínculo não foi bloqueado.');
  for (const client of clients.slice(1)) {
    const result = await client.rpc('apply_paper_referral', { p_code: code.data });
    check(!result.error && result.data === 'applied', 'Falha no vínculo de convidado.');
    const repeated = await client.rpc('apply_paper_referral', { p_code: code.data });
    check(!repeated.error && repeated.data === 'already_linked', 'Vínculo não foi idempotente.');
  }
  const stats = await clients[0].rpc('get_my_paper_referral_stats');
  check(!stats.error && Number(stats.data?.[0]?.total_referred) === 2 && Number(stats.data?.[0]?.verified_trades) === 0, 'Métricas incorretas.');
  const direct = await clients[1].from('paper_referral_links').select('*');
  check(Boolean(direct.error), 'Leitura direta de convites permitida indevidamente.');
  const admin = await clients[1].rpc('get_paper_referral_admin_stats');
  check(Boolean(admin.error), 'Usuário comum acessou métricas administrativas.');
  const ownerExport = await clients[0].functions.invoke('export-user-data', { body: { format: 'json' } });
  check(!ownerExport.error && !ownerExport.data?.error, 'Falha na exportação de quem convidou.');
  check(ownerExport.data?.paper_referral?.code?.code === code.data && ownerExport.data?.paper_referral?.shared_invitations?.length === 2, 'Convites ausentes na exportação.');
  check(ownerExport.data.paper_referral.shared_invitations.every(row => !('referred_id' in row)), 'Exportação revelou dados de terceiros.');
  const invitedExport = await clients[1].functions.invoke('export-user-data', { body: { format: 'json' } });
  check(!invitedExport.error && invitedExport.data?.paper_referral?.received_invitation?.created_at, 'Convite recebido ausente na exportação.');
  console.log('Convites: código reutilizável, autocadastro bloqueado, idempotência, métricas e privacidade verificados.');
} finally {
  for (const id of ids) {
    const { error } = await service.auth.admin.deleteUser(id);
    if (error) { console.error('Falha ao limpar conta temporária.'); process.exitCode = 1; }
  }
  if (ids.length) console.log(`Limpeza solicitada para ${ids.length} contas temporárias.`);
}
