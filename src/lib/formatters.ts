/**
 * Centralized formatting utilities for the application.
 * Replaces duplicate formatting functions across components.
 */

/**
 * Format a number as Brazilian currency (BRL)
 */
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

/**
 * Format currency with explicit +/- sign for profit/loss display
 */
export const formatCurrencyWithSign = (value: number): string => {
  const prefix = value >= 0 ? '+' : '';
  return `${prefix}R$${Math.abs(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

/**
 * Format volume in compact notation (1k, 1.5M, etc.)
 */
export const formatVolume = (volume?: number): string => {
  if (!volume) return 'R$0';
  if (volume >= 1000000) return `R$${(volume / 1000000).toFixed(1)}M`;
  if (volume >= 1000) return `R$${(volume / 1000).toFixed(0)}k`;
  return `R$${volume.toLocaleString('pt-BR')}`;
};

/**
 * Format percentage with sign prefix
 */
export const formatPercent = (value: number): string => {
  const prefix = value >= 0 ? '+' : '';
  return `${prefix}${value.toFixed(1)}%`;
};

/**
 * Mask email for privacy (LGPD compliance)
 */
export const maskEmail = (email: string | null): string => {
  if (!email) return 'N/A';
  const parts = email.split('@');
  if (parts.length !== 2) return '***@***';
  const [local, domain] = parts;
  const maskedLocal = local.length > 3 ? `${local.substring(0, 3)}***` : '***';
  return `${maskedLocal}@${domain.substring(0, 3)}***`;
};

/**
 * Mask PIX key based on type for privacy
 */
export const maskPixKey = (key: string, type: string): string => {
  if (!key) return '***';
  switch (type) {
    case 'CPF':
      return key.length >= 11 ? `***.${key.substring(3, 6)}.***-**` : '***';
    case 'CNPJ':
      return key.length >= 14 ? `**.${key.substring(2, 5)}.***-****-**` : '***';
    case 'EMAIL':
      return maskEmail(key);
    case 'PHONE':
      return `(**) *****-${key.slice(-4)}`;
    default:
      return key.length > 8 ? `${key.substring(0, 8)}...` : '***';
  }
};

/**
 * Format date relative to now (agora, 5min, 2h, 3d, etc.)
 */
export const formatRelativeDate = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'agora';
  if (diffMins < 60) return `${diffMins}min`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return dateObj.toLocaleDateString('pt-BR');
};

/**
 * Format date and time in Brazilian format
 */
export const formatDateTime = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};
