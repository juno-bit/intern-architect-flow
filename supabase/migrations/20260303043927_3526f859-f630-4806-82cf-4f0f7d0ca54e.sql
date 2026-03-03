
-- Update get_user_assignable_projects so junior architects can see ALL projects (not just their own)
CREATE OR REPLACE FUNCTION public.get_user_assignable_projects(user_uuid uuid)
 RETURNS TABLE(project_id uuid, project_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT p.id, p.name 
  FROM public.projects p
  WHERE 
    CASE 
      WHEN get_user_role(user_uuid) = 'chief_architect' THEN true
      WHEN get_user_role(user_uuid) = 'junior_architect' THEN true
      ELSE false
    END;
$$;
