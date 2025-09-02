-- Create table for special closed days
CREATE TABLE public.special_closed_days (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  reason TEXT,
  is_range BOOLEAN NOT NULL DEFAULT false,
  range_start DATE,
  range_end DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.special_closed_days ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow all for special closed days" 
ON public.special_closed_days 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Add trigger for timestamps
CREATE TRIGGER update_special_closed_days_updated_at
BEFORE UPDATE ON public.special_closed_days
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();