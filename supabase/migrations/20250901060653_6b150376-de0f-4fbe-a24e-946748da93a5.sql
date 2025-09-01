-- Create enum types for better data consistency
CREATE TYPE public.task_status AS ENUM ('pending', 'in_progress', 'completed', 'overdue');
CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE public.project_status AS ENUM ('planning', 'in_progress', 'on_hold', 'completed', 'cancelled');
CREATE TYPE public.notification_type AS ENUM ('deadline_reminder', 'task_assigned', 'status_update', 'project_update');

-- Create clients table
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  company TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create projects table
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  status project_status NOT NULL DEFAULT 'planning',
  start_date DATE,
  end_date DATE,
  budget DECIMAL(12,2),
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create tasks table (replacing localStorage)
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  created_by UUID NOT NULL,
  status task_status NOT NULL DEFAULT 'pending',
  priority task_priority NOT NULL DEFAULT 'medium',
  due_date DATE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create task status history for tracking changes
CREATE TABLE public.task_status_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  old_status task_status,
  new_status task_status NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  is_read BOOLEAN NOT NULL DEFAULT false,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create images table (replacing localStorage)
CREATE TABLE public.images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.images ENABLE ROW LEVEL SECURITY;

-- Create security definer function for role checking
CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid UUID)
RETURNS TEXT AS $$
  SELECT role::TEXT FROM public.profiles WHERE user_id = user_uuid;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- RLS Policies for clients
CREATE POLICY "Authenticated users can view clients" ON public.clients
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Chief architects can manage clients" ON public.clients
  FOR ALL TO authenticated USING (public.get_user_role(auth.uid()) = 'chief_architect');

-- RLS Policies for projects
CREATE POLICY "Authenticated users can view projects" ON public.projects
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Chief architects can manage projects" ON public.projects
  FOR ALL TO authenticated USING (public.get_user_role(auth.uid()) = 'chief_architect');

-- RLS Policies for tasks
CREATE POLICY "Users can view their assigned tasks" ON public.tasks
  FOR SELECT TO authenticated USING (
    assigned_to = auth.uid() OR 
    public.get_user_role(auth.uid()) = 'chief_architect'
  );

CREATE POLICY "Chief architects can manage all tasks" ON public.tasks
  FOR ALL TO authenticated USING (public.get_user_role(auth.uid()) = 'chief_architect');

CREATE POLICY "Users can update status of their tasks" ON public.tasks
  FOR UPDATE TO authenticated USING (assigned_to = auth.uid())
  WITH CHECK (assigned_to = auth.uid());

-- RLS Policies for task status history
CREATE POLICY "Users can view task history" ON public.task_status_history
  FOR SELECT TO authenticated USING (
    user_id = auth.uid() OR 
    public.get_user_role(auth.uid()) = 'chief_architect'
  );

CREATE POLICY "Users can insert task history" ON public.task_status_history
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- RLS Policies for notifications
CREATE POLICY "Users can view their notifications" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "System can create notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update their notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- RLS Policies for images
CREATE POLICY "Users can view all images" ON public.images
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can upload images" ON public.images
  FOR INSERT TO authenticated WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "Chief architects can manage all images" ON public.images
  FOR ALL TO authenticated USING (public.get_user_role(auth.uid()) = 'chief_architect');

-- Create triggers for updated_at columns
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to automatically update task status to overdue
CREATE OR REPLACE FUNCTION public.update_overdue_tasks()
RETURNS void AS $$
BEGIN
  UPDATE public.tasks 
  SET status = 'overdue'
  WHERE due_date < CURRENT_DATE 
    AND status IN ('pending', 'in_progress');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to log task status changes
CREATE OR REPLACE FUNCTION public.log_task_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.task_status_history (task_id, user_id, old_status, new_status)
    VALUES (NEW.id, auth.uid(), OLD.status, NEW.status);
    
    -- Mark as completed if status changed to completed
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
      NEW.completed_at = now();
    ELSIF NEW.status != 'completed' THEN
      NEW.completed_at = NULL;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for task status changes
CREATE TRIGGER log_task_status_changes
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.log_task_status_change();