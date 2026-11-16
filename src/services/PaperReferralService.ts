import { supabase } from '@/integrations/supabase/client';

export type PaperReferralResult = 'applied' | 'already_linked' | 'invalid' | 'ineligible' | 'own_code';
export interface PaperReferralStats { total_referred: number; active_referred: number; verified_trades: number }
export interface PaperCopyReferralSummary { rate: number; received_usd: number; paid_current_round_usd: number; history: { created_at: string; commission_usd: number }[] }

export async function getPaperCopyReferralSummary(): Promise<PaperCopyReferralSummary> {
  const { data, error } = await (supabase as any).rpc('get_my_paper_copy_referral_summary');
  if (error) throw error;
  if (!data || !Array.isArray(data.history)) throw new Error('Resumo de comissões indisponível');
  return data as PaperCopyReferralSummary;
}

export async function getPaperReferralCode(): Promise<string> {
  const { data, error } = await (supabase as any).rpc('get_my_paper_referral_code');
  if (error) throw error;
  if (typeof data !== 'string' || !/^[A-F0-9]{12}$/.test(data)) throw new Error('Código indisponível.');
  return data;
}

export async function getPaperReferralStats(): Promise<PaperReferralStats> {
  const { data, error } = await (supabase as any).rpc('get_my_paper_referral_stats');
  if (error) throw error;
  const row = data?.[0];
  if (!row) throw new Error('Estatísticas indisponíveis.');
  return { total_referred: Number(row.total_referred), active_referred: Number(row.active_referred), verified_trades: Number(row.verified_trades) };
}

export async function applyPaperReferral(code: string): Promise<PaperReferralResult> {
  const { data, error } = await (supabase as any).rpc('apply_paper_referral', { p_code: code });
  if (error) throw error;
  if (!['applied', 'already_linked', 'invalid', 'ineligible', 'own_code'].includes(data)) throw new Error('Resposta de indicação inválida.');
  return data as PaperReferralResult;
}
