#!/bin/bash

# Script para limpiar el directorio SQL manteniendo solo los archivos esenciales
# Mantiene: 00_GUIA, 01-07, CONSOLIDATED_DATABASE_ORIGINAL_DESIGN
# Elimina: Todos los archivos de fix, test, diagnóstico y temporales

echo "🧹 Limpiando directorio SQL..."
echo ""

# Cambiar al directorio SQL
cd "$(dirname "$0")"

# Lista de archivos a MANTENER (archivos esenciales)
KEEP_FILES=(
    "00_GUIA_INSTALACION_ORIGINAL.md"
    "01_database_structure.sql"
    "02_initial_data.sql"
    "03_reservation_functions.sql"
    "04_customer_functions.sql"
    "05_user_management.sql"
    "06_storage_and_permissions.sql"
    "07_complete_vps_setup.sql"
    "CONSOLIDATED_DATABASE_ORIGINAL_DESIGN.sql"
    "UPDATE_CONSOLIDATED_WITH_FIXES.sql"
    "CLEANUP_SQL_DIRECTORY.sh"
)

# Crear array de archivos a eliminar
FILES_TO_DELETE=()

# Buscar todos los archivos SQL y scripts
for file in *.sql *.sh *.md; do
    if [[ -f "$file" ]]; then
        # Verificar si el archivo está en la lista de mantener
        keep_file=false
        for keep in "${KEEP_FILES[@]}"; do
            if [[ "$file" == "$keep" ]]; then
                keep_file=true
                break
            fi
        done
        
        # Si no está en la lista de mantener, agregarlo a eliminar
        if [[ "$keep_file" == false ]]; then
            FILES_TO_DELETE+=("$file")
        fi
    fi
done

# Mostrar archivos que se mantendrán
echo "📁 ARCHIVOS QUE SE MANTIENEN:"
for file in "${KEEP_FILES[@]}"; do
    if [[ -f "$file" ]]; then
        echo "  ✅ $file"
    fi
done

echo ""

# Mostrar archivos que se eliminarán
if [[ ${#FILES_TO_DELETE[@]} -gt 0 ]]; then
    echo "🗑️  ARCHIVOS QUE SE ELIMINARÁN (${#FILES_TO_DELETE[@]} archivos):"
    for file in "${FILES_TO_DELETE[@]}"; do
        echo "  ❌ $file"
    done
    
    echo ""
    read -p "¿Continuar con la eliminación? (y/N): " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🗑️  Eliminando archivos basura..."
        for file in "${FILES_TO_DELETE[@]}"; do
            rm -f "$file"
            echo "  ❌ Eliminado: $file"
        done
        
        echo ""
        echo "✅ Limpieza completada!"
        echo ""
        echo "📊 RESUMEN:"
        echo "  • Archivos mantenidos: ${#KEEP_FILES[@]}"
        echo "  • Archivos eliminados: ${#FILES_TO_DELETE[@]}"
        echo ""
        echo "📁 ESTRUCTURA FINAL:"
        echo "  00_GUIA_INSTALACION_ORIGINAL.md     - Guía de instalación"
        echo "  01_database_structure.sql           - Estructura de base de datos"
        echo "  02_initial_data.sql                 - Datos iniciales"
        echo "  03_reservation_functions.sql        - Funciones de reservas"
        echo "  04_customer_functions.sql           - Funciones de clientes"
        echo "  05_user_management.sql              - Gestión de usuarios"
        echo "  06_storage_and_permissions.sql      - Almacenamiento y permisos"
        echo "  07_complete_vps_setup.sql           - Configuración completa VPS"
        echo "  CONSOLIDATED_DATABASE_ORIGINAL_DESIGN.sql - Todo en un archivo"
        echo "  UPDATE_CONSOLIDATED_WITH_FIXES.sql  - Correcciones para CONSOLIDATED"
        echo ""
        echo "🎯 RECOMENDACIÓN:"
        echo "  1. Ejecutar UPDATE_CONSOLIDATED_WITH_FIXES.sql para corregir CONSOLIDATED"
        echo "  2. Usar CONSOLIDATED_DATABASE_ORIGINAL_DESIGN.sql para instalaciones nuevas"
        echo "  3. Usar archivos 01-07 para instalaciones paso a paso"
        
    else
        echo "❌ Operación cancelada. No se eliminaron archivos."
    fi
else
    echo "✅ No hay archivos basura para eliminar."
fi

echo ""
echo "🏁 Script completado."
