-- Update the handle_new_user_profile function to also populate display_name
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  v_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  
  INSERT INTO public.profiles (id, email, full_name, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    v_name,
    NULLIF(v_name, '')  -- display_name = nome se existir, senão null
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    display_name = COALESCE(profiles.display_name, EXCLUDED.display_name);
  RETURN NEW;
END;
$$;

-- Backfill existing users: set display_name from full_name where display_name is null
UPDATE profiles
SET display_name = full_name
WHERE display_name IS NULL 
  AND full_name IS NOT NULL 
  AND full_name != '';