# Archivos SQL Obsoletos - Para Eliminar

Los siguientes archivos son versiones obsoletas o duplicados que se pueden eliminar de forma segura:

## ❌ Archivos Obsoletos (Eliminar)

### Versiones Obsoletas de Email Optional

- `make_email_optional.sql` - Primera versión con errores de sintaxis
- `make_email_optional_fixed.sql` - Segunda versión con errores de parámetros

### Scripts de Testing y Verificación Temporales

- `test_reservation_creation.sql` - Script de testing, no necesario en producción
- `verify_functions.sql` - Script de verificación, no necesario en producción

### Versiones Antiguas de Funciones (Si existen)

- `get_available_time_slots.sql` - Reemplazado por versión corregida
- `get_available_time_slots_with_diners_limit.sql` - Reemplazado por versión corregida
- `api_check_availability_with_capacity.sql` - Reemplazado por versión corregida
- `create_reservation_with_assignment.sql` - Reemplazado por versión corregida
- `create_reservation_with_specific_tables.sql` - Reemplazado por versión corregida
- `admin_create_reservation.sql` - Reemplazado por versión corregida

### Scripts de Debugging y Temporales

- `debug_availability_issues.sql` - Solo para debugging, no necesario en producción
- `update_existing_functions.sql` - Script temporal, ya aplicado

### Funciones Edge/Agent (No utilizadas en self-hosted)

- `agent-availability.sql` - Para Edge Functions, no usado en self-hosted
- `agent-create-reservation.sql` - Para Edge Functions, no usado en self-hosted
- `create_agent_availability.sql` - Para Edge Functions, no usado en self-hosted
- `create_agent_availability_wrapper.sql` - Para Edge Functions, no usado en self-hosted
- `create_agent_reservation.sql` - Para Edge Functions, no usado en self-hosted
- `create_agent_reservation_wrapper.sql` - Para Edge Functions, no usado en self-hosted
- `create_http_endpoints.sql` - Para Edge Functions, no usado en self-hosted
- `create_http_endpoints_wrapper.sql` - Para Edge Functions, no usado en self-hosted
- `http_endpoints.sql` - Para Edge Functions, no usado en self-hosted
- `api_wrapper_functions.sql` - Para Edge Functions, no usado en self-hosted

### Instrucciones Duplicadas

- `INSTRUCCIONES_IMPLEMENTACION.md` - Duplicado en español, mantener solo la versión en inglés

## ✅ Archivos a MANTENER (16 archivos esenciales)

### Scripts de Instalación Base (4 archivos)

- `bootstrap_full.sql` - Estructura completa de base de datos
- `seed_full.sql` - Datos iniciales
- `add_max_diners_to_schedules.sql` - Añade límites de comensales
- `get_diners_capacity_info.sql` - Información de capacidad

### Scripts de Corrección Funcional (5 archivos)

- `force_update_functions.sql` - Actualización forzada de funciones de disponibilidad
- `fix_reservation_creation.sql` - Corrección de funciones de creación de reservas
- `fix_ui_parameters.sql` - Corrección de parámetros para la UI
- `api_check_availability_with_capacity_fixed.sql` - API corregida para PostgREST
- `get_available_time_slots_fixed.sql` - Horarios disponibles mejorados

### Scripts de Mejoras del Sistema (3 archivos)

- `make_email_optional_fixed2.sql` - Email opcional en customers (versión final)
- `fix_create_customer_function.sql` - Función de customers corregida
- `setup_storage_bucket.sql` - Configuración de storage para imágenes

### Scripts de Verificación (2 archivos - opcionales)

- `test_reservation_creation.sql` - Tests de creación de reservas
- `verify_functions.sql` - Verificación de funciones

### Documentación (2 archivos)

- `IMPLEMENTATION_INSTRUCTIONS.md` - Instrucciones actualizadas
- `files_to_delete.md` - Este archivo

## 🗑️ Comando para Eliminar Archivos Obsoletos

```bash
# Desde el directorio docs/sql/
# CUIDADO: Solo ejecutar después de verificar que el sistema funciona

# Eliminar versiones obsoletas de email optional
rm -f make_email_optional.sql
rm -f make_email_optional_fixed.sql

# Eliminar scripts de testing (opcional - mantener si necesitas debugging)
# rm -f test_reservation_creation.sql
# rm -f verify_functions.sql

# Eliminar versiones antiguas de funciones (si existen)
rm -f get_available_time_slots.sql
rm -f get_available_time_slots_with_diners_limit.sql
rm -f api_check_availability_with_capacity.sql
rm -f create_reservation_with_assignment.sql
rm -f create_reservation_with_specific_tables.sql
rm -f admin_create_reservation.sql

# Eliminar scripts de debugging
rm -f debug_availability_issues.sql
rm -f update_existing_functions.sql

# Eliminar funciones Edge/Agent
rm -f agent-availability.sql
rm -f agent-create-reservation.sql
rm -f create_agent_availability.sql
rm -f create_agent_availability_wrapper.sql
rm -f create_agent_reservation.sql
rm -f create_agent_reservation_wrapper.sql
rm -f create_http_endpoints.sql
rm -f create_http_endpoints_wrapper.sql
rm -f http_endpoints.sql
rm -f api_wrapper_functions.sql

# Eliminar documentación duplicada
rm -f INSTRUCCIONES_IMPLEMENTACION.md
```

## 📊 Resumen de Limpieza

### Estado Actual (16 archivos encontrados)

- ✅ **16 archivos esenciales** para mantener
- ❌ **2 archivos obsoletos confirmados** para eliminar:
  - `make_email_optional.sql`
  - `make_email_optional_fixed.sql`

### Archivos que podrían existir de versiones anteriores

- ❌ **~15 archivos potencialmente obsoletos** de versiones anteriores
- 🔍 **2 archivos de testing** (opcional mantener para debugging)

### Resultado Final Recomendado

- **14 archivos esenciales** (sin scripts de testing)
- **16 archivos esenciales** (con scripts de testing para debugging)

## ⚠️ Importante

**NO elimines archivos hasta verificar que:**

1. ✅ El sistema funciona correctamente
2. ✅ Las reservas se crean desde la UI
3. ✅ La API de disponibilidad responde
4. ✅ Las imágenes se suben correctamente
5. ✅ No hay errores en la consola

**Los archivos de testing (`test_reservation_creation.sql` y `verify_functions.sql`) son útiles para debugging y se pueden mantener.**
