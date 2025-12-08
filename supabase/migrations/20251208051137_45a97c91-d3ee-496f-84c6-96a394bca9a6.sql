-- Create meetings table
CREATE TABLE public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  meeting_date TIMESTAMPTZ NOT NULL,
  description TEXT NOT NULL,
  notes TEXT,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  created_by UUID NOT NULL,
  attendees TEXT[]
);

-- Enable RLS
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

-- Chief architects can manage all meetings
CREATE POLICY "Chief architects can manage all meetings"
ON public.meetings FOR ALL
USING (get_user_role(auth.uid()) = 'chief_architect');

-- Junior architects can manage their own meetings
CREATE POLICY "Junior architects can manage their meetings"
ON public.meetings FOR ALL
USING (
  get_user_role(auth.uid()) = 'junior_architect' 
  AND created_by = auth.uid()
);

-- Junior architects can view all meetings
CREATE POLICY "Junior architects can view all meetings"
ON public.meetings FOR SELECT
USING (get_user_role(auth.uid()) = 'junior_architect');

-- Add updated_at trigger
CREATE TRIGGER update_meetings_updated_at
  BEFORE UPDATE ON public.meetings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();