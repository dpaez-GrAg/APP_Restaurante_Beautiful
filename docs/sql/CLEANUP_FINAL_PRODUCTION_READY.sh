#!/bin/bash

# ========================================
# LIMPIEZA FINAL - DIRECTORIO PRODUCCIÓN
# ========================================
# Mantiene solo archivos esenciales + API pública documentada

echo "🧹 INICIANDO LIMPIEZA FINAL DEL DIRECTORIO SQL..."

# Directorio de trabajo
SQL_DIR="/Users/diegopaezmacias/GRIDDED.AGENCY.dev/04_tu-mesa-ideal/docs/sql"
cd "$SQL_DIR"

echo "📁 Directorio actual: $(pwd)"

# ========================================
# ARCHIVOS A MANTENER (ESENCIALES)
# ========================================
ARCHIVOS_ESENCIALES=(
    "00_GUIA_INSTALACION_SIMPLE.md"
    "01_database_structure.sql"
    "02_initial_data.sql"
    "03_reservation_functions.sql"
    "04_customer_functions.sql"
    "05_user_management.sql"
    "06_storage_and_permissions.sql"
    "07_complete_vps_setup.sql"
    "08_audit_system.sql"
    "09_audit_reservations.sql"
    "API_PUBLICA_DOCUMENTACION.md"
)

echo "✅ ARCHIVOS ESENCIALES A MANTENER:"
for archivo in "${ARCHIVOS_ESENCIALES[@]}"; do
    if [ -f "$archivo" ]; then
        echo "   ✅ $archivo"
    else
        echo "   ❌ $archivo (NO ENCONTRADO)"
    fi
done

# ========================================
# ARCHIVOS A ELIMINAR (TEMPORALES/DUPLICADOS)
# ========================================
ARCHIVOS_ELIMINAR=(
    "00_GUIA_INSTALACION_ACTUALIZADA.md"
    "PUBLIC_API_FUNCTIONS.sql"
    "PUBLIC_API_FUNCTIONS_FIXED.sql"
    "PUBLIC_API_NORMALIZED.sql"
    "PUBLIC_API_NORMALIZED_FIXED.sql"
    "CLEANUP_FINAL_DIRECTORY.sh"
    "CLEANUP_FINAL_DIRECTORY_UPDATED.sh"
)

echo ""
echo "🗑️  ARCHIVOS TEMPORALES A ELIMINAR:"
for archivo in "${ARCHIVOS_ELIMINAR[@]}"; do
    if [ -f "$archivo" ]; then
        echo "   🗑️  $archivo"
        rm -f "$archivo"
        echo "      ✅ Eliminado"
    else
        echo "   ⚪ $archivo (ya no existe)"
    fi
done

# ========================================
# MANTENER BACKUP DE SEGURIDAD
# ========================================
echo ""
echo "💾 VERIFICANDO BACKUP DE SEGURIDAD..."
if [ -d "backup_esenciales" ]; then
    echo "   ✅ Directorio backup_esenciales mantenido"
    echo "   📁 Contenido del backup:"
    ls -la backup_esenciales/ | head -5
else
    echo "   ⚠️  No se encontró directorio de backup"
fi

# ========================================
# RESUMEN FINAL
# ========================================
echo ""
echo "📊 RESUMEN DE LIMPIEZA:"
echo "========================"

TOTAL_ARCHIVOS=$(ls -1 *.sql *.md 2>/dev/null | wc -l)
echo "📁 Total de archivos SQL/MD: $TOTAL_ARCHIVOS"

echo ""
echo "✅ ARCHIVOS FINALES EN PRODUCCIÓN:"
echo "=================================="
ls -la *.sql *.md | while read -r line; do
    echo "   $line"
done

echo ""
echo "🎯 ESTRUCTURA FINAL PARA PRODUCCIÓN:"
echo "===================================="
echo "📋 INSTALACIÓN BÁSICA (archivos 01-07):"
echo "   01_database_structure.sql"
echo "   02_initial_data.sql"
echo "   03_reservation_functions.sql (+ API PÚBLICA)"
echo "   04_customer_functions.sql"
echo "   05_user_management.sql"
echo "   06_storage_and_permissions.sql"
echo "   07_complete_vps_setup.sql"
echo ""
echo "📋 AUDITORÍA OPCIONAL (archivos 08-09):"
echo "   08_audit_system.sql"
echo "   09_audit_reservations.sql"
echo ""
echo "📋 DOCUMENTACIÓN:"
echo "   00_GUIA_INSTALACION_SIMPLE.md"
echo "   API_PUBLICA_DOCUMENTACION.md"

echo ""
echo "🎉 LIMPIEZA COMPLETADA EXITOSAMENTE"
echo "🚀 Directorio listo para PRODUCCIÓN"
echo ""
echo "📝 PRÓXIMOS PASOS:"
echo "   1. Revisar archivos mantenidos"
echo "   2. Ejecutar instalación con archivos 01-07"
echo "   3. La API pública está integrada en 03_reservation_functions.sql"
echo "   4. Consultar API_PUBLICA_DOCUMENTACION.md para uso"

# ========================================
# VERIFICACIÓN FINAL
# ========================================
echo ""
echo "🔍 VERIFICACIÓN FINAL:"
echo "====================="

# Verificar que archivos esenciales existen
MISSING_FILES=0
for archivo in "${ARCHIVOS_ESENCIALES[@]}"; do
    if [ ! -f "$archivo" ]; then
        echo "❌ FALTA: $archivo"
        MISSING_FILES=$((MISSING_FILES + 1))
    fi
done

if [ $MISSING_FILES -eq 0 ]; then
    echo "✅ Todos los archivos esenciales están presentes"
    echo "🎯 DIRECTORIO LISTO PARA PRODUCCIÓN"
else
    echo "⚠️  Faltan $MISSING_FILES archivos esenciales"
    echo "🔧 Revisar instalación antes de usar en producción"
fi

echo ""
echo "🏁 SCRIPT DE LIMPIEZA FINALIZADO"
