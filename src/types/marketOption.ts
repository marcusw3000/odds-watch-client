/**
 * Types for multi-option markets (Kalshi-style)
 */

export type MarketType = 'BINARY' | 'MULTIPLE';

export interface MarketOptionData {
  id?: string;
  marketId?: string;
  label: string;
  description?: string;
  imageUrl?: string;
  shares: number;
  currentPrice: number;
  displayOrder: number;
}

export interface CreateMarketOptionInput {
  label: string;
  description?: string;
  imageUrl?: string;
  probability: number;
  displayOrder: number;
}

export interface UpdateMarketOptionInput {
  id: string;
  label?: string;
  description?: string;
  imageUrl?: string;
  probability?: number;
  displayOrder?: number;
}

// For the admin form
export interface MarketOptionFormData {
  id?: string;
  label: string;
  description?: string;
  imageUrl?: string;
  probability: number;
  displayOrder: number;
}
