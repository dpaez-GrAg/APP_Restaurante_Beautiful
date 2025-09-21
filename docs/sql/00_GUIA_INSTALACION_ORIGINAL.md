# Guía de Instalación - Tu Mesa Ideal (DISEÑO ORIGINAL CONSOLIDADO)

## 📋 Resumen

Sistema de reservas "Tu Mesa Ideal" con **diseño original completo** consolidado en un solo archivo. Mantiene exactamente la estructura y funcionalidad de los archivos 01-07 revisados y aprobados.

## 🎯 **NUEVO PROCESO SIMPLIFICADO**

### Paso 1: Crear Consolidación

```bash
# Hacer ejecutable el script
chmod +x docs/sql/CREATE_CONSOLIDATED_ORIGINAL.sh

# Ejecutar consolidación
./docs/sql/CREATE_CONSOLIDATED_ORIGINAL.sh
```

### Paso 2: Aplicar Correcciones Críticas

```bash
# Aplicar correcciones al archivo consolidado
psql -f docs/sql/UPDATE_CONSOLIDATED_WITH_FIXES.sql
```

### Paso 3: Instalar Base de Datos

```bash
# UN SOLO COMANDO - instala todo el sistema corregido
psql -f docs/sql/CONSOLIDATED_DATABASE_ORIGINAL_DESIGN.sql
```

### Paso 4: Variables de Entorno

Crear archivo `.env`:

```env
# App Configuration
VITE_APP_NAME="Tu Mesa Ideal"
VITE_CLIENT_SLUG="demo"
VITE_BRAND_CONFIG_URL="/tenants/demo.json"

# Supabase Configuration - VPS
VITE_SUPABASE_URL="https://tu-dominio-vps.com"
VITE_SUPABASE_ANON_KEY="tu-anon-key-del-vps"

# Feature Flags
VITE_FEATURE_RESERVAS="true"
```

### Paso 5: Aplicar Corrección Frontend

Aplicar el cambio propuesto en `ConfirmationStep.tsx` para corregir la búsqueda de reservas.

### Paso 6: Iniciar Aplicación

```bash
npm run dev
```

## 🔑 Credenciales de Acceso

- **Email:** `admin@admin.es`
- **Contraseña:** `password`
- **URL Admin:** `http://localhost:5173/admin/auth`

## ✅ Verificación

Después de la instalación, verifica que:

- ✅ **Login admin funciona** sin errores
- ✅ **Panel de usuarios** muestra lista correctamente
- ✅ **Crear reservas** desde admin funciona
- ✅ **Formulario público** crea reservas sin errores
- ✅ **Buscar reservas** por teléfono funciona (después de aplicar corrección)

## 🎯 ¿Qué mantiene del diseño original?

### ✅ **Estructura Completa Original:**

#### **Restaurant Config (Completa):**

- `restaurant_name`, `hero_title`, `hero_subtitle`
- `hero_image_url`, `logo_url`
- `contact_phone`, `contact_email`, `contact_address`
- `city`, `state`, `postcode`, `latitude`, `longitude`
- `description`, `is_active`

#### **Mesas (Diseño Completo):**

- `capacity`, `min_capacity`, `max_capacity`, `extra_capacity`
- `position_x`, `position_y` (coordenadas para layout visual)
- `shape` (square, circle, rectangle)
- `is_active`

#### **Combinaciones de Mesas (IMPRESCINDIBLES):**

- `table_ids` (array de UUIDs)
- `total_capacity`, `min_capacity`, `max_capacity`, `extra_capacity`
- Sistema completo de combinaciones predefinidas

#### **Horarios (Sistema Completo):**

- **Regulares:** `restaurant_schedules` por día de semana
- **Especiales:** `special_schedule_days` para excepciones
- **Cerrados:** `special_closed_days` para cierres
- **Límites:** `max_diners` por turno

#### **Clientes (Sistema Avanzado):**

- `classification` (NEUTRO, VIP, ALERTA, RED_FLAG)
- `customer_classification_history` (historial de cambios)
- `notes` para observaciones

#### **Reservas (Completas):**

- **Campo `created_by`** (mantenido del diseño original)
- Estados completos: `pending`, `confirmed`, `seated`, `completed`, `cancelled`, `no_show`
- `special_requests`, `notes`, `duration_minutes`

### ✅ **Datos Iniciales Completos:**

#### **Configuración Rica:**

- Restaurante "La Bella Vista" con datos completos
- Descripción, ubicación, coordenadas GPS
- Contacto completo

#### **Horarios Realistas:**

- Lunes-Jueves: 12:00-23:30
- Viernes-Sábado: 12:00-01:00 (horario extendido)
- Domingo: 13:00-22:00 (horario reducido)

#### **Mesas Diversas:**

- **20 mesas** con diferentes capacidades y formas
- Mesas pequeñas (1-3 personas) - círculos
- Mesas medianas (2-6 personas) - cuadradas
- Mesas grandes (4-10 personas) - rectangulares
- Salas privadas (8-15 personas)
- Barra (6 asientos individuales)

#### **Combinaciones Predefinidas:**

- Romántica (Mesas 1+2)
- Familiar (Mesas 6+7)
- Evento Grande (Mesas 10+11+12)
- Área VIP Completa

#### **Time Slots Completos:**

- Almuerzo: 12:00-16:30 (cada 30 min)
- Cena: 19:00-23:00 (cada 30 min)
- Cena tardía: 23:30-00:30 (fines de semana)

#### **Clientes de Ejemplo:**

- 10 clientes con datos completos
- Nombres, emails, teléfonos españoles realistas

### ✅ **Funciones Originales Completas:**

#### **Gestión de Usuarios:**

- `admin_get_users()` - Lista usuarios
- `admin_create_user()` - Crea usuarios
- `admin_update_user()` - Actualiza usuarios
- `admin_delete_user()` - Elimina usuarios

#### **Gestión de Reservas:**

- `create_customer_optional_email()` - Crea/actualiza clientes
- `admin_create_reservation()` - Crea reservas desde admin
- `admin_get_reservations()` - Lista reservas con filtros
- `admin_update_reservation_status()` - Cambia estados
- `admin_cancel_reservation()` - Cancela reservas

#### **Sistema de Disponibilidad:**

- `get_available_time_slots()` - Slots disponibles
- `api_check_availability()` - API de disponibilidad
- `create_reservation_with_assignment()` - Asignación automática
- `create_reservation_with_specific_tables()` - Asignación específica
- `check_diners_limit()` - Verifica límites de comensales
- `is_table_available()` - Disponibilidad de mesa

## 🔧 Diferencias con el Archivo 10

| Aspecto               | Archivo 10 (Simplificado)       | Diseño Original (01-07)            |
| --------------------- | ------------------------------- | ---------------------------------- |
| **Restaurant Config** | Solo `name`, `max_advance_days` | 13 campos completos                |
| **Mesas**             | Solo `name`, `capacity`         | 9 campos con posiciones/formas     |
| **Combinaciones**     | ✅ Implementadas                | ✅ Completas con capacidades extra |
| **Horarios**          | Básicos                         | Sistema completo con especiales    |
| **Clientes**          | Email opcional                  | Sistema completo con clasificación |
| **Reservas**          | Sin `created_by`                | ✅ Con `created_by`                |
| **Estados**           | Solo `confirmed`, `seated`      | 6 estados completos                |
| **Datos**             | 6 mesas básicas                 | 20 mesas + combinaciones           |
| **Time Slots**        | Cada 15 min básico              | Sistema completo almuerzo/cena     |

## 🛠️ Solución de Problemas

### Si el script de consolidación falla:

1. Verificar que todos los archivos 01-07 existen
2. Permisos de ejecución: `chmod +x CREATE_CONSOLIDATED_ORIGINAL.sh`
3. Ejecutar desde el directorio correcto

### Si la instalación falla:

1. Verificar conexión a PostgreSQL
2. Verificar permisos de usuario de BD
3. Revisar logs de PostgreSQL para errores específicos

### Si la búsqueda de reservas falla:

1. Aplicar la corrección en `ConfirmationStep.tsx`
2. Estados correctos: `pending`, `confirmed`, `seated`
3. Sin referencia a tabla `restaurants`

## 📁 Archivos Finales

**DESPUÉS de ejecutar el script:**

### ✅ **Archivos Esenciales:**

- `CONSOLIDATED_DATABASE_ORIGINAL_DESIGN.sql` - **ARCHIVO PRINCIPAL**
- `00_GUIA_INSTALACION_ORIGINAL.md` - Esta documentación
- `CREATE_CONSOLIDATED_ORIGINAL.sh` - Script de consolidación
- `UPDATE_CONSOLIDATED_WITH_FIXES.sql` - Correcciones críticas

### ✅ **Archivos Originales (Mantener como referencia):**

- `01_database_structure.sql` - `07_complete_vps_setup.sql`

### ❌ **Archivos Obsoletos (Pueden eliminarse):**

- `10_DATABASE_CLEAN_FINAL.sql` - Versión simplificada
- `CLEAN_BEFORE_FINAL.sql` - Script de limpieza
- Otros archivos de corrección temporal

## 🚀 Próximos Pasos

Una vez que todo funcione:

1. **Personalizar configuración** - Cambiar datos del restaurante
2. **Configurar mesas reales** - Ajustar layout según espacio físico
3. **Ajustar horarios** - Según operación real del restaurante
4. **Crear usuarios adicionales** - Staff del restaurante
5. **Configurar dominio VPS** - Variables de entorno de producción
6. **Backup automático** - Programar copias de seguridad

## 🏆 Estado del Sistema

**✅ DISEÑO ORIGINAL COMPLETO MANTENIDO**

- Estructura: ✅ Exactamente como archivos 01-07
- Funcionalidad: ✅ Todas las funciones originales
- Datos: ✅ Datos iniciales completos y realistas
- Frontend: ✅ Compatible (con corrección aplicada)
- Instalación: ✅ Simplificada a un solo archivo

**Credenciales:** `admin@admin.es` / `password`  
**Instalación:**

1. `./CREATE_CONSOLIDATED_ORIGINAL.sh`
2. `psql -f UPDATE_CONSOLIDATED_WITH_FIXES.sql`
3. `psql -f CONSOLIDATED_DATABASE_ORIGINAL_DESIGN.sql`
4. Aplicar corrección frontend
5. `npm run dev`

**Resultado:** Sistema 100% funcional con diseño original completo
