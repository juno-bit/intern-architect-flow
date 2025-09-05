-- Enhance projects table with comprehensive details
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS phase text DEFAULT 'planning',
ADD COLUMN IF NOT EXISTS detailed_description text,
ADD COLUMN IF NOT EXISTS project_manager uuid REFERENCES public.profiles(user_id),
ADD COLUMN IF NOT EXISTS estimated_completion_date date,
ADD COLUMN IF NOT EXISTS actual_completion_date date,
ADD COLUMN IF NOT EXISTS project_type text DEFAULT 'residential',
ADD COLUMN IF NOT EXISTS location text,
ADD COLUMN IF NOT EXISTS floor_area numeric,
ADD COLUMN IF NOT EXISTS lot_area numeric;

-- Enhance tasks table with clearance and assignment features
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS clearance_status text DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS cleared_by uuid REFERENCES public.profiles(user_id),
ADD COLUMN IF NOT EXISTS cleared_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS self_assigned boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS estimated_hours numeric,
ADD COLUMN IF NOT EXISTS actual_hours numeric,
ADD COLUMN IF NOT EXISTS task_phase text;

-- Enhance images table with comprehensive metadata
ALTER TABLE public.images 
ADD COLUMN IF NOT EXISTS phase text,
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS image_category text DEFAULT 'progress',
ADD COLUMN IF NOT EXISTS capture_date date DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS file_path text,
ADD COLUMN IF NOT EXISTS thumbnail_url text,
ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;

-- Create task clearances table for approval workflow
CREATE TABLE IF NOT EXISTS public.task_clearances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES public.profiles(user_id),
  cleared_by uuid REFERENCES public.profiles(user_id),
  status text NOT NULL DEFAULT 'pending',
  notes text,
  requested_at timestamp with time zone NOT NULL DEFAULT now(),
  cleared_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on task_clearances
ALTER TABLE public.task_clearances ENABLE ROW LEVEL SECURITY;

-- RLS policies for task_clearances
CREATE POLICY "Users can view clearances for their tasks" 
ON public.task_clearances 
FOR SELECT 
USING (
  requested_by = auth.uid() OR 
  cleared_by = auth.uid() OR 
  get_user_role(auth.uid()) = 'chief_architect'
);

CREATE POLICY "Users can request clearances for their tasks" 
ON public.task_clearances 
FOR INSERT 
WITH CHECK (requested_by = auth.uid());

CREATE POLICY "Chief architects can manage clearances" 
ON public.task_clearances 
FOR ALL 
USING (get_user_role(auth.uid()) = 'chief_architect');

-- Create project galleries table for organized image collections
CREATE TABLE IF NOT EXISTS public.project_galleries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  cover_image_id uuid REFERENCES public.images(id),
  sort_order integer DEFAULT 0,
  is_public boolean DEFAULT false,
  created_by uuid NOT NULL REFERENCES public.profiles(user_id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on project_galleries
ALTER TABLE public.project_galleries ENABLE ROW LEVEL SECURITY;

-- RLS policies for project_galleries
CREATE POLICY "Authenticated users can view galleries" 
ON public.project_galleries 
FOR SELECT 
USING (true);

CREATE POLICY "Chief architects can manage all galleries" 
ON public.project_galleries 
FOR ALL 
USING (get_user_role(auth.uid()) = 'chief_architect');

CREATE POLICY "Users can manage their galleries" 
ON public.project_galleries 
FOR ALL 
USING (created_by = auth.uid());

-- Update task assignment policies to allow self-assignment
DROP POLICY IF EXISTS "Users can update status of their tasks" ON public.tasks;

CREATE POLICY "Users can update their assigned tasks" 
ON public.tasks 
FOR UPDATE 
USING (
  assigned_to = auth.uid() OR 
  created_by = auth.uid() OR 
  get_user_role(auth.uid()) = 'chief_architect'
);

-- Allow junior architects to assign tasks to interns and themselves
CREATE POLICY "Junior architects can assign tasks" 
ON public.tasks 
FOR INSERT 
WITH CHECK (
  get_user_role(auth.uid()) IN ('chief_architect', 'junior_architect') OR
  (assigned_to = auth.uid() AND self_assigned = true)
);

-- Update image policies for enhanced management
DROP POLICY IF EXISTS "Users can upload images" ON public.images;

CREATE POLICY "Users can upload images to their projects/tasks" 
ON public.images 
FOR INSERT 
WITH CHECK (
  uploaded_by = auth.uid() OR 
  get_user_role(auth.uid()) = 'chief_architect'
);

CREATE POLICY "Users can update their images" 
ON public.images 
FOR UPDATE 
USING (
  uploaded_by = auth.uid() OR 
  get_user_role(auth.uid()) = 'chief_architect'
);

CREATE POLICY "Users can delete their images" 
ON public.images 
FOR DELETE 
USING (
  uploaded_by = auth.uid() OR 
  get_user_role(auth.uid()) = 'chief_architect'
);

-- Create triggers for updated_at timestamps
CREATE TRIGGER update_task_clearances_updated_at
  BEFORE UPDATE ON public.task_clearances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_project_galleries_updated_at
  BEFORE UPDATE ON public.project_galleries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to get user projects for assignment
CREATE OR REPLACE FUNCTION public.get_user_assignable_projects(user_uuid uuid)
RETURNS TABLE(project_id uuid, project_name text)
LANGUAGE sql
STABLE SECURITY DEFINER
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

-- Create function to get assignable users for tasks
CREATE OR REPLACE FUNCTION public.get_assignable_users(requester_uuid uuid)
RETURNS TABLE(user_id uuid, full_name text, role text)
LANGUAGE sql
STABLE SECURITY DEFINER
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