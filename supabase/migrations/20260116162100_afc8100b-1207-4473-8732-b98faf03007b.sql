-- SECURITY FIX: Restrict profiles table to prevent PII exposure
-- Remove the permissive policy that allows viewing public profiles directly (exposes email/full_name)
DROP POLICY IF EXISTS "Anyone can view public profiles" ON public.profiles;

-- Users can only view their own profile directly (prevents email/full_name exposure)
-- Public profiles should be accessed through the profiles_public view which excludes PII
CREATE POLICY "Users can only view own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Note: The profiles_public view (which excludes email/full_name) is used for leaderboard access