import { useState, useEffect, useMemo } from 'react';
import { MarketEvent, MarketStatus } from '@/types/market';

export interface MarketStatusInfo {
  status: MarketStatus;
  canTrade: boolean;
  timeToHalt: number | null;       // seconds until halt
  timeToEvent: number | null;      // seconds until event
  contestTimeRemaining: number | null; // seconds until contest period ends
  isUrgent: boolean;               // Less than 5 min to halt
  statusLabel: string;
  statusDescription: string;
}

function calculateStatus(event: MarketEvent): MarketStatus {
  const now = new Date();
  
  // Already settled
  if (event.settledAt) return 'SETTLED';
  
  // In contestation period
  if (event.contestEndAt && event.resultSubmittedAt && now < event.contestEndAt) {
    return 'CONTESTED';
  }
  
  // Result submitted but no contest period yet (pending)
  if (event.resultSubmittedAt && !event.settledAt) {
    return 'PENDING';
  }
  
  // Event happened, waiting for result
  if (now >= event.eventAt && !event.result) {
    return 'PENDING';
  }
  
  // Trading halted
  if (now >= event.tradingHaltAt && now < event.eventAt) {
    return 'HALTED';
  }
  
  // Still open for trading
  return 'OPEN';
}

function getStatusLabel(status: MarketStatus): string {
  switch (status) {
    case 'OPEN': return 'Aberto';
    case 'HALTED': return 'Pausado';
    case 'PENDING': return 'Aguardando';
    case 'CONTESTED': return 'Em contestação';
    case 'SETTLED': return 'Liquidado';
    default: return status;
  }
}

function getStatusDescription(status: MarketStatus, event: MarketEvent): string {
  switch (status) {
    case 'OPEN': return 'Negociações abertas';
    case 'HALTED': return 'Trading pausado até o evento';
    case 'PENDING': return 'Aguardando resultado oficial';
    case 'CONTESTED': return 'Período de contestação ativo';
    case 'SETTLED': return event.result 
      ? `Resultado: ${event.result === 'YES' ? 'SIM' : 'NÃO'}` 
      : 'Mercado finalizado';
    default: return '';
  }
}

export function useMarketStatus(event: MarketEvent | null): MarketStatusInfo {
  const [now, setNow] = useState(new Date());

  // Update every second for countdowns
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return useMemo(() => {
    if (!event) {
      return {
        status: 'OPEN' as MarketStatus,
        canTrade: false,
        timeToHalt: null,
        timeToEvent: null,
        contestTimeRemaining: null,
        isUrgent: false,
        statusLabel: 'Carregando',
        statusDescription: '',
      };
    }

    const status = calculateStatus(event);
    const canTrade = status === 'OPEN';

    const timeToHalt = event.tradingHaltAt 
      ? Math.max(0, Math.floor((event.tradingHaltAt.getTime() - now.getTime()) / 1000))
      : null;
    
    const timeToEvent = event.eventAt 
      ? Math.max(0, Math.floor((event.eventAt.getTime() - now.getTime()) / 1000))
      : null;
    
    const contestTimeRemaining = event.contestEndAt 
      ? Math.max(0, Math.floor((event.contestEndAt.getTime() - now.getTime()) / 1000))
      : null;

    // Urgent if less than 5 minutes to halt
    const isUrgent = timeToHalt !== null && timeToHalt > 0 && timeToHalt < 300;

    return {
      status,
      canTrade,
      timeToHalt,
      timeToEvent,
      contestTimeRemaining,
      isUrgent,
      statusLabel: getStatusLabel(status),
      statusDescription: getStatusDescription(status, event),
    };
  }, [event, now]);
}

// Utility function to format seconds as countdown
export function formatCountdown(seconds: number | null): string {
  if (seconds === null || seconds <= 0) return '00:00';
  
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (days > 0) {
    return `${days}d ${hours.toString().padStart(2, '0')}h`;
  }
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Get color classes for status
export function getStatusColor(status: MarketStatus): {
  bg: string;
  text: string;
  border: string;
} {
  switch (status) {
    case 'OPEN':
      return { bg: 'bg-success/10', text: 'text-success', border: 'border-success/30' };
    case 'HALTED':
      return { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/30' };
    case 'PENDING':
      return { bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/30' };
    case 'CONTESTED':
      return { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/30' };
    case 'SETTLED':
      return { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border' };
    default:
      return { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border' };
  }
}