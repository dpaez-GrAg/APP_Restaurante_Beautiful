# Instrucciones de Implementación - Sistema de Reservas Supabase Self-hosted

## 🚀 Implementación Completa (Orden Actualizado)

Ejecuta los siguientes archivos SQL en tu Supabase self-hosted **en este orden exacto**:

### 1. Instalación Base

```sql
-- 1. Crear estructura completa de base de datos
\i docs/sql/bootstrap_full.sql

-- 2. Insertar datos iniciales
\i docs/sql/seed_full.sql
```

### 2. Mejoras de Capacidad

```sql
-- 3. Añadir campos de límite de comensales por turno
\i docs/sql/add_max_diners_to_schedules.sql

-- 4. Crear funciones de información de capacidad
\i docs/sql/get_diners_capacity_info.sql
```

### 3. Funciones Corregidas (CRÍTICO)

```sql
-- 5. Actualizar funciones de disponibilidad (CORRIGE PROBLEMAS)
\i docs/sql/force_update_functions.sql

-- 6. Corregir funciones de creación de reservas (CORRIGE PROBLEMAS)
\i docs/sql/fix_reservation_creation.sql

-- 7. Corregir parámetros para la UI (CRÍTICO PARA UI)
\i docs/sql/fix_ui_parameters.sql

-- 8. API corregida para PostgREST (CORRIGE PROBLEMAS)
\i docs/sql/api_check_availability_with_capacity_fixed.sql
```

### 4. Configuración de Email Opcional y Storage

```sql
-- 9. Hacer email opcional en customers (MEJORA UX)
\i docs/sql/make_email_optional_fixed2.sql

-- 10. Corregir función de creación de customers (CRÍTICO)
\i docs/sql/fix_create_customer_function.sql

-- 11. Configurar storage para imágenes del restaurante
\i docs/sql/setup_storage_bucket_fixed.sql
```

### 5. Funciones de Horarios Mejoradas

```sql
-- 12. Función mejorada de horarios disponibles
\i docs/sql/get_available_time_slots_fixed.sql
```

### 6. Sistema de Clasificación de Clientes (NUEVO)

```sql
-- 13. Sistema completo de clasificación de clientes
\i docs/sql/add_customer_classification_system.sql
```

## ✅ Verificación de Instalación

Después de ejecutar todos los scripts, verifica que todo funciona:

```sql
-- 1. Verificar que las funciones principales se crearon correctamente
SELECT proname, proargnames
FROM pg_proc
WHERE proname IN (
  'get_available_time_slots',
  'create_reservation_with_assignment',
  'create_reservation_with_specific_tables',
  'create_customer_optional_email',
  'api_check_availability_with_capacity',
  'api_check_availability',
  'get_diners_capacity_info',
  'is_table_available',
  'check_diners_limit',
  'update_customer_classification',
  'get_customers_with_stats',
  'get_customer_classification_history'
);

-- 2. Verificar bucket de storage
SELECT id, name, public, file_size_limit
FROM storage.buckets
WHERE name = 'restaurant-images';

-- 3. Verificar sistema de clasificación de clientes
SELECT 'CLASIFICACIÓN DE CLIENTES' as sistema,
       COUNT(*) as total_customers,
       COUNT(CASE WHEN classification = 'VIP' THEN 1 END) as vip_customers,
       COUNT(CASE WHEN classification = 'NEUTRO' THEN 1 END) as neutro_customers,
       COUNT(CASE WHEN classification = 'ALERTA' THEN 1 END) as alerta_customers,
       COUNT(CASE WHEN classification = 'RED_FLAG' THEN 1 END) as red_flag_customers
FROM customers;

-- 4. Probar función de disponibilidad
SELECT * FROM get_available_time_slots('2025-01-20', 4, 90);

-- 5. Probar API de disponibilidad
SELECT * FROM api_check_availability_with_capacity('2025-01-20', 4, 90);

-- 6. Probar creación de customer sin email
SELECT create_customer_optional_email('Test User', '123456789', null);

-- 7. Probar función de clientes con estadísticas
SELECT * FROM get_customers_with_stats(null, null, 'name', 10, 0);
```

## 🔧 Configuración Post-Instalación

### 1. Configurar Límites de Comensales

- Ve a Admin → Configuración del calendario
- Establece límites máximos de comensales por turno (opcional)

### 2. Verificar Horarios

- Configura horarios de apertura/cierre
- Define turnos de comida y cena si es necesario

### 3. Configurar Imágenes del Restaurante

- Ve a Admin → Configuración del Restaurante
- Sube logo e imagen de fondo (máximo 5MB)

### 4. Gestionar Clasificación de Clientes

- Ve a Admin → Clientes
- Clasifica a tus clientes existentes
- Los colores aparecerán automáticamente en el timeline de reservas

## 📡 Endpoints API Disponibles

### Verificar Disponibilidad con Capacidad

```bash
curl -X POST "https://api.restaurante1.gridded.agency/rest/v1/rpc/api_check_availability_with_capacity" \
  -H "Content-Type: application/json" \
  -H "apikey: TU_ANON_KEY" \
  -d '{
    "p_date": "2025-01-20",
    "p_guests": 4,
    "p_duration_minutes": 90
  }'
```

### Crear Reserva con Asignación Automática

```bash
curl -X POST "https://api.restaurante1.gridded.agency/rest/v1/rpc/create_reservation_with_assignment" \
  -H "Content-Type: application/json" \
  -H "apikey: TU_ANON_KEY" \
  -d '{
    "p_customer_id": "uuid-del-cliente",
    "p_date": "2025-01-20",
    "p_time": "20:00",
    "p_guests": 4,
    "p_special_requests": "Mesa junto a la ventana",
    "p_duration_minutes": 90
  }'
```

### Obtener Clientes con Estadísticas

```bash
curl -X POST "https://api.restaurante1.gridded.agency/rest/v1/rpc/get_customers_with_stats" \
  -H "Content-Type: application/json" \
  -H "apikey: TU_ANON_KEY" \
  -d '{
    "p_search": null,
    "p_classification": null,
    "p_order_by": "name",
    "p_limit": 50,
    "p_offset": 0
  }'
```

### Actualizar Clasificación de Cliente

```bash
curl -X POST "https://api.restaurante1.gridded.agency/rest/v1/rpc/update_customer_classification" \
  -H "Content-Type: application/json" \
  -H "apikey: TU_ANON_KEY" \
  -d '{
    "p_customer_id": "uuid-del-cliente",
    "p_new_classification": "VIP",
    "p_notes": "Cliente frecuente y excelente comportamiento",
    "p_changed_by": "uuid-del-usuario"
  }'
```

## 🔍 Funciones Implementadas

### ✅ Funciones de Disponibilidad

- **`get_available_time_slots`** - Obtiene horarios disponibles considerando reservas existentes
- **`api_check_availability`** - API wrapper para verificar disponibilidad
- **`api_check_availability_with_capacity`** - API con información de límites de comensales
- **`is_table_available`** - Verifica si una mesa está disponible en un horario específico

### ✅ Funciones de Creación de Reservas

- **`create_reservation_with_assignment`** - Crea reservas con asignación automática de mesas
- **`create_reservation_with_specific_tables`** - Crea reservas con mesas específicas
- **`admin_create_reservation`** - Función administrativa para crear reservas
- **`create_customer_optional_email`** - Crea customers con email opcional

### ✅ Funciones de Clasificación de Clientes (NUEVO)

- **`update_customer_classification`** - Actualiza clasificación con historial automático
- **`get_customers_with_stats`** - Obtiene clientes con estadísticas de reservas
- **`get_customer_classification_history`** - Historial de cambios de clasificación

### ✅ Funciones Auxiliares

- **`check_diners_limit`** - Verifica límites de comensales por turno
- **`get_diners_capacity_info`** - Obtiene información de capacidad de comensales

### ✅ Configuración de Storage

- **Bucket `restaurant-images`** - Para logos e imágenes de fondo
- **Políticas RLS** - Acceso público para lectura, autenticado para escritura

## 🚨 Problemas Resueltos

### ✅ Disponibilidad Incorrecta

**Problema**: La API mostraba disponibilidad aunque las mesas estuvieran ocupadas.
**Solución**: `force_update_functions.sql` corrige la lógica de verificación de reservas existentes.

### ✅ Error al Crear Reservas desde UI

**Problema**: La UI mostraba disponibilidad pero fallaba al crear reservas.
**Solución**: `fix_ui_parameters.sql` y `fix_reservation_creation.sql` sincronizan la lógica.

### ✅ Error PostgREST de Parámetros

**Problema**: `"Could not find the function public.api_check_availability(date, duration_minutes, guests)"`
**Solución**: `api_check_availability_with_capacity_fixed.sql` usa nombres de parámetros con prefijo `p_`.

### ✅ Email Obligatorio en Customers

**Problema**: El campo email era obligatorio causando errores en la UI.
**Solución**: `make_email_optional_fixed2.sql` y `fix_create_customer_function.sql` hacen el email opcional.

### ✅ Error de Storage para Imágenes

**Problema**: No se podían subir imágenes del restaurante.
**Solución**: `setup_storage_bucket_fixed.sql` configura el bucket y políticas correctamente.

### ✅ Límite de Reservas

**Problema**: Los usuarios podían reservar con mucha antelación.
**Solución**: UI limitada a 2 semanas de antelación máximo.

### ✅ Gestión de Clientes (NUEVO)

**Problema**: No había forma de clasificar y gestionar clientes.
**Solución**: Sistema completo de clasificación con 4 niveles, historial y colores en timeline.

## 🛠️ Solución de Problemas

### Error: "function does not exist"

- Verifica que ejecutaste los archivos en el orden correcto
- Ejecuta `force_update_functions.sql` y `fix_reservation_creation.sql`

### Error: "permission denied"

- Las funciones usan `SECURITY DEFINER` automáticamente
- Verifica que tu usuario tiene permisos de administrador

### Error: "cannot change return type"

- Los scripts incluyen `DROP FUNCTION IF EXISTS` para evitar este error
- Si persiste, ejecuta manualmente los DROP antes de cada función

### Error: "No se pudo crear el cliente"

- Ejecuta `fix_create_customer_function.sql` para corregir la función de customers
- Verifica que el email sea opcional en la tabla customers

### Error al subir imágenes

- Ejecuta `setup_storage_bucket_fixed.sql` para configurar el storage
- Verifica que estás autenticado en el panel de administración

### Error: "customer_classification does not exist"

- Ejecuta `add_customer_classification_system.sql` para crear el sistema de clasificación
- Verifica que el enum `customer_classification` se creó correctamente

## 📋 Archivos Finales Necesarios

### Scripts de Instalación (4 archivos)

1. `bootstrap_full.sql` - Estructura de base de datos
2. `seed_full.sql` - Datos iniciales
3. `add_max_diners_to_schedules.sql` - Límites de comensales
4. `get_diners_capacity_info.sql` - Información de capacidad

### Scripts de Corrección (5 archivos)

5. `force_update_functions.sql` - Funciones de disponibilidad corregidas
6. `fix_reservation_creation.sql` - Funciones de creación corregidas
7. `fix_ui_parameters.sql` - Parámetros corregidos para UI
8. `api_check_availability_with_capacity_fixed.sql` - API corregida
9. `get_available_time_slots_fixed.sql` - Horarios disponibles mejorados

### Scripts de Mejoras (4 archivos)

10. `make_email_optional_fixed2.sql` - Email opcional en customers
11. `fix_create_customer_function.sql` - Función de customers corregida
12. `setup_storage_bucket_fixed.sql` - Configuración de storage para imágenes
13. `add_customer_classification_system.sql` - Sistema de clasificación de clientes

### Scripts de Verificación (2 archivos)

14. `test_reservation_creation.sql` - Tests de creación de reservas
15. `verify_functions.sql` - Verificación de funciones

### Documentación (2 archivos)

16. `IMPLEMENTATION_INSTRUCTIONS.md` - Este archivo
17. `files_to_delete.md` - Lista de archivos obsoletos

**Total: 17 archivos esenciales** para un sistema completamente funcional.

## 🎯 Estado Actual del Sistema

✅ **Disponibilidad**: Funciona correctamente, considera reservas existentes
✅ **Creación de Reservas**: Funciona desde UI y API
✅ **Email Opcional**: Los customers no requieren email
✅ **Storage de Imágenes**: Configurado para logos e imágenes de fondo
✅ **Límite de Antelación**: Máximo 2 semanas para reservas
✅ **API PostgREST**: Parámetros corregidos con prefijo `p_`
✅ **Validaciones**: Límites de comensales por turno
✅ **Asignación de Mesas**: Automática y manual disponible
✅ **Clasificación de Clientes**: Sistema completo con 4 niveles y colores en timeline
✅ **Gestión de Clientes**: Página dedicada con filtros y scroll infinito
✅ **Historial de Cambios**: Auditoría completa de clasificaciones

## 🆕 Nuevas Funcionalidades - Sistema de Clientes

### 🎨 **Clasificaciones Disponibles:**

- **VIP** (Dorado): Clientes premium
- **NEUTRO** (Gris): Clientes normales (por defecto)
- **ALERTA** (Naranja): Clientes que requieren atención
- **RED FLAG** (Rojo): Clientes problemáticos

### 📊 **Características del Sistema:**

- **Lista minimalista** con nombre y código de color
- **Filtros avanzados** por nombre, teléfono y clasificación
- **Scroll infinito** para grandes volúmenes de clientes
- **Modal de detalle** con información completa
- **Historial de cambios** con auditoría completa
- **Integración visual** en timeline de reservas
- **Tooltips informativos** en toda la interfaz

### 🔗 **Navegación Integrada:**

- **Acceso desde Admin** → Clientes
- **Click en nombres** de clientes en reservas → Detalle completo
- **Colores automáticos** en timeline según clasificación

**¡Sistema completamente funcional con gestión avanzada de clientes!**
