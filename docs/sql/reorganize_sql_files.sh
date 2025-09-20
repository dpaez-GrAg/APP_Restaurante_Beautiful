#!/bin/bash

# Script de Reorganización de Archivos SQL
# Este script renombra los archivos SQL para tener nombres más limpios y organizados

set -e  # Salir si hay algún error

echo "🔄 Iniciando reorganización de archivos SQL..."
echo "📁 Directorio actual: $(pwd)"

# Verificar que estamos en el directorio correcto
if [ ! -f "bootstrap_full.sql" ]; then
    echo "❌ Error: No se encuentra bootstrap_full.sql"
    echo "   Asegúrate de ejecutar este script desde docs/sql/"
    exit 1
fi

# Crear backup
echo "💾 Creando backup..."
backup_dir="../sql_backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$backup_dir"
cp *.sql "$backup_dir/"
echo "✅ Backup creado en: $backup_dir"

# PASO 1: Eliminar archivos duplicados
echo ""
echo "🗑️ PASO 1: Eliminando archivos duplicados..."

if [ -f "setup_storage_bucket.sql" ]; then
    rm -f setup_storage_bucket.sql
    echo "   ✅ Eliminado: setup_storage_bucket.sql (duplicado)"
else
    echo "   ℹ️  No encontrado: setup_storage_bucket.sql (ya eliminado)"
fi

# PASO 2: Renombrar archivos con sufijos _fixed
echo ""
echo "🏷️ PASO 2: Renombrando archivos con sufijos _fixed..."

rename_file() {
    local old_name="$1"
    local new_name="$2"
    
    if [ -f "$old_name" ]; then
        mv "$old_name" "$new_name"
        echo "   ✅ $old_name → $new_name"
    else
        echo "   ℹ️  No encontrado: $old_name"
    fi
}

rename_file "api_check_availability_with_capacity_fixed.sql" "api_check_availability_with_capacity.sql"
rename_file "get_available_time_slots_fixed.sql" "get_available_time_slots.sql"
rename_file "make_email_optional_fixed2.sql" "make_email_optional.sql"
rename_file "setup_storage_bucket_fixed.sql" "setup_storage_bucket.sql"

# PASO 3: Renombrar archivos fix_ por nombres más descriptivos
echo ""
echo "📝 PASO 3: Renombrando archivos fix_ por nombres más descriptivos..."

rename_file "force_update_functions.sql" "update_availability_functions.sql"
rename_file "fix_reservation_creation.sql" "update_reservation_functions.sql"
rename_file "fix_ui_parameters.sql" "update_ui_functions.sql"
rename_file "fix_create_customer_function.sql" "update_customer_functions.sql"

# PASO 4: Mostrar estructura final
echo ""
echo "📋 PASO 4: Estructura final de archivos..."
echo ""
echo "📁 Scripts de Instalación Base:"
ls -la bootstrap_full.sql seed_full.sql add_max_diners_to_schedules.sql get_diners_capacity_info.sql 2>/dev/null || echo "   ⚠️  Algunos archivos base no encontrados"

echo ""
echo "📁 Scripts de Funciones Principales:"
ls -la update_availability_functions.sql update_reservation_functions.sql update_ui_functions.sql api_check_availability_with_capacity.sql get_available_time_slots.sql 2>/dev/null || echo "   ⚠️  Algunos archivos de funciones no encontrados"

echo ""
echo "📁 Scripts de Mejoras del Sistema:"
ls -la make_email_optional.sql update_customer_functions.sql setup_storage_bucket.sql add_customer_classification_system.sql add_user_management_system.sql 2>/dev/null || echo "   ⚠️  Algunos archivos de mejoras no encontrados"

echo ""
echo "📁 Scripts de Verificación (opcionales):"
ls -la test_reservation_creation.sql verify_functions.sql 2>/dev/null || echo "   ℹ️  Archivos de verificación opcionales"

echo ""
echo "📁 Documentación:"
ls -la IMPLEMENTATION_INSTRUCTIONS.md files_to_delete.md 2>/dev/null || echo "   ℹ️  Archivos de documentación"

# Contar archivos finales
total_files=$(ls -1 *.sql 2>/dev/null | wc -l)
echo ""
echo "📊 Total de archivos SQL: $total_files"

echo ""
echo "✅ ¡Reorganización completada exitosamente!"
echo ""
echo "🔄 Próximos pasos:"
echo "   1. Verificar que los archivos se renombraron correctamente"
echo "   2. Actualizar IMPLEMENTATION_INSTRUCTIONS.md con los nuevos nombres"
echo "   3. Actualizar SETUP_AND_DEPLOY_GUIDE.md con las referencias"
echo "   4. Probar que los scripts funcionan con los nuevos nombres"
echo ""
echo "💾 Backup disponible en: $backup_dir"
echo "🗑️ Si todo funciona bien, puedes eliminar el backup con:"
echo "   rm -rf $backup_dir"
