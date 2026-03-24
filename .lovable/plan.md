

## Problem

The screenshot shows the app stuck on skeleton cards with no GlobalChat button visible. The `ChatErrorBoundary` currently renders **nothing** (`null`) when GlobalChat crashes, making the chat button completely invisible. When the error keeps recurring on retry, the button never appears.

The most likely crash cause: during page refresh, a Vite module resolution conflict between the renamed `useAuth.ts` → `useAuth.tsx` causes the `AuthContext` read by `useGlobalChat` to be `null`, triggering `useAuth()` to throw.

## Plan

### 1. ChatErrorBoundary renders a fallback button instead of nothing (Layout.tsx)

Instead of rendering `null` on error, render a disabled chat button so the user always sees it. Add a max retry counter (3 attempts) to avoid infinite error loops.

### 2. Guard useAuth against missing context (useAuth.tsx)

Instead of throwing when context is null, return a safe default state (`user: null, loading: true`). This prevents any component from crashing if the AuthProvider hasn't mounted yet or if there's a module resolution mismatch.

**Current:**
```tsx
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
```

**Proposed:**
```tsx
const defaultAuthState: AuthState = {
  user: null, session: null, isAdmin: false, loading: true,
  signIn: async () => ({ error: new Error('Auth not ready') }),
  signUp: async () => ({ error: new Error('Auth not ready') }),
  signOut: async () => ({ error: new Error('Auth not ready') }),
};

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  return ctx ?? defaultAuthState;
}
```

This is the minimal change that prevents cascading crashes throughout the app.

## Files Changed

- `src/hooks/useAuth.tsx` — Return safe default instead of throwing
- `src/components/layout/Layout.tsx` — ErrorBoundary renders fallback chat button with retry limit

