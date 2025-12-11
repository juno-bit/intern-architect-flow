-- Add paid_amount column for partial payment tracking
ALTER TABLE public.invoices ADD COLUMN paid_amount numeric DEFAULT 0;

-- Add payment history table
CREATE TABLE public.invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
  amount numeric NOT NULL,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text,
  notes text,
  recorded_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;

-- RLS policies for invoice_payments
CREATE POLICY "Authenticated users can view payments"
ON public.invoice_payments FOR SELECT
USING (true);

CREATE POLICY "Jr and Chief architects can record payments"
ON public.invoice_payments FOR INSERT
WITH CHECK (get_user_role(auth.uid()) IN ('junior_architect', 'chief_architect'));

CREATE POLICY "Chief architects can delete payments"
ON public.invoice_payments FOR DELETE
USING (get_user_role(auth.uid()) = 'chief_architect');