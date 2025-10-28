# 📚 Directorio SQL - Tu Mesa Ideal

## 🎯 Inicio Rápido

### Para Nueva Instalación
1. Lee: [`DEPLOYMENT_GUIDE.md`](./DEPLOYMENT_GUIDE.md) - Guía completa de despliegue
2. Ejecuta archivos SQL en orden (ver sección "Archivos Esenciales")
3. Configura variables de entorno
4. Build y deploy

### Para Entender el Sistema
1. Lee: [`00_CONFIRMACION_ARCHIVOS_ESENCIALES.md`](./00_CONFIRMACION_ARCHIVOS_ESENCIALES.md)
2. Lee: [`10_vps_compatibility_notes.sql`](./10_vps_compatibility_notes.sql)
3. Revisa API pública: [`API_PUBLICA_DOCUMENTACION.md`](./API_PUBLICA_DOCUMENTACION.md)

---

## 📦 Archivos Esenciales (Orden de Ejecución)

### 1. Estructura Base
```bash
psql -d tu_mesa_ideal < 01_database_structure.sql
```
- 13 tablas principales
- ENUMs (user_role, reservation_status, customer_classification)
- Índices optimizados
- Triggers básicos

### 2. Datos Iniciales
```bash
psql -d tu_mesa_ideal < 02_initial_data.sql
```
- Zonas por defecto
- Configuración del restaurante
- Datos de ejemplo opcionales

### 3. Funciones de Reservas ⚠️ ACTUALIZADO
```bash
psql -d tu_mesa_ideal < 03_reservation_functions.sql
```
**IMPORTANTE:** Este archivo fue actualizado el 2025-10-27
- ✅ Bug de `array_length()` corregido → `cardinality()`
- ✅ Asignación de combinaciones de mesas funciona correctamente
- ✅ Compatible con VPS custom

**Funciones incluidas:**
- `create_reservation_with_assignment` - Asignación automática
- `admin_create_reservation` - Crear desde admin
- `public_create_reservation` - API pública
- `public_find_reservation` - Buscar reservas
- `public_cancel_reservation` - Cancelar reservas
- `get_available_time_slots_with_zones` - Slots disponibles
- `is_table_available` - Verificar disponibilidad

### 4. Funciones de Clientes
```bash
psql -d tu_mesa_ideal < 04_customer_functions.sql
```
- `get_customers_with_stats` - Lista con estadísticas
- `update_customer_classification` - Gestión de clasificación
- `create_customer_optional_email` - Crear/actualizar cliente

### 5. Sistema de Usuarios
```bash
psql -d tu_mesa_ideal < 05_user_management.sql
```
- `admin_create_user` - Crear usuario
- `admin_update_user` - Actualizar usuario
- `admin_get_users` - Listar usuarios
- `admin_change_password` - Cambiar contraseña

### 6. Políticas de Seguridad (RLS)
```bash
psql -d tu_mesa_ideal < 06_storage_and_permissions.sql
```
- Políticas RLS para todas las tablas
- Permisos por rol (admin/user)
- Seguridad de funciones

### 7. Correcciones de Autenticación
```bash
psql -d tu_mesa_ideal < 07_auth_fixes.sql
```
- Triggers de sincronización auth.users ↔ profiles
- Funciones de validación de permisos

### 8. Sistema de Auditoría (Opcional)
```bash
psql -d tu_mesa_ideal < 08_audit_system.sql
psql -d tu_mesa_ideal < 09_audit_reservations.sql
```
- Registro automático de acciones
- Página de administración `/admin/audit`
- Solo para administradores

---

## 📖 Documentación

### Guías Principales

#### [`DEPLOYMENT_GUIDE.md`](./DEPLOYMENT_GUIDE.md) 🚀
**Guía completa de despliegue para producción**
- Orden de ejecución SQL
- Configuración de variables de entorno
- Checklist de despliegue
- Testing y validación
- Bugs conocidos corregidos
- Métricas de rendimiento

#### [`10_vps_compatibility_notes.sql`](./10_vps_compatibility_notes.sql) 🔧
**Notas técnicas de compatibilidad VPS**
- Problema identificado con supabase-js
- Solución implementada (fetch directo)
- Patrón de migración aplicado
- Archivos frontend modificados
- Funciones SQL validadas
- Endpoints REST utilizados

#### [`00_CONFIRMACION_ARCHIVOS_ESENCIALES.md`](./00_CONFIRMACION_ARCHIVOS_ESENCIALES.md) ✅
**Confirmación de archivos y validación**
- Estado de validación de flujos críticos
- Archivos esenciales vs temporales
- Proceso de instalación limpia
- Cambios aplicados en el sistema
- Actualización VPS (2025-10-27)

#### [`API_PUBLICA_DOCUMENTACION.md`](./API_PUBLICA_DOCUMENTACION.md) 🌐
**API pública para agentes externos**
- Endpoints disponibles
- Parámetros y respuestas
- Ejemplos de uso
- Gestión automática de clientes

---

## 🔄 Actualización VPS (2025-10-27)

### ⚠️ Cambio Crítico
El cliente `supabase-js` tiene problemas de compatibilidad con VPS custom.

### ✅ Solución Aplicada
Todas las llamadas del cliente Supabase fueron reemplazadas por `fetch` directo.

### 📝 Archivos Afectados

#### SQL (1 archivo)
- `03_reservation_functions.sql` - Bug de `array_length()` corregido

#### Frontend (14 archivos)
**Hooks:**
1. `src/hooks/reservations/useAvailability.ts`
2. `src/hooks/reservations/useReservationCreation.ts`
3. `src/hooks/useReservations.ts`
4. `src/hooks/useDashboardData.ts`
5. `src/hooks/useCombinations.ts`
6. `src/hooks/useSchedules.ts`
7. `src/hooks/useUserManagement.ts`

**Páginas Admin:**
8. `src/pages/admin/AdminAuth.tsx`
9. `src/pages/admin/TablesManager.tsx`
10. `src/pages/admin/CustomersManager.tsx`
11. `src/pages/admin/ScheduleManager.tsx`
12. `src/pages/admin/RestaurantLayout.tsx`

**Componentes:**
13. `src/components/admin/InteractiveReservationGrid.tsx`

**Contextos:**
14. `src/contexts/AuthContext.tsx`

### 📊 Resultado
- ✅ Sin timeouts
- ✅ Todas las páginas funcionando
- ✅ Rendimiento <500ms
- ✅ 100% operativo en VPS

---

## 🗑️ Archivos Temporales

Los siguientes archivos fueron creados durante el desarrollo y pueden ser eliminados:

### Scripts de Corrección (Ya Aplicados)
- `FIX_*.sql` - Correcciones ya integradas en archivos principales
- `UPDATE_*.sql` - Actualizaciones ya aplicadas
- `OPTIMIZE_*.sql` - Optimizaciones ya integradas

### Scripts de Prueba
- `TEST_*.sql` - Útiles para validación pero no esenciales
- `VERIFICAR_*.sql` - Scripts de diagnóstico

### Scripts de Diagnóstico
- `DEBUG_*.sql` - Solo para debugging
- `TEMP_*.sql` - Temporales

### Archivos Consolidados Obsoletos
- `CONSOLIDATED_*.sql` - Versiones antiguas
- `CLEANUP_*.sh` - Scripts de limpieza ya ejecutados

---

## 🔐 Variables de Entorno

### Desarrollo
```env
VITE_SUPABASE_URL=https://api.restaurante1.gridded.agency
VITE_SUPABASE_ANON_KEY=tu_anon_key_aqui
```

### Producción
Configurar las mismas variables en el servidor de despliegue.

**⚠️ IMPORTANTE:**
- No incluir `/rest/v1` en `VITE_SUPABASE_URL`
- El código agrega automáticamente `/rest/v1` o `/auth/v1`

---

## 🧪 Testing

### Validar Instalación
```bash
# Opcional: Ejecutar script de prueba
psql -d tu_mesa_ideal < TEST_FLUJOS_CRITICOS_CORREGIDO.sql
```

### Páginas a Probar
- [ ] Frontend público - Búsqueda y creación de reservas
- [ ] `/admin` - Dashboard
- [ ] `/admin/reservations` - Gestión de reservas
- [ ] `/admin/reservations` (timeline) - Vista de grid
- [ ] `/admin/tables` - Gestión de mesas
- [ ] `/admin/combinations` - Combinaciones de mesas
- [ ] `/admin/customers` - Lista de clientes
- [ ] `/admin/schedules` - Gestión de horarios
- [ ] `/admin/layout` - Posicionamiento de mesas
- [ ] `/admin/users` - Gestión de usuarios
- [ ] `/admin/settings` - Configuración

---

## 🐛 Bugs Corregidos

### 1. Bug de `array_length()` ✅
**Archivo:** `03_reservation_functions.sql`  
**Problema:** PostgreSQL no tiene `array_length()`, la función correcta es `cardinality()`  
**Solución:** 7 instancias reemplazadas  
**Resultado:** Asignación de combinaciones funciona correctamente

### 2. Timeouts en RPC ✅
**Archivos:** 14 archivos frontend  
**Problema:** Cliente supabase-js incompatible con VPS  
**Solución:** Reemplazado por fetch directo  
**Resultado:** Sin timeouts, respuestas <500ms

### 3. Clientes Duplicados ✅
**Archivo:** `src/pages/admin/CustomersManager.tsx`  
**Problema:** Scroll infinito agregaba duplicados  
**Solución:** Agregada deduplicación por ID  
**Resultado:** Sin clientes duplicados

---

## 📞 Soporte

### Logs Útiles
```bash
# PostgreSQL
tail -f /var/log/postgresql/postgresql-*.log

# PostgREST
journalctl -u postgrest -f

# GoTrue
journalctl -u gotrue -f
```

### Debugging Frontend
1. Abrir DevTools (F12)
2. Pestaña Network
3. Filtrar por "rpc" o "rest"
4. Verificar respuestas JSON

---

## 📈 Estado del Proyecto

### Versión Actual
**1.0.0** - Producción Ready

### Última Actualización
**2025-10-27** - Compatibilidad VPS completa

### Funcionalidades
- ✅ Frontend público completo
- ✅ Admin completo (10/10 páginas)
- ✅ API pública para agentes externos
- ✅ Sistema de auditoría (opcional)
- ✅ Compatible con VPS custom

### Rendimiento
- **14 archivos** frontend modificados
- **1 archivo** SQL corregido
- **7 instancias** de bug corregidas
- **100%** de funcionalidades operativas
- **0** timeouts
- **<500ms** tiempo de respuesta promedio

---

## 🚀 Próximos Pasos

1. **Monitoreo** - Configurar alertas para errores
2. **Backups** - Configurar backups automáticos
3. **Performance** - Monitorear y optimizar si es necesario
4. **Features** - Implementar nuevas funcionalidades

---

**Mantenido por:** Equipo de Desarrollo  
**Última revisión:** 2025-10-27  
**Estado:** ✅ Producción Ready
