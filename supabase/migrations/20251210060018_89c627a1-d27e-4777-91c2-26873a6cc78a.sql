-- Create invoice status enum
CREATE TYPE public.invoice_status AS ENUM ('draft', 'sent', 'paid', 'overdue', 'cancelled');

-- Create invoices table
CREATE TABLE public.invoices (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    invoice_number TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    status invoice_status NOT NULL DEFAULT 'draft',
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    paid_date DATE,
    description TEXT,
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view invoices"
ON public.invoices
FOR SELECT
USING (true);

CREATE POLICY "Jr and Chief architects can create invoices"
ON public.invoices
FOR INSERT
WITH CHECK (get_user_role(auth.uid()) IN ('junior_architect', 'chief_architect'));

CREATE POLICY "Jr and Chief architects can update invoices"
ON public.invoices
FOR UPDATE
USING (get_user_role(auth.uid()) IN ('junior_architect', 'chief_architect'));

CREATE POLICY "Chief architects can delete invoices"
ON public.invoices
FOR DELETE
USING (get_user_role(auth.uid()) = 'chief_architect');

-- Add updated_at trigger
CREATE TRIGGER update_invoices_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();