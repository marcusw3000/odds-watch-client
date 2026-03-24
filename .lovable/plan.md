

## Analysis

The GlobalChat floating button disappears on F5 refresh. After investigation:

1. **GlobalChat renders inside Layout** — it's always rendered, with no conditional logic that would hide it
2. **The floating button** uses `fixed bottom-20 right-4 z-40` positioning and only hides when `isOpen` is true (via `isOpen && 'hidden'`)
3. **useGlobalChat** creates a Supabase Realtime channel on mount — if this throws during initialization (e.g., before Supabase client is fully ready on refresh), the component crashes silently
4. **No ErrorBoundary** wraps GlobalChat specifically, so an error would propagate to the top-level ErrorBoundary and crash the entire page — BUT the page IS rendering (skeletons visible), so the error must be non-fatal or the component just fails to render
5. **Console shows 22+ duplicate SIGNED_IN events** — each `useAuth()` hook instance creates its own `onAuthStateChange` listener, causing excessive re-renders during session recovery on refresh

## Root Cause

Most likely: the Supabase channel subscription in `useGlobalChat` encounters a transient error during page refresh (when auth session is being restored), causing the component to fail silently. The component has no error recovery mechanism.

## Plan

### 1. Wrap GlobalChat in a dedicated ErrorBoundary (Layout.tsx)
Add a small ErrorBoundary around GlobalChat that renders nothing on error (instead of crashing the page), with auto-retry after a short delay.

### 2. Add defensive error handling in useGlobalChat (useGlobalChat.ts)
- Wrap channel subscription in try/catch
- Add error state and reconnection logic if channel fails
- Handle the case where the component mounts before auth is fully resolved

### 3. Fix duplicate auth listeners (useAuth.ts)
The 22+ SIGNED_IN events indicate every component calling `useAuth()` creates its own listener. Convert `useAuth` to use a shared singleton pattern (React context or module-level subscription) so only one listener exists. This reduces re-renders on refresh and prevents race conditions.

## Technical Details

**File changes:**

- `src/hooks/useAuth.ts` — Create an AuthContext provider pattern so one listener is shared across all consumers
- `src/App.tsx` — Wrap app in AuthProvider
- `src/hooks/useGlobalChat.ts` — Add try/catch around channel creation, add reconnect logic
- `src/components/layout/Layout.tsx` — Wrap GlobalChat in a silent ErrorBoundary fallback

