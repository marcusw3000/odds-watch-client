

## Problem

The file `useAuth.ts` was renamed to `useAuth.tsx` in the previous edit. Vite's dev server has a stale module cache entry for the old `.ts` path, causing a 404 when it tries to reload the module. This breaks the entire `AuthProvider`, which means:
1. Auth state never resolves (stays `loading: true`)
2. The page is stuck on skeletons forever
3. GlobalChat never renders because the whole component tree is in a broken state

## Root Cause

Vite HMR module graph caches file paths. When a file is renamed (`.ts` → `.tsx`), the old path becomes stale. The dev server tries to fetch the old path on reload, gets a 404, and the module fails to load.

## Fix

Re-save `useAuth.tsx` with a trivial change (add/remove whitespace or comment) to force Vite to invalidate its module cache and pick up the new file path. This is the minimal fix needed.

## Technical Details

**File:** `src/hooks/useAuth.tsx` — Add a timestamp comment at the top to force a cache bust. No functional changes needed.

