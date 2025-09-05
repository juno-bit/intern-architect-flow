-- Fix search_path security warnings for functions
CREATE OR REPLACE FUNCTION public.get_user_assignable_projects(user_uuid uuid)
RETURNS TABLE(project_id uuid, project_name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.name 
  FROM public.projects p
  WHERE 
    CASE 
      WHEN get_user_role(user_uuid) = 'chief_architect' THEN true
      WHEN get_user_role(user_uuid) = 'junior_architect' THEN p.created_by = user_uuid OR p.project_manager = user_uuid
      ELSE false
    END;
$$;

CREATE OR REPLACE FUNCTION public.get_assignable_users(requester_uuid uuid)
RETURNS TABLE(user_id uuid, full_name text, role text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pr.user_id, pr.full_name, pr.role::text
  FROM public.profiles pr
  WHERE 
    CASE 
      WHEN get_user_role(requester_uuid) = 'chief_architect' THEN true
      WHEN get_user_role(requester_uuid) = 'junior_architect' THEN pr.role IN ('intern', 'junior_architect')
      ELSE pr.user_id = requester_uuid
    END;
$$;