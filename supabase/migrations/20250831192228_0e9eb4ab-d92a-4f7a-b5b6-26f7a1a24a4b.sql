-- Agregar campos de capacidad mínima, máxima y extra a table_combinations
ALTER TABLE public.table_combinations 
ADD COLUMN min_capacity integer DEFAULT 1,
ADD COLUMN max_capacity integer,
ADD COLUMN extra_capacity integer DEFAULT 0;