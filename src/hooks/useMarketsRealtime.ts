import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MarketEvent, DbMarket, MarketStatus, SettlementType, SettlementConfig } from '@/types/market';
import { MarketDataProvider } from '@/services/MarketDataProvider';
import { getPriceYes, getPriceNo, LMSRState } from '@/services/LMSRCalculator';

// Transform DB payload to frontend MarketEvent
function transformPayloadToEvent(payload: Record<string, unknown>): MarketEvent {
  const lmsr: LMSRState = {
    b: payload.lmsr_b as number,
    qYes: payload.yes_shares as number,
    qNo: payload.no_shares as number,
  };

  const yesPrice = getPriceYes(lmsr);
  const noPrice = getPriceNo(lmsr);

  return {
    id: payload.id as string,
    title: payload.title as string,
    category: payload.category as string,
    description: (payload.description as string) || undefined,
    imageUrl: (payload.image_url as string) || undefined,
    imageZoom: (payload.image_zoom as number) ?? 1,
    imagePosition: {
      x: (payload.image_position_x as number) ?? 50,
      y: (payload.image_position_y as number) ?? 50,
    },
    status: payload.status as MarketStatus,
    settlementType: payload.settlement_type as SettlementType,
    settlementConfig: payload.settlement_config as SettlementConfig | undefined,
    expiryAt: payload.settlement_date ? new Date(payload.settlement_date as string) : new Date(),
    tradingHaltAt: payload.close_date ? new Date(payload.close_date as string) : new Date(),
    eventAt: payload.settlement_date ? new Date(payload.settlement_date as string) : new Date(),
    limits: { minBuy: 10, maxBuy: 5000 },
    createdAt: new Date(payload.created_at as string),
    lastUpdatedAt: new Date(payload.updated_at as string),
    volume: payload.total_volume as number,
    outcomes: {
      YES: { price: yesPrice, probability: yesPrice },
      NO: { price: noPrice, probability: noPrice },
    },
    lmsr,
    result: (payload.result as string) || undefined,
    resultSource: (payload.result_source as string) || undefined,
    haltReason: (payload.halt_reason as string) || undefined,
    contractUnitCost: (payload.contract_unit_cost as number) ?? 100,
    marketType: ((payload.market_type as string) as 'BINARY' | 'MULTIPLE') || 'BINARY',
    optionsExclusive: (payload.options_exclusive as boolean) ?? true,
    tags: (payload.tags as string[]) || undefined,
  };
}

export function useMarketsRealtime() {
  const [events, setEvents] = useState<MarketEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchEvents = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      const data = await MarketDataProvider.getEvents();
      setEvents(data);
    } catch (error) {
      console.error('Error fetching markets:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial load
    fetchEvents();

    // Subscribe to realtime changes on markets table
    const channel = supabase
      .channel('markets-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'markets',
        },
        (payload) => {
          // Update only the market that changed
          const updatedEvent = transformPayloadToEvent(payload.new as Record<string, unknown>);
          setEvents((prev) =>
            prev.map((e) => (e.id === updatedEvent.id ? updatedEvent : e))
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'markets',
        },
        (payload) => {
          // Add the new market
          const newEvent = transformPayloadToEvent(payload.new as Record<string, unknown>);
          setEvents((prev) => [newEvent, ...prev]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'markets',
        },
        (payload) => {
          // Remove deleted market
          const deletedId = (payload.old as Record<string, unknown>).id as string;
          setEvents((prev) => prev.filter((e) => e.id !== deletedId));
        }
      )
      .subscribe((status) => {
        console.log('Markets realtime subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchEvents]);

  return { events, isLoading, refetch: () => fetchEvents(false) };
}
