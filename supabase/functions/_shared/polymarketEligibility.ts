export interface PolymarketCapabilities {
  canView: boolean;
  canOpenPosition: boolean;
  canClosePosition: boolean;
  canOnRamp: boolean;
  canOffRamp: boolean;
  reasons: string[];
  policyVersion: string;
  checkedAt: string;
}

/**
 * This is intentionally fail-closed. A user's location cannot be established
 * from an Edge Function's own outbound request, so no location-derived trading
 * permission is granted until a trusted request-IP integration is deployed.
 */
export function getReadOnlyPolymarketCapabilities(): PolymarketCapabilities {
  return {
    canView: true,
    canOpenPosition: false,
    canClosePosition: false,
    canOnRamp: false,
    canOffRamp: false,
    reasons: ["trading_disabled", "eligibility_not_verified"],
    policyVersion: "2026-11-03-read-only",
    checkedAt: new Date().toISOString(),
  };
}

export function isPolymarketTradingAllowed(capabilities: PolymarketCapabilities) {
  return capabilities.canOpenPosition || capabilities.canClosePosition;
}
