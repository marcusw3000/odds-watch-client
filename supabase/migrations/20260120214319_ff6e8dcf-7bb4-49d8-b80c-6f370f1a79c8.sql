-- SECURITY FIX: Prevent PII exposure from profiles table
-- Remove current policy that exposes email/cpf/phone/full_name for public profiles
DROP POLICY IF EXISTS "Users can view own profile or public profiles" ON public.profiles;

-- New policy: Users can only view their own profile or admins can view all
-- Public profile data should be accessed via profiles_public view (which excludes PII)
CREATE POLICY "Users can view own profile or admins"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = id  -- Own profile only
  OR has_role(auth.uid(), 'admin'::app_role)  -- Admins can see all
);