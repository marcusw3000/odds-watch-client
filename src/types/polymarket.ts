export type PolymarketProtocolVersion = "v1" | "v2" | "unknown";

export interface PolymarketOutcome {
  label: string;
  /** Decimal probability as delivered by Polymarket, for example "0.52". */
  price: string | null;
  /** Token IDs can exceed JavaScript safe integers. */
  tokenId: string | null;
  positionId: string | null;
}

export interface PolymarketMarket {
  source: "polymarket";
  id: string;
  eventId?: string | null;
  slug: string | null;
  question: string;
  description: string | null;
  imageUrl: string | null;
  conditionId: string | null;
  version: PolymarketProtocolVersion;
  outcomes: PolymarketOutcome[];
  volumeUsd: string | null;
  liquidityUsd: string | null;
  spread: string | null;
  endDate: string | null;
  sourceUpdatedAt: string | null;
  acceptingOrders: boolean;
  restricted: boolean;
  category?: string | null;
  status?: "open" | "closed";
  url: string | null;
}

export interface PolymarketMarketsPage {
  markets: PolymarketMarket[];
  nextCursor: string | null;
  fetchedAt: string;
  source: "polymarket";
  searchQuery: string | null;
  totalMatches: number | null;
  stale?: boolean;
}

export interface PolymarketPricePoint {
  timestamp: string;
  price: string;
  resolutionSeconds: number | null;
}

export interface PolymarketOrderBookLevel {
  price: string;
  size: string;
}

export interface PolymarketMarketAnalytics {
  outcomeLabel: string;
  assetId: string;
  fetchedAt: string;
  history: PolymarketPricePoint[];
  bids: PolymarketOrderBookLevel[];
  asks: PolymarketOrderBookLevel[];
  lastTradePrice: string | null;
  tickSize: string | null;
}
