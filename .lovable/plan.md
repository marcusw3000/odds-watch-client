

## Problem

The Lovable preview environment uses a fetch proxy that causes Supabase requests to **hang indefinitely** (never resolve, never error). This means:

1. `supabase.auth.getSession()` hangs → `loading` stays `true` forever in AuthProvider
2. `supabase.from('markets').select('*')` hangs → `isLoadingMarkets` stays `true` → skeletons forever
3. The chat button never appears because the entire component tree is stuck

The published site works fine because it doesn't use the proxy. The code already has fallback to mock data on **errors**, but hanging requests never trigger the error path.

## Solution: Add timeouts so hanging requests fail gracefully

### 1. Add auth initialization timeout (useAuthContext.tsx)

Add a 5-second timeout to `checkSession`. If `getSession()` doesn't resolve in time, set `loading = false` with `user = null`. This unblocks the entire app.

```typescript
// Inside checkSession:
const timeoutId = setTimeout(() => {
  if (mounted && loading) {
    console.warn('[Auth] Session check timed out');
    setLoading(false);
  }
}, 5000);
```

### 2. Add timeout wrapper to MarketDataProvider.getEvents() (MarketDataProvider.ts)

Wrap the Supabase query in a `Promise.race` with a 8-second timeout. If it hangs, fall back to `mockMarkets` (which already exist in the code).

```typescript
async getEvents(): Promise<MarketEvent[]> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Request timeout')), 8000)
  );

  try {
    const { data, error } = await Promise.race([
      supabase.from('markets').select('*').order('created_at', { ascending: false }),
      timeout,
    ]);
    // ... existing logic
  } catch (err) {
    console.error('Error fetching markets:', err);
    return mockMarkets; // Already exists as fallback
  }
}
```

### 3. No other changes needed

- `ChatErrorBoundary` and `defaultAuthState` guards are already in place
- `useGlobalChat` already has reconnection logic
- The chat button will render once the Layout component unblocks

## Files Changed

- `src/hooks/useAuthContext.tsx` — Add 5s timeout to session check
- `src/services/MarketDataProvider.ts` — Add 8s timeout to getEvents()

## Expected Result

In the Lovable preview:
- After ~5s, auth resolves (no user) and the page unblocks
- After ~8s, markets fall back to mock data and show real cards instead of skeletons
- Chat button appears
- On the published site: no change in behavior (requests complete well within timeouts)

