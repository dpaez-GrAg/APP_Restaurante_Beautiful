#!/bin/bash

# Script de Consolidación para Producción
# Transforma 19 archivos fragmentados en 6 archivos limpios y profesionales

set -e  # Salir si hay algún error

echo "🚀 CONSOLIDACIÓN PARA PRODUCCIÓN"
echo "================================="
echo "Transformando archivos SQL de desarrollo a producción..."
echo ""

# Verificar que estamos en el directorio correcto
if [ ! -f "bootstrap_full.sql" ]; then
    echo "❌ Error: No se encuentra bootstrap_full.sql"
    echo "   Ejecuta este script desde docs/sql/"
    exit 1
fi

# Crear backup completo
echo "💾 Creando backup completo..."
backup_dir="../sql_backup_production_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$backup_dir"
cp *.sql *.md "$backup_dir/" 2>/dev/null || true
echo "✅ Backup creado en: $backup_dir"

# Crear directorio temporal para la consolidación
echo ""
echo "🔄 Iniciando consolidación..."
temp_dir="temp_production"
rm -rf "$temp_dir"
mkdir -p "$temp_dir"

# ========================================
# 1. ESTRUCTURA DE BASE DE DATOS
# ========================================
echo "📁 Consolidando estructura de base de datos..."

cat > "$temp_dir/01_database_structure.sql" << 'EOF'
-- ========================================
-- ESTRUCTURA COMPLETA DE BASE DE DATOS
-- Sistema de Reservas con Gestión de Usuarios
-- ========================================
-- Este archivo contiene toda la estructura de tablas, enums y triggers
-- necesarios para el funcionamiento del sistema.

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

EOF

# Extraer enums del bootstrap
grep -A 10 "CREATE TYPE" bootstrap_full.sql >> "$temp_dir/01_database_structure.sql" || true

# Extraer tablas del bootstrap (sin funciones)
sed -n '/-- TABLES/,/-- STORED PROCEDURES/p' bootstrap_full.sql | sed '/-- STORED PROCEDURES/d' >> "$temp_dir/01_database_structure.sql"

# Agregar campos adicionales de max_diners si existe
if [ -f "add_max_diners_to_schedules.sql" ]; then
    echo "" >> "$temp_dir/01_database_structure.sql"
    echo "-- Campos adicionales para límites de comensales" >> "$temp_dir/01_database_structure.sql"
    cat add_max_diners_to_schedules.sql >> "$temp_dir/01_database_structure.sql"
fi

# ========================================
# 2. DATOS INICIALES
# ========================================
echo "📁 Consolidando datos iniciales..."

cat > "$temp_dir/02_initial_data.sql" << 'EOF'
-- ========================================
-- DATOS INICIALES DEL SISTEMA
-- ========================================
-- Este archivo contiene todos los datos iniciales necesarios
-- para el funcionamiento básico del sistema.

EOF

if [ -f "seed_full.sql" ]; then
    cat seed_full.sql >> "$temp_dir/02_initial_data.sql"
else
    echo "-- No se encontró seed_full.sql - agregar datos iniciales manualmente" >> "$temp_dir/02_initial_data.sql"
fi

# ========================================
# 3. FUNCIONES DE RESERVAS
# ========================================
echo "📁 Consolidando funciones de reservas..."

cat > "$temp_dir/03_reservation_functions.sql" << 'EOF'
-- ========================================
-- FUNCIONES DE RESERVAS Y DISPONIBILIDAD
-- ========================================
-- Este archivo contiene todas las funciones relacionadas con:
-- - Verificación de disponibilidad
-- - Creación de reservas
-- - Asignación de mesas
-- - APIs de disponibilidad

EOF

# Consolidar todas las funciones de reservas
reservation_files=(
    "force_update_functions.sql"
    "fix_reservation_creation.sql" 
    "fix_ui_parameters.sql"
    "api_check_availability_with_capacity_fixed.sql"
    "api_check_availability_with_capacity.sql"
    "get_available_time_slots_fixed.sql"
    "get_available_time_slots.sql"
    "get_diners_capacity_info.sql"
)

for file in "${reservation_files[@]}"; do
    if [ -f "$file" ]; then
        echo "" >> "$temp_dir/03_reservation_functions.sql"
        echo "-- Funciones de: $file" >> "$temp_dir/03_reservation_functions.sql"
        echo "-- ========================================" >> "$temp_dir/03_reservation_functions.sql"
        cat "$file" >> "$temp_dir/03_reservation_functions.sql"
        echo "✅ Agregado: $file"
    else
        echo "⚠️  No encontrado: $file"
    fi
done

# ========================================
# 4. FUNCIONES DE CLIENTES
# ========================================
echo "📁 Consolidando funciones de clientes..."

cat > "$temp_dir/04_customer_functions.sql" << 'EOF'
-- ========================================
-- FUNCIONES DE GESTIÓN DE CLIENTES
-- ========================================
-- Este archivo contiene todas las funciones relacionadas con:
-- - Gestión de clientes
-- - Clasificación de clientes (VIP, NEUTRO, ALERTA, RED FLAG)
-- - Email opcional en customers

EOF

# Consolidar funciones de clientes
customer_files=(
    "make_email_optional_fixed2.sql"
    "make_email_optional.sql"
    "fix_create_customer_function.sql"
    "add_customer_classification_system.sql"
)

for file in "${customer_files[@]}"; do
    if [ -f "$file" ]; then
        echo "" >> "$temp_dir/04_customer_functions.sql"
        echo "-- Funciones de: $file" >> "$temp_dir/04_customer_functions.sql"
        echo "-- ========================================" >> "$temp_dir/04_customer_functions.sql"
        cat "$file" >> "$temp_dir/04_customer_functions.sql"
        echo "✅ Agregado: $file"
    else
        echo "⚠️  No encontrado: $file"
    fi
done

# ========================================
# 5. GESTIÓN DE USUARIOS
# ========================================
echo "📁 Consolidando sistema de usuarios..."

cat > "$temp_dir/05_user_management.sql" << 'EOF'
-- ========================================
-- SISTEMA DE GESTIÓN DE USUARIOS
-- ========================================
-- Este archivo contiene el sistema completo de gestión de usuarios:
-- - Roles: admin y user
-- - Permisos granulares
-- - Funciones de administración de usuarios

EOF

# Buscar archivo de gestión de usuarios
user_files=(
    "add_user_management_system.sql"
    "user_management_system.sql"
)

user_file_found=false
for file in "${user_files[@]}"; do
    if [ -f "$file" ]; then
        cat "$file" >> "$temp_dir/05_user_management.sql"
        echo "✅ Agregado: $file"
        user_file_found=true
        break
    fi
done

if [ "$user_file_found" = false ]; then
    echo "⚠️  No se encontró archivo de gestión de usuarios"
    echo "-- Sistema de gestión de usuarios no encontrado" >> "$temp_dir/05_user_management.sql"
    echo "-- Crear manualmente las tablas y funciones necesarias" >> "$temp_dir/05_user_management.sql"
fi

# ========================================
# 6. STORAGE Y PERMISOS
# ========================================
echo "📁 Consolidando storage y permisos..."

cat > "$temp_dir/06_storage_and_permissions.sql" << 'EOF'
-- ========================================
-- STORAGE Y PERMISOS FINALES
-- ========================================
-- Este archivo contiene:
-- - Configuración de storage para imágenes
-- - Políticas RLS finales
-- - Permisos y grants necesarios

EOF

# Buscar archivos de storage
storage_files=(
    "setup_storage_bucket_fixed.sql"
    "setup_storage_bucket.sql"
)

storage_file_found=false
for file in "${storage_files[@]}"; do
    if [ -f "$file" ]; then
        cat "$file" >> "$temp_dir/06_storage_and_permissions.sql"
        echo "✅ Agregado: $file"
        storage_file_found=true
        break
    fi
done

if [ "$storage_file_found" = false ]; then
    echo "⚠️  No se encontró archivo de storage"
fi

# Agregar permisos finales
echo "" >> "$temp_dir/06_storage_and_permissions.sql"
echo "-- Permisos finales del sistema" >> "$temp_dir/06_storage_and_permissions.sql"
echo "GRANT USAGE ON SCHEMA public TO anon, authenticated;" >> "$temp_dir/06_storage_and_permissions.sql"

# ========================================
# VERIFICACIÓN Y REEMPLAZO
# ========================================
echo ""
echo "✅ Consolidación completada!"
echo ""
echo "📊 Archivos generados:"
ls -la "$temp_dir/"*.sql

echo ""
echo "🔍 Verificando archivos generados..."

# Contar líneas en cada archivo
for file in "$temp_dir"/*.sql; do
    lines=$(wc -l < "$file")
    echo "   $(basename "$file"): $lines líneas"
done

echo ""
echo "🎯 ¿Proceder con el reemplazo? (y/N)"
read -r response

if [[ "$response" =~ ^[Yy]$ ]]; then
    echo ""
    echo "🔄 Reemplazando archivos originales..."
    
    # Mover archivos antiguos a backup
    mkdir -p "$backup_dir/old_files"
    mv *.sql *.md "$backup_dir/old_files/" 2>/dev/null || true
    
    # Copiar archivos nuevos
    cp "$temp_dir"/*.sql .
    
    # Copiar la guía de instalación si existe
    if [ -f "CLEAN_INSTALLATION_GUIDE.md" ]; then
        cp CLEAN_INSTALLATION_GUIDE.md .
    else
        echo "⚠️  Guía de instalación no encontrada"
    fi
    
    # Limpiar directorio temporal
    rm -rf "$temp_dir"
    
    echo ""
    echo "🎉 ¡CONSOLIDACIÓN COMPLETADA!"
    echo ""
    echo "📁 Estructura final:"
    ls -la *.sql *.md 2>/dev/null || true
    
    echo ""
    echo "✅ Tu repositorio ahora tiene:"
    echo "   • 6 archivos SQL limpios y profesionales"
    echo "   • Nombres sin sufijos de desarrollo"
    echo "   • Instalación simple en 3 pasos"
    echo "   • Listo para producción"
    echo ""
    echo "🚀 Próximos pasos:"
    echo "   1. Probar la instalación completa"
    echo "   2. Actualizar README.md principal"
    echo "   3. Hacer commit de los cambios"
    echo ""
    echo "💾 Backup disponible en: $backup_dir"
    
else
    echo ""
    echo "❌ Operación cancelada"
    echo "📁 Archivos generados disponibles en: $temp_dir/"
    echo "🔍 Revisa los archivos y ejecuta el script nuevamente"
fi
