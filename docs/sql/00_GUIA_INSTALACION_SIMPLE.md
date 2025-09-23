# GUÍA DE INSTALACIÓN SIMPLE - TU MESA IDEAL

## Sistema de Reservas de Restaurante

### 📋 ARCHIVOS DE INSTALACIÓN

**INSTALACIÓN COMPLETA (7 archivos):**

1. `01_database_structure.sql` - Estructura de tablas
2. `02_initial_data.sql` - Datos iniciales
3. `03_reservation_functions.sql` - Funciones de reservas
4. `04_customer_functions.sql` - Funciones de clientes
5. `05_user_management.sql` - Sistema de usuarios
6. `06_storage_and_permissions.sql` - Políticas y permisos
7. `07_complete_vps_setup.sql` - Configuración final

**SISTEMA DE AUDITORÍA (opcional):**

- `08_audit_system.sql` - Sistema de auditoría
- `09_audit_reservations.sql` - Auditoría de reservas

### 🚀 INSTALACIÓN EN 3 PASOS

#### PASO 1: Crear Base de Datos

```sql
CREATE DATABASE tu_mesa_ideal;
\c tu_mesa_ideal;
```

#### PASO 2: Ejecutar Archivos en Orden

```bash
\i 01_database_structure.sql
\i 02_initial_data.sql
\i 03_reservation_functions.sql
\i 04_customer_functions.sql
\i 05_user_management.sql
\i 06_storage_and_permissions.sql
\i 07_complete_vps_setup.sql
```

#### PASO 3: Verificar Instalación

```sql
-- Verificar usuario admin
SELECT email, role FROM profiles WHERE email = 'admin@admin.es';

-- Verificar funciones críticas
SELECT proname FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND proname IN ('create_reservation_with_assignment', 'admin_create_reservation');
```

### 🔧 CONFIGURACIÓN FRONTEND

#### Variables de Entorno (.env)

```env
VITE_SUPABASE_URL="http://127.0.0.1:54321"
VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
VITE_APP_NAME="Tu Mesa Ideal"
VITE_FEATURE_RESERVAS="true"
```

#### Credenciales Iniciales

```
Email: admin@admin.es
Contraseña: password
```

### ✅ FUNCIONALIDADES INCLUIDAS

- ✅ Sistema de reservas completo
- ✅ Asignación automática de mesas
- ✅ Panel de administración
- ✅ Gestión de usuarios (admin/user)
- ✅ Sistema de clasificación de clientes
- ✅ Configuración de horarios y capacidades
- ✅ Frontend React + Supabase

### 🎯 SISTEMA LISTO PARA PRODUCCIÓN

**Sin correcciones adicionales necesarias**  
**Sin archivos de parches**  
**Instalación limpia en 7 pasos**

---

**Versión:** Simple y Directa  
**Estado:** ✅ Probado y funcionando
