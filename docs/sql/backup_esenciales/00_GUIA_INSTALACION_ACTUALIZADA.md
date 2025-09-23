# 🚀 Guía de Instalación - Sistema de Reservas (ACTUALIZADA)

## ✅ **CORRECCIONES APLICADAS**

Esta versión incluye **todas las correcciones** identificadas y solucionadas:

- ✅ **Estados de reserva correctos:** `confirmed`, `arrived` (no `seated`)
- ✅ **Tipos de datos corregidos:** `SUM()::integer` (no `bigint`)
- ✅ **Función optimizada:** Sin bucles FOR anidados que causaban timeouts
- ✅ **Campos correctos:** `max_diners` (no `max_diners_per_service`)
- ✅ **Error "No se pudo verificar la disponibilidad" SOLUCIONADO**

## 📋 **ARCHIVOS DE INSTALACIÓN**

### **ORDEN DE EJECUCIÓN:**

```bash
1. 01_database_structure.sql      # Estructura de base de datos
2. 02_initial_data.sql           # Datos iniciales (horarios, mesas, etc.)
3. 03_reservation_functions.sql  # Funciones de reservas (CORREGIDAS)
4. 04_customer_functions.sql     # Funciones de clientes
5. 05_user_management.sql        # Gestión de usuarios
6. 06_storage_and_permissions.sql # Permisos y políticas
7. 07_complete_vps_setup.sql     # Configuración completa (OPCIONAL)
```

### **ARCHIVOS OPCIONALES:**

- `08_audit_system.sql` - Sistema de auditoría (solo si necesitas logging)
- `09_audit_reservations.sql` - Auditoría de reservas (solo si necesitas logging)

## 🛠️ **INSTALACIÓN PASO A PASO**

### **OPCIÓN 1: Instalación Completa (Recomendada)**

```sql
-- Ejecutar en orden:
\i 01_database_structure.sql
\i 02_initial_data.sql
\i 03_reservation_functions.sql
\i 04_customer_functions.sql
\i 05_user_management.sql
\i 06_storage_and_permissions.sql
\i 07_complete_vps_setup.sql
```

### **OPCIÓN 2: Instalación Mínima**

```sql
-- Solo archivos esenciales:
\i 01_database_structure.sql
\i 02_initial_data.sql
\i 03_reservation_functions.sql
\i 04_customer_functions.sql
\i 06_storage_and_permissions.sql
```

## 🎯 **FUNCIONES PRINCIPALES CORREGIDAS**

### **1. `get_available_time_slots`**

- ✅ **Sin bucles infinitos** - Optimizada con `RETURN QUERY`
- ✅ **Tipos correctos** - `SUM()::integer` para evitar error bigint
- ✅ **Estados correctos** - Usa `confirmed`, `arrived`
- ✅ **Límite de seguridad** - `LIMIT 100` para evitar timeouts

### **2. `check_diners_limit`**

- ✅ **Campo correcto** - Usa `max_diners` (no `max_diners_per_service`)
- ✅ **Estados correctos** - Cuenta reservas `confirmed`, `arrived`

### **3. `is_table_available`**

- ✅ **Estados correctos** - Verifica conflictos con `confirmed`, `arrived`

### **4. `create_reservation_with_assignment`**

- ✅ **Algoritmo inteligente** - Mesa más pequeña primero, luego combinaciones
- ✅ **Verificaciones completas** - Horarios, límites, disponibilidad

## 🔧 **CONFIGURACIÓN POST-INSTALACIÓN**

### **1. Verificar Instalación**

```sql
-- Verificar que las funciones existen
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'get_available_time_slots',
    'check_diners_limit',
    'is_table_available',
    'create_reservation_with_assignment'
  );
```

### **2. Probar Funcionalidad**

```sql
-- Probar disponibilidad
SELECT * FROM get_available_time_slots(CURRENT_DATE, 2, 90);

-- Verificar límites
SELECT check_diners_limit(CURRENT_DATE, '14:00:00', 2);
```

### **3. Datos Iniciales Incluidos**

- ✅ **Horarios:** Lunes-Jueves 13:30-16:00, Viernes-Sábado comida y cena
- ✅ **Mesas:** 20 mesas con diferentes capacidades
- ✅ **Time slots:** Cada 30 minutos de 13:30 a 23:30
- ✅ **Usuario admin:** admin@admin.es / password

## 🚨 **PROBLEMAS CONOCIDOS SOLUCIONADOS**

### **❌ Error: "No se pudo verificar la disponibilidad"**

**CAUSA:** Función `get_available_time_slots` con bucles infinitos y tipos incorrectos
**SOLUCIÓN:** ✅ Aplicada en `03_reservation_functions.sql`

### **❌ Error: "structure of query does not match function result type"**

**CAUSA:** `SUM()` devuelve `bigint` pero función esperaba `integer`
**SOLUCIÓN:** ✅ Añadido `::integer` cast en las consultas

### **❌ Error: Estados de reserva incorrectos**

**CAUSA:** Funciones buscaban estado `seated` que no existe
**SOLUCIÓN:** ✅ Cambiado a `confirmed`, `arrived`

## 🎉 **RESULTADO FINAL**

Después de la instalación tendrás:

- ✅ **Sistema de reservas completamente funcional**
- ✅ **Frontend mostrando horarios disponibles correctamente**
- ✅ **Asignación automática de mesas optimizada**
- ✅ **Límites de comensales por turno**
- ✅ **Gestión de usuarios y permisos**
- ✅ **Sin errores de disponibilidad**

## 📞 **SOPORTE**

Si encuentras algún problema:

1. **Verificar orden de ejecución** - Los archivos deben ejecutarse en orden
2. **Revisar logs** - Buscar errores específicos en PostgreSQL
3. **Probar funciones** - Usar las consultas de verificación arriba
4. **Limpiar y reinstalar** - Si es necesario, usar `cleanup.sh`

---

**Versión:** Final Corregida  
**Fecha:** Septiembre 2025  
**Estado:** ✅ Todas las correcciones aplicadas
