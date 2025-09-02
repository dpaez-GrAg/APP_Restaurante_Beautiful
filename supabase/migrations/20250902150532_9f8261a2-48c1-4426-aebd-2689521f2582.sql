
-- Añadir time slots de cena hasta las 22:45 solo si no existen
INSERT INTO public.time_slots (time, max_capacity)
SELECT v.t::time, 50
FROM (VALUES ('22:00'), ('22:15'), ('22:30'), ('22:45')) AS v(t)
WHERE NOT EXISTS (
  SELECT 1 FROM public.time_slots ts WHERE ts.time = v.t::time
);
