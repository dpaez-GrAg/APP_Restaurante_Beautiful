-- Create table for special schedule days
CREATE TABLE public.special_schedule_days (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  opening_time TIME WITHOUT TIME ZONE NOT NULL,
  closing_time TIME WITHOUT TIME ZONE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.special_schedule_days ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow all for special schedule days" 
ON public.special_schedule_days 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Add trigger for timestamps
CREATE TRIGGER update_special_schedule_days_updated_at
BEFORE UPDATE ON public.special_schedule_days
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();