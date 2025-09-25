#!/bin/bash

# ========================================
# SCRIPT DE LIMPIEZA - ARCHIVOS OBSOLETOS
# ========================================
# Este script elimina archivos que han sido reemplazados por la implementación
# de normalización a slots de 15 minutos

echo "🧹 LIMPIEZA DE ARCHIVOS OBSOLETOS - NORMALIZACIÓN 15MIN"
echo "======================================================="

# Directorio base
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_DIR="$BASE_DIR"

echo "📁 Directorio SQL: $SQL_DIR"
echo ""

# Lista de archivos obsoletos
DEPRECATED_FILES=(
    "UPDATE_FUNCTIONS_WITH_NORMALIZATION.sql"
    "PUBLIC_API_STANDARDIZED.sql" 
    "CLEANUP_FINAL_PRODUCTION_READY.sh"
    "09_audit_reservations.sql"
    "07_complete_vps_setup.sql"
)

# Lista de directorios obsoletos
DEPRECATED_DIRS=(
    "backup_esenciales"
)

echo "🗑️  ARCHIVOS A ELIMINAR:"
echo "------------------------"

# Mostrar archivos que se van a eliminar
for file in "${DEPRECATED_FILES[@]}"; do
    if [ -f "$SQL_DIR/$file" ]; then
        echo "   ❌ $file"
    else
        echo "   ⚠️  $file (no encontrado)"
    fi
done

echo ""
echo "📂 DIRECTORIOS A ELIMINAR:"
echo "--------------------------"

for dir in "${DEPRECATED_DIRS[@]}"; do
    if [ -d "$SQL_DIR/$dir" ]; then
        echo "   ❌ $dir/"
    else
        echo "   ⚠️  $dir/ (no encontrado)"
    fi
done

echo ""
echo "✅ ARCHIVOS QUE SE MANTIENEN:"
echo "-----------------------------"
echo "   ✓ 01_database_structure.sql"
echo "   ✓ 02_initial_data.sql"
echo "   ✓ 03_reservation_functions_NORMALIZED.sql (NUEVO)"
echo "   ✓ 04_customer_functions.sql"
echo "   ✓ 05_policies.sql"
echo "   ✓ 06_storage_and_permissions.sql"
echo "   ✓ NORMALIZE_15MIN_SLOTS.sql"
echo "   ✓ API_PUBLICA_DOCUMENTACION.md"
echo ""

# Pedir confirmación
read -p "¿Continuar con la eliminación? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Operación cancelada"
    exit 1
fi

echo ""
echo "🚀 INICIANDO LIMPIEZA..."
echo "========================"

# Eliminar archivos obsoletos
for file in "${DEPRECATED_FILES[@]}"; do
    if [ -f "$SQL_DIR/$file" ]; then
        rm "$SQL_DIR/$file"
        echo "   ✅ Eliminado: $file"
    fi
done

# Eliminar directorios obsoletos
for dir in "${DEPRECATED_DIRS[@]}"; do
    if [ -d "$SQL_DIR/$dir" ]; then
        rm -rf "$SQL_DIR/$dir"
        echo "   ✅ Eliminado: $dir/"
    fi
done

echo ""
echo "🎉 LIMPIEZA COMPLETADA"
echo "======================"
echo ""
echo "📋 RESUMEN:"
echo "   • Archivos obsoletos eliminados"
echo "   • Estructura optimizada para normalización 15min"
echo "   • Solo archivos esenciales mantenidos"
echo ""
echo "📖 PRÓXIMOS PASOS:"
echo "   1. Usar: docs/sql/03_reservation_functions_NORMALIZED.sql"
echo "   2. Ejecutar: docs/sql/NORMALIZE_15MIN_SLOTS.sql"
echo "   3. Aplicar cambios frontend propuestos"
echo ""
echo "✨ Sistema listo para slots de 15 minutos!"
