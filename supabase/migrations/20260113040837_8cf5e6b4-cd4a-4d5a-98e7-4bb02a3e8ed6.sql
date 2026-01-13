-- Drop the existing overly permissive SELECT policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Create a more restrictive SELECT policy
-- Users can see their own full profile OR basic info (full_name, role) for others
-- Chief architects can see all profile data
CREATE POLICY "Users can view profiles with restricted email access"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = user_id
  OR get_user_role(auth.uid()) = 'chief_architect'
);

-- Create a security definer function to get basic profile info (name only) for all users
-- This bypasses RLS and only returns non-sensitive data
CREATE OR REPLACE FUNCTION public.get_profile_display_info(profile_user_id uuid)
RETURNS TABLE(user_id uuid, full_name text, role text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.full_name, p.role::text
  FROM public.profiles p
  WHERE p.user_id = profile_user_id;
$$;

-- Create a function to get all profiles with limited info for non-chief architects
CREATE OR REPLACE FUNCTION public.get_all_profiles_limited()
RETURNS TABLE(user_id uuid, full_name text, role text, email text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF get_user_role(auth.uid()) = 'chief_architect' THEN
    -- Chief architects see everything
    RETURN QUERY SELECT p.user_id, p.full_name, p.role::text, p.email FROM public.profiles p;
  ELSE
    -- Others see their own email, but only names for everyone else
    RETURN QUERY 
    SELECT 
      p.user_id, 
      p.full_name, 
      p.role::text,
      CASE 
        WHEN p.user_id = auth.uid() THEN p.email
        ELSE NULL
      END as email
    FROM public.profiles p;
  END IF;
END;
$$;