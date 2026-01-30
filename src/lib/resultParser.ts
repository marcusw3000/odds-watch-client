import { MarketOption } from '@/types/market';

// Placement multipliers for multi-winner markets
export const PLACEMENT_MULTIPLIERS = [1.0, 0.6, 0.3, 0.15, 0.1];

export const PLACEMENT_LABELS = ['🥇', '🥈', '🥉', '4º', '5º'];

export const PLACEMENT_LABELS_FULL = ['1º Lugar', '2º Lugar', '3º Lugar', '4º Lugar', '5º Lugar'];

/**
 * Parse result from database - can be single value or JSON array
 */
export function parseResult(result: string | null | undefined): string[] {
  if (!result) return [];
  
  try {
    const parsed = JSON.parse(result);
    return Array.isArray(parsed) ? parsed : [result];
  } catch {
    // Single winner (binary market "YES"/"NO" or single option UUID)
    return [result];
  }
}

/**
 * Check if an option is a winner at any placement
 */
export function isOptionWinner(optionId: string, result: string | null | undefined): boolean {
  const winners = parseResult(result);
  return winners.includes(optionId);
}

/**
 * Get the placement (1-indexed) of an option in the winners array
 * Returns null if not a winner
 */
export function getOptionPlacement(optionId: string, result: string | null | undefined): number | null {
  const winners = parseResult(result);
  const index = winners.indexOf(optionId);
  return index >= 0 ? index + 1 : null;
}

/**
 * Get placement badge for an option
 */
export function getPlacementBadge(optionId: string, result: string | null | undefined): string | null {
  const placement = getOptionPlacement(optionId, result);
  if (placement === null) return null;
  return PLACEMENT_LABELS[placement - 1] || `${placement}º`;
}

/**
 * Get payout multiplier for a placement
 */
export function getPlacementMultiplier(placement: number): number {
  return PLACEMENT_MULTIPLIERS[placement - 1] ?? 0.1;
}

/**
 * Format result for display - returns winning option labels
 */
export function formatResultDisplay(
  result: string | null | undefined,
  options?: MarketOption[]
): string {
  const winners = parseResult(result);
  
  if (winners.length === 0) return 'Encerrado';
  
  // Binary market
  if (winners[0] === 'YES') return 'Resultado: SIM';
  if (winners[0] === 'NO') return 'Resultado: NÃO';
  
  // Multi-option market
  if (options && options.length > 0) {
    const winnerLabels = winners
      .map((id, index) => {
        const option = options.find(opt => opt.id === id);
        const badge = PLACEMENT_LABELS[index] || `${index + 1}º`;
        return option ? `${badge} ${option.label}` : null;
      })
      .filter(Boolean);
    
    if (winnerLabels.length === 1) {
      return `Vencedor: ${winnerLabels[0]}`;
    }
    
    return winnerLabels.join(' • ');
  }
  
  return 'Encerrado';
}

/**
 * Serialize winners array for database storage
 */
export function serializeWinners(winners: string[]): string {
  if (winners.length === 1) {
    return winners[0];
  }
  return JSON.stringify(winners);
}
