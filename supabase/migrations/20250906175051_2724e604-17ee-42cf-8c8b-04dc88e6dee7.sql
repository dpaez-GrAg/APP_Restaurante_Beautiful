-- Crear bucket para imágenes del restaurante
INSERT INTO storage.buckets (id, name, public) 
VALUES ('restaurant-images', 'restaurant-images', true);

-- Crear políticas para el bucket restaurant-images
CREATE POLICY "Permitir lectura pública de imágenes del restaurante" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'restaurant-images');

CREATE POLICY "Permitir subida de imágenes del restaurante para administradores" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'restaurant-images');

CREATE POLICY "Permitir actualización de imágenes del restaurante para administradores" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'restaurant-images');

CREATE POLICY "Permitir eliminación de imágenes del restaurante para administradores" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'restaurant-images');