-- Allow interns to view all meetings
CREATE POLICY "Interns can view all meetings"
ON public.meetings
FOR SELECT
TO authenticated
USING (get_user_role(auth.uid()) = 'intern');