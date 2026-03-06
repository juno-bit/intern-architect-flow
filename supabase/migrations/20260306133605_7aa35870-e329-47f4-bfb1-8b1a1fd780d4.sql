
-- Update get_assignable_users to include civil_engineer
CREATE OR REPLACE FUNCTION public.get_assignable_users(requester_uuid uuid)
 RETURNS TABLE(user_id uuid, full_name text, role text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT pr.user_id, pr.full_name, pr.role::text
  FROM public.profiles pr
  WHERE 
    CASE 
      WHEN get_user_role(requester_uuid) = 'chief_architect' THEN true
      WHEN get_user_role(requester_uuid) IN ('junior_architect', 'civil_engineer') THEN pr.role IN ('intern', 'junior_architect', 'civil_engineer')
      ELSE pr.user_id = requester_uuid
    END;
$$;

-- Update get_user_assignable_projects to include civil_engineer
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
      WHEN get_user_role(user_uuid) IN ('junior_architect', 'civil_engineer') THEN true
      ELSE false
    END;
$$;

-- Update tasks INSERT policy
DROP POLICY IF EXISTS "Junior architects can assign tasks" ON public.tasks;
CREATE POLICY "Junior architects and civil engineers can assign tasks"
ON public.tasks FOR INSERT TO authenticated
WITH CHECK (
  (get_user_role(auth.uid()) = ANY (ARRAY['chief_architect'::text, 'junior_architect'::text, 'civil_engineer'::text]))
  OR ((assigned_to = auth.uid()) AND (self_assigned = true))
);

-- Update tasks SELECT policy to include created_by
DROP POLICY IF EXISTS "Users can view their assigned tasks" ON public.tasks;
CREATE POLICY "Users can view their assigned tasks"
ON public.tasks FOR SELECT TO authenticated
USING (
  (assigned_to = auth.uid()) OR (created_by = auth.uid()) OR (get_user_role(auth.uid()) = 'chief_architect'::text)
);

-- Update invoices RLS for civil_engineer
DROP POLICY IF EXISTS "Jr and Chief architects can create invoices" ON public.invoices;
CREATE POLICY "Jr Chief and Civil engineers can create invoices"
ON public.invoices FOR INSERT TO authenticated
WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY['junior_architect'::text, 'chief_architect'::text, 'civil_engineer'::text]));

DROP POLICY IF EXISTS "Jr and Chief architects can update invoices" ON public.invoices;
CREATE POLICY "Jr Chief and Civil engineers can update invoices"
ON public.invoices FOR UPDATE TO authenticated
USING (get_user_role(auth.uid()) = ANY (ARRAY['junior_architect'::text, 'chief_architect'::text, 'civil_engineer'::text]));

-- Update invoice_payments RLS for civil_engineer
DROP POLICY IF EXISTS "Jr and Chief architects can record payments" ON public.invoice_payments;
CREATE POLICY "Jr Chief and Civil engineers can record payments"
ON public.invoice_payments FOR INSERT TO authenticated
WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY['junior_architect'::text, 'chief_architect'::text, 'civil_engineer'::text]));

-- Meetings RLS for civil_engineer
CREATE POLICY "Civil engineers can manage their meetings"
ON public.meetings FOR ALL TO authenticated
USING ((get_user_role(auth.uid()) = 'civil_engineer'::text) AND (created_by = auth.uid()));

CREATE POLICY "Civil engineers can view all meetings"
ON public.meetings FOR SELECT TO authenticated
USING (get_user_role(auth.uid()) = 'civil_engineer'::text);
