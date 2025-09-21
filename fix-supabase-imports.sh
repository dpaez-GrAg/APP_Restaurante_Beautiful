#!/bin/bash

# Script para eliminar múltiples instancias de GoTrueClient
# Cambia todas las importaciones de Supabase para usar una sola fuente

echo "🔧 Eliminando múltiples instancias de GoTrueClient..."

# 1. Cambiar todas las importaciones de @/integrations/supabase/client a @/lib/supabase
echo "📝 Cambiando importaciones de @/integrations/supabase/client a @/lib/supabase..."

find src -name "*.tsx" -o -name "*.ts" | xargs sed -i '' 's|from "@/integrations/supabase/client"|from "@/lib/supabase"|g'

echo "✅ Importaciones cambiadas"

# 2. Eliminar el archivo de re-exportación que causa el problema
echo "🗑️  Eliminando archivo de re-exportación..."

rm -f src/integrations/supabase/client.ts

echo "✅ Archivo eliminado"

# 3. Verificar que no queden importaciones del archivo eliminado
echo "🔍 Verificando importaciones restantes..."

remaining=$(grep -r "from \"@/integrations/supabase/client\"" src/ 2>/dev/null | wc -l)

if [ $remaining -eq 0 ]; then
    echo "✅ Todas las importaciones han sido cambiadas correctamente"
else
    echo "⚠️  Quedan $remaining importaciones por cambiar:"
    grep -r "from \"@/integrations/supabase/client\"" src/ 2>/dev/null
fi

echo ""
echo "🎉 Script completado. Reinicia el servidor de desarrollo para aplicar los cambios:"
echo "   npm run dev"
echo ""
echo "El warning de 'Multiple GoTrueClient instances' debería desaparecer."
