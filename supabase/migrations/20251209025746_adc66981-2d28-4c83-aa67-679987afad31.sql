-- Create documents table for file repository
CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  url TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  file_extension TEXT,
  description TEXT,
  uploaded_by UUID NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view documents
CREATE POLICY "Authenticated users can view documents"
ON public.documents
FOR SELECT
USING (true);

-- Users can upload documents
CREATE POLICY "Users can upload documents"
ON public.documents
FOR INSERT
WITH CHECK (uploaded_by = auth.uid());

-- Users can update their own documents, chief architects can update any
CREATE POLICY "Users can update their documents"
ON public.documents
FOR UPDATE
USING (uploaded_by = auth.uid() OR get_user_role(auth.uid()) = 'chief_architect');

-- Users can delete their own documents, chief architects can delete any
CREATE POLICY "Users can delete their documents"
ON public.documents
FOR DELETE
USING (uploaded_by = auth.uid() OR get_user_role(auth.uid()) = 'chief_architect');

-- Add trigger for updated_at
CREATE TRIGGER update_documents_updated_at
BEFORE UPDATE ON public.documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();