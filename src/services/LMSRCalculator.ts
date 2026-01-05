/**
 * LMSR (Logarithmic Market Scoring Rule) Calculator
 * 
 * Implements Hanson's market maker for prediction markets.
 * Prices are automatically determined by supply/demand.
 */

export interface LMSRState {
  qYes: number;  // Total YES shares outstanding
  qNo: number;   // Total NO shares outstanding
  b: number;     // Liquidity parameter (higher = more stable prices)
}

export interface TradeQuote {
  cost: number;           // Total cost in R$
  avgPrice: number;       // Average price per share (centavos)
  priceImpact: number;    // Percentage change in price
  newYesPrice: number;    // New YES price after trade (centavos)
  newNoPrice: number;     // New NO price after trade (centavos)
}

/**
 * Cost function: C(q) = b * ln(e^(qYes/b) + e^(qNo/b))
 */
function costFunction(qYes: number, qNo: number, b: number): number {
  // Use log-sum-exp trick to avoid overflow
  const max = Math.max(qYes / b, qNo / b);
  return b * (max + Math.log(Math.exp(qYes / b - max) + Math.exp(qNo / b - max)));
}

/**
 * Get current YES price (marginal cost) in centavos (0-100)
 */
export function getPriceYes(state: LMSRState): number {
  const { qYes, qNo, b } = state;
  const expYes = Math.exp(qYes / b);
  const expNo = Math.exp(qNo / b);
  const price = (expYes / (expYes + expNo)) * 100;
  return Math.max(1, Math.min(99, Math.round(price)));
}

/**
 * Get current NO price (marginal cost) in centavos (0-100)
 */
export function getPriceNo(state: LMSRState): number {
  return 100 - getPriceYes(state);
}

/**
 * Calculate the cost to buy a given number of shares
 */
export function getCostToBuy(
  state: LMSRState,
  outcome: 'YES' | 'NO',
  shares: number
): number {
  const { qYes, qNo, b } = state;
  
  const currentCost = costFunction(qYes, qNo, b);
  
  let newCost: number;
  if (outcome === 'YES') {
    newCost = costFunction(qYes + shares, qNo, b);
  } else {
    newCost = costFunction(qYes, qNo + shares, b);
  }
  
  return newCost - currentCost;
}

/**
 * Calculate the value received when selling shares
 */
export function getValueToSell(
  state: LMSRState,
  outcome: 'YES' | 'NO',
  shares: number
): number {
  const { qYes, qNo, b } = state;
  
  const currentCost = costFunction(qYes, qNo, b);
  
  let newCost: number;
  if (outcome === 'YES') {
    newCost = costFunction(qYes - shares, qNo, b);
  } else {
    newCost = costFunction(qYes, qNo - shares, b);
  }
  
  return currentCost - newCost;
}

/**
 * Execute a buy trade and return new state
 */
export function executeBuy(
  state: LMSRState,
  outcome: 'YES' | 'NO',
  shares: number
): LMSRState {
  if (outcome === 'YES') {
    return { ...state, qYes: state.qYes + shares };
  } else {
    return { ...state, qNo: state.qNo + shares };
  }
}

/**
 * Execute a sell trade and return new state
 */
export function executeSell(
  state: LMSRState,
  outcome: 'YES' | 'NO',
  shares: number
): LMSRState {
  if (outcome === 'YES') {
    return { ...state, qYes: Math.max(0, state.qYes - shares) };
  } else {
    return { ...state, qNo: Math.max(0, state.qNo - shares) };
  }
}

/**
 * Get a quote for buying shares (preview before trade)
 */
export function getQuote(
  state: LMSRState,
  outcome: 'YES' | 'NO',
  shares: number
): TradeQuote {
  const currentPrice = outcome === 'YES' ? getPriceYes(state) : getPriceNo(state);
  const cost = getCostToBuy(state, outcome, shares);
  const avgPrice = (cost / shares) * 100; // Convert to centavos
  
  const newState = executeBuy(state, outcome, shares);
  const newYesPrice = getPriceYes(newState);
  const newNoPrice = getPriceNo(newState);
  
  const newPrice = outcome === 'YES' ? newYesPrice : newNoPrice;
  const priceImpact = ((newPrice - currentPrice) / currentPrice) * 100;
  
  return {
    cost,
    avgPrice: Math.round(avgPrice),
    priceImpact,
    newYesPrice,
    newNoPrice,
  };
}

/**
 * Get a quote for selling shares
 */
export function getSellQuote(
  state: LMSRState,
  outcome: 'YES' | 'NO',
  shares: number
): TradeQuote {
  const currentPrice = outcome === 'YES' ? getPriceYes(state) : getPriceNo(state);
  const value = getValueToSell(state, outcome, shares);
  const avgPrice = (value / shares) * 100;
  
  const newState = executeSell(state, outcome, shares);
  const newYesPrice = getPriceYes(newState);
  const newNoPrice = getPriceNo(newState);
  
  const newPrice = outcome === 'YES' ? newYesPrice : newNoPrice;
  const priceImpact = ((newPrice - currentPrice) / currentPrice) * 100;
  
  return {
    cost: value, // For sells, "cost" is negative (you receive money)
    avgPrice: Math.round(avgPrice),
    priceImpact,
    newYesPrice,
    newNoPrice,
  };
}

/**
 * Initialize LMSR state with target initial prices
 * @param initialYesProb Target initial YES probability (0-100)
 * @param liquidity Liquidity parameter (higher = more stable)
 */
export function initializeLMSR(initialYesProb: number, liquidity: number): LMSRState {
  // To get desired initial probabilities:
  // P(YES) = e^(qYes/b) / (e^(qYes/b) + e^(qNo/b))
  // If we set qNo = 0, then:
  // P(YES) = e^(qYes/b) / (e^(qYes/b) + 1)
  // Solving: qYes = b * ln(P(YES) / (1 - P(YES)))
  
  const prob = initialYesProb / 100;
  const clampedProb = Math.max(0.01, Math.min(0.99, prob));
  
  const qYes = liquidity * Math.log(clampedProb / (1 - clampedProb));
  
  return {
    qYes,
    qNo: 0,
    b: liquidity,
  };
}
