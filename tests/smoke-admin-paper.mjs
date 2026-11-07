// Disposable accounts only; no emails are sent and cleanup runs in finally.
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
const url = process.env.SUPABASE_URL, serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY, publicKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url || !serviceKey || !publicKey || new URL(url).hostname !== 'tztqsorbugjhwljbiano.supabase.co') throw new Error('Projeto incorreto ou variáveis ausentes.');
const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const ids = [];
const check = (condition, message) => { if (!condition) throw new Error(message); };
try {
  const accounts = [];
  for (let i = 0; i < 2; i++) {
    const email = `admin-paper-${randomUUID()}@example.invalid`, password = randomBytes(24).toString('base64url');
    const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw new Error('Falha ao criar conta temporária.');
    ids.push(created.data.user.id);
    const client = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const login = await client.auth.signInWithPassword({ email, password });
    if (login.error) throw new Error('Falha ao autenticar conta temporária.');
    accounts.push({ client, email, id: created.data.user.id });
  }
  const [admin, user] = accounts;
  const legacyWallets = await service.from('wallets').select('user_id').in('user_id', ids);
  check(!legacyWallets.error && legacyWallets.data.length === 0, 'Contas novas não devem criar carteira BRL legada.');
  const role = await service.from('user_roles').insert({ user_id: admin.id, role: 'admin' });
  if (role.error) throw new Error('Falha ao preparar papel administrativo.');
  const wallet = await user.client.rpc('get_polymarket_paper_wallet');
  check(!wallet.error && Number(wallet.data.balance_usd) === 10000, 'Carteira simulada indisponível.');
  const list = await admin.client.functions.invoke('get-admin-users', { body: { search: user.email, limit: 20, offset: 0 } });
  check(!list.error && list.data?.users?.length === 1 && list.data.users[0].user_id === user.id && Number(list.data.users[0].balance_available) === 10000 && list.data.pagination.total === 1, 'Listagem ou saldo virtual incorreto.');
  const details = await admin.client.functions.invoke('get-admin-user-details', { body: { user_id: user.id } });
  check(!details.error && Number(details.data?.paper?.wallet?.balance_usd) === 10000 && Array.isArray(details.data.paper.positions), 'Detalhes paper indisponíveis.');
  const unauthorized = await user.client.functions.invoke('get-admin-user-details', { body: { user_id: admin.id } });
  check(Boolean(unauthorized.error), 'Usuário sem permissão acessou detalhes administrativos.');
  const health = await admin.client.rpc('get_admin_catalog_health');
  check(!health.error && Number.isFinite(Number(health.data.market_count)), 'Monitoramento indisponível.');
  const denied = await user.client.rpc('get_admin_catalog_health');
  check(Boolean(denied.error), 'Usuário sem permissão acessou monitoramento.');
  const ticket = await user.client.from('support_tickets').insert({ user_id: user.id, subject: 'Teste temporário', category: 'technical' }).select('id').single();
  check(!ticket.error && ticket.data?.id, 'Falha ao criar ticket.');
  const message = await user.client.from('support_messages').insert({ ticket_id: ticket.data.id, sender_id: user.id, message: 'Teste temporário', is_staff: false });
  check(!message.error, 'Falha ao enviar mensagem de suporte.');
  const forged = await user.client.from('support_messages').insert({ ticket_id: ticket.data.id, sender_id: user.id, message: 'Teste', is_staff: true });
  check(Boolean(forged.error), 'Usuário comum conseguiu se passar por atendente.');
  const adminTickets = await admin.client.functions.invoke('get-admin-support-tickets', { body: { limit: 20, offset: 0 } });
  if (adminTickets.error?.context instanceof Response) console.error('Suporte HTTP:', adminTickets.error.context.status, await adminTickets.error.context.text());
  check(!adminTickets.error && !adminTickets.data?.error, 'Listagem administrativa de suporte indisponível.');
  const reports = await admin.client.from('chat_reports').select('id').limit(1);
  check(!reports.error, 'Leitura administrativa de denúncias indisponível.');
  const marketReports = await admin.client.from('polymarket_comment_reports').select('id').limit(1);
  check(!marketReports.error, 'Leitura administrativa de denúncias Polymarket indisponível.');
  const reply = await admin.client.functions.invoke('manage-support-tickets', { body: { action: 'send_staff_message', ticketId: ticket.data.id, message: 'Resposta de teste' } });
  if (reply.error?.context instanceof Response) console.error('Resposta suporte HTTP:', reply.error.context.status, await reply.error.context.text());
  check(!reply.error && !reply.data?.error, 'Resposta administrativa de suporte indisponível.');
  const addRole = await admin.client.functions.invoke('manage-user-roles', { body: { user_id: user.id, action: 'add', role: 'moderator' } });
  if (addRole.error?.context instanceof Response) console.error('Papéis HTTP:', addRole.error.context.status, await addRole.error.context.text());
  check(!addRole.error && !addRole.data?.error, 'Falha ao atribuir papel temporário.');
  const block = await admin.client.functions.invoke('block-user', { body: { user_id: user.id, action: 'block', reason: 'Teste temporário' } });
  check(!block.error && !block.data?.error, 'Falha no bloqueio temporário.');
  const unblock = await admin.client.functions.invoke('block-user', { body: { user_id: user.id, action: 'unblock', reason: 'Fim do teste' } });
  check(!unblock.error && !unblock.data?.error, 'Falha no desbloqueio temporário.');
  console.log('Usuários, papel, bloqueio, saldo paper, suporte, denúncias e autorização verificados.');
} finally {
  for (const id of ids) {
    const { error } = await service.auth.admin.deleteUser(id);
    if (error) { console.error('Falha ao remover conta temporária.'); process.exitCode = 1; }
  }
  console.log(`Limpeza solicitada para ${ids.length} contas temporárias.`);
}
