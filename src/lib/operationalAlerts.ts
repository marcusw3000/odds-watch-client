import type { AdminOperationalHealth } from '@/hooks/useSystemHealth';

/** Warnings shown in the admin panel; they do not send notifications. */
export function getOperationalAlerts(data: AdminOperationalHealth, now: number): string[] {
  const oldestCheck = data.copy_oldest_check ? Date.parse(data.copy_oldest_check) : NaN;
  const alerts: string[] = [];
  if (data.catalog_error) alerts.push('A sincronização do catálogo registrou um erro. Consulte os logs da função.');
  if (data.copy_active > 0 && Number.isFinite(oldestCheck) && now - oldestCheck > 15 * 60_000) alerts.push('Há estratégias de Copy Trading sem verificação há mais de 15 minutos.');
  if (data.copy_active > 0 && !Number.isFinite(oldestCheck)) alerts.push('O horário de verificação das estratégias de Copy Trading está indisponível.');
  if (data.jobs.some(job => job.active && job.last_status === 'failed')) alerts.push('Um agendamento registrou falha na última execução.');
  if (data.snapshot_failed_attempts > 0) alerts.push('Há tentativas de coleta do portfólio posteriores ao último sucesso.');
  return alerts;
}
