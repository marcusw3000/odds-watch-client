/**
 * LMSR (Logarithmic Market Scoring Rule) Calculator for Multiple Options
 * 
 * Implements Hanson's market maker for prediction markets with N mutually exclusive options.
 * Sum of all option prices always equals 1 (100%).
 * 
 * Kalshi-style: Each option is an independent contract where:
 * - Buying "YES" on an option means you think it will happen
 * - All YES prices sum to ~$1.00
 * - Only one option can win
 */

export interface MultiLMSRState {
  shares: number[];  // Array of shares outstanding per option
  b: number;         // Liquidity parameter (higher = more stable prices)
}

export interface MultiOptionQuote {
  cost: number;           // Total cost in R$
  avgPrice: number;       // Average price per share (0-100 centavos)
  priceImpact: number;    // Percentage change in price for this option
  newPrices: number[];    // New prices for all options after trade (0-100)
}

/**
 * Cost function for N options: C(q) = b * ln(Σ e^(qi/b))
 * Uses log-sum-exp trick to avoid numerical overflow
 */
function costFunction(shares: number[], b: number): number {
  if (shares.length === 0) return 0;
  
  const scaledShares = shares.map(q => q / b);
  const maxVal = Math.max(...scaledShares);
  
  // Log-sum-exp trick: log(Σe^xi) = max + log(Σe^(xi - max))
  const sumExp = scaledShares.reduce((sum, x) => sum + Math.exp(x - maxVal), 0);
  
  return b * (maxVal + Math.log(sumExp));
}

/**
 * Get current prices for all options (sum to 100)
 * Price of option i = e^(qi/b) / Σ e^(qj/b)
 */
export function getPrices(state: MultiLMSRState): number[] {
  const { shares, b } = state;
  
  if (shares.length === 0) return [];
  if (shares.length === 1) return [100];
  
  const scaledShares = shares.map(q => q / b);
  const maxVal = Math.max(...scaledShares);
  
  // Calculate exp values with numerical stability
  const expValues = scaledShares.map(x => Math.exp(x - maxVal));
  const sumExp = expValues.reduce((sum, x) => sum + x, 0);
  
  // Prices as percentages (0-100)
  const prices = expValues.map(exp => (exp / sumExp) * 100);
  
  // Ensure prices are within bounds and round
  return prices.map(p => Math.max(1, Math.min(99, Math.round(p))));
}

/**
 * Get price for a single option (0-100)
 */
export function getPrice(state: MultiLMSRState, optionIndex: number): number {
  const prices = getPrices(state);
  return prices[optionIndex] ?? 50;
}

/**
 * Calculate the cost to buy shares of a specific option
 */
export function getCostToBuy(
  state: MultiLMSRState,
  optionIndex: number,
  sharesToBuy: number
): number {
  const { shares, b } = state;
  
  const currentCost = costFunction(shares, b);
  
  const newShares = [...shares];
  newShares[optionIndex] += sharesToBuy;
  
  const newCost = costFunction(newShares, b);
  
  return newCost - currentCost;
}

/**
 * Calculate the value received when selling shares of a specific option
 */
export function getValueToSell(
  state: MultiLMSRState,
  optionIndex: number,
  sharesToSell: number
): number {
  const { shares, b } = state;
  
  const currentCost = costFunction(shares, b);
  
  const newShares = [...shares];
  newShares[optionIndex] = Math.max(0, newShares[optionIndex] - sharesToSell);
  
  const newCost = costFunction(newShares, b);
  
  return currentCost - newCost;
}

/**
 * Execute a buy trade and return new state
 */
export function executeBuy(
  state: MultiLMSRState,
  optionIndex: number,
  sharesToBuy: number
): MultiLMSRState {
  const newShares = [...state.shares];
  newShares[optionIndex] += sharesToBuy;
  
  return { ...state, shares: newShares };
}

/**
 * Execute a sell trade and return new state
 */
export function executeSell(
  state: MultiLMSRState,
  optionIndex: number,
  sharesToSell: number
): MultiLMSRState {
  const newShares = [...state.shares];
  newShares[optionIndex] = Math.max(0, newShares[optionIndex] - sharesToSell);
  
  return { ...state, shares: newShares };
}

/**
 * Get a quote for buying shares of an option
 */
export function getQuote(
  state: MultiLMSRState,
  optionIndex: number,
  sharesToBuy: number
): MultiOptionQuote {
  const currentPrices = getPrices(state);
  const currentPrice = currentPrices[optionIndex];
  
  const cost = getCostToBuy(state, optionIndex, sharesToBuy);
  const avgPrice = (cost / sharesToBuy) * 100;
  
  const newState = executeBuy(state, optionIndex, sharesToBuy);
  const newPrices = getPrices(newState);
  
  const newPrice = newPrices[optionIndex];
  const priceImpact = ((newPrice - currentPrice) / currentPrice) * 100;
  
  return {
    cost,
    avgPrice: Math.round(avgPrice),
    priceImpact,
    newPrices,
  };
}

/**
 * Get a quote for selling shares of an option
 */
export function getSellQuote(
  state: MultiLMSRState,
  optionIndex: number,
  sharesToSell: number
): MultiOptionQuote {
  const currentPrices = getPrices(state);
  const currentPrice = currentPrices[optionIndex];
  
  const value = getValueToSell(state, optionIndex, sharesToSell);
  const avgPrice = (value / sharesToSell) * 100;
  
  const newState = executeSell(state, optionIndex, sharesToSell);
  const newPrices = getPrices(newState);
  
  const newPrice = newPrices[optionIndex];
  const priceImpact = ((newPrice - currentPrice) / currentPrice) * 100;
  
  return {
    cost: value,
    avgPrice: Math.round(avgPrice),
    priceImpact,
    newPrices,
  };
}

/**
 * Initialize LMSR state with target initial probabilities
 * @param initialProbs Array of initial probabilities (must sum to 100)
 * @param liquidity Liquidity parameter (higher = more stable prices)
 */
export function initializeMultiLMSR(
  initialProbs: number[],
  liquidity: number
): MultiLMSRState {
  if (initialProbs.length < 2) {
    throw new Error('At least 2 options required');
  }
  
  // Normalize probabilities to sum to 100
  const sum = initialProbs.reduce((a, b) => a + b, 0);
  const normalizedProbs = initialProbs.map(p => (p / sum) * 100);
  
  // Convert probabilities to shares
  // For LMSR: P(i) = e^(qi/b) / Σ e^(qj/b)
  // If we set q1 = 0 as reference, then:
  // qi = b * ln(P(i) / P(1))
  
  const refProb = normalizedProbs[0] / 100;
  const shares = normalizedProbs.map((prob, i) => {
    if (i === 0) return 0;
    const p = prob / 100;
    // Clamp to avoid log(0)
    const clampedP = Math.max(0.01, Math.min(0.99, p));
    const clampedRef = Math.max(0.01, Math.min(0.99, refProb));
    return liquidity * Math.log(clampedP / clampedRef);
  });
  
  return {
    shares,
    b: liquidity,
  };
}

/**
 * Add a new option to an existing market
 * Sets the new option at a very low probability
 */
export function addOption(
  state: MultiLMSRState,
  initialProbability: number = 5
): MultiLMSRState {
  const currentPrices = getPrices(state);
  
  // Calculate what share value gives approximately initialProbability
  // Given the current state
  const { b } = state;
  
  // Simple approach: use log ratio from first option
  const refProb = currentPrices[0] / 100;
  const newProb = Math.max(0.01, Math.min(0.99, initialProbability / 100));
  const clampedRef = Math.max(0.01, Math.min(0.99, refProb));
  
  const newShareValue = state.shares[0] + b * Math.log(newProb / clampedRef);
  
  return {
    ...state,
    shares: [...state.shares, newShareValue],
  };
}

/**
 * Validate that prices sum to approximately 100%
 */
export function validatePriceSum(state: MultiLMSRState): boolean {
  const prices = getPrices(state);
  const sum = prices.reduce((a, b) => a + b, 0);
  // Allow 2% tolerance due to rounding
  return sum >= 98 && sum <= 102;
}
