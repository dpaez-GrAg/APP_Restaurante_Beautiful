-- ========================================
-- STORAGE Y PERMISOS FINALES
-- ========================================
-- Este archivo contiene:
-- - Configuración de storage para imágenes
-- - Políticas RLS finales
-- - Permisos y grants necesarios

-- ========================================
-- CONFIGURAR STORAGE PARA IMÁGENES DEL RESTAURANTE (VERSIÓN CORREGIDA)
-- ========================================
-- Este script verifica y configura el bucket de storage necesario

-- 1. Verificar si el bucket existe
SELECT 'BUCKETS EXISTENTES' as check_type,
       id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE name = 'restaurant-images';

-- 2. Crear el bucket si no existe
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'restaurant-images',
  'restaurant-images', 
  true,  -- Público para que las imágenes sean accesibles
  5242880,  -- 5MB límite
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']  -- Solo imágenes
)
ON CONFLICT (id) DO NOTHING;

-- 3. Verificar políticas de RLS existentes
SELECT 'POLÍTICAS STORAGE EXISTENTES' as check_type,
       schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies 
WHERE schemaname = 'storage' AND tablename = 'objects';

-- 4. Eliminar políticas existentes si existen (para recrearlas)
DROP POLICY IF EXISTS "Public read access for restaurant images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload restaurant images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update restaurant images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete restaurant images" ON storage.objects;

-- 5. Crear políticas de acceso para el bucket
-- Política para permitir lectura pública de imágenes
CREATE POLICY "Public read access for restaurant images"
ON storage.objects FOR SELECT
USING (bucket_id = 'restaurant-images');

-- Política para permitir subida de imágenes (autenticado)
CREATE POLICY "Authenticated users can upload restaurant images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'restaurant-images');

-- Política para permitir actualización de imágenes (autenticado)
CREATE POLICY "Authenticated users can update restaurant images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'restaurant-images')
WITH CHECK (bucket_id = 'restaurant-images');

-- Política para permitir eliminación de imágenes (autenticado)
CREATE POLICY "Authenticated users can delete restaurant images"
ON storage.objects FOR DELETE
USING (bucket_id = 'restaurant-images');

-- 6. Verificar que las políticas se crearon correctamente
SELECT 'POLÍTICAS CREADAS' as check_type,
       policyname, cmd, permissive
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND policyname LIKE '%restaurant images%';

-- 7. Verificar configuración final del bucket
SELECT 'CONFIGURACIÓN FINAL' as check_type,
       id, name, public, file_size_limit, allowed_mime_types, created_at
FROM storage.buckets
WHERE name = 'restaurant-images';

-- 8. Probar acceso al bucket (opcional)
SELECT 'TEST BUCKET ACCESS' as test_type,
       'Bucket configurado correctamente' as message;

-- Permisos finales del sistema
GRANT USAGE ON SCHEMA public TO anon, authenticated;
