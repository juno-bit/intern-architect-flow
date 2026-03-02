
-- Allow all authenticated users to create projects
CREATE POLICY "All authenticated users can create projects"
ON public.projects
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

-- Allow users to update their own projects
CREATE POLICY "Users can update their own projects"
ON public.projects
FOR UPDATE
TO authenticated
USING (created_by = auth.uid());

-- Allow users to delete their own projects
CREATE POLICY "Users can delete their own projects"
ON public.projects
FOR DELETE
TO authenticated
USING (created_by = auth.uid());
