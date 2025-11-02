# 🗑️ Archivos SQL que Pueden Eliminarse

## 📅 Fecha: 1 de noviembre de 2025

---

## ✅ Archivos Esenciales (MANTENER)

### **Archivos de Instalación Principal (01-10):**
1. ✅ `01_database_structure.sql` - Estructura de base de datos
2. ✅ `02_initial_data.sql` - Datos iniciales
3. ✅ `03_reservation_functions.sql` - **ACTUALIZADO** - Funciones de reservas (reorganizado)
4. ✅ `04_customer_functions.sql` - Funciones de clientes
5. ✅ `05_user_management.sql` - Gestión de usuarios
6. ✅ `06_storage_and_permissions.sql` - Permisos y RLS
7. ✅ `07_auth_fixes.sql` - Correcciones de autenticación
8. ✅ `10_vps_compatibility_notes.sql` - Notas de compatibilidad VPS

### **Archivos de API Pública:**
9. ✅ `API_CHECK_AVAILABILITY.sql` - **ACTUALIZADO** - Función de disponibilidad con zone_id

### **Archivos de Documentación:**
10. ✅ `00_CONFIRMACION_ARCHIVOS_ESENCIALES.md` - Guía de archivos
11. ✅ `API_PUBLICA_DOCUMENTACION.md` - **ACTUALIZADO** - Documentación completa de API
12. ✅ `API_CHECK_AVAILABILITY_CHANGELOG.md` - Changelog de cambios
13. ✅ `API_OPTIMIZACION_FINAL.md` - Resumen de optimizaciones
14. ✅ `PUBLIC_CREATE_RESERVATION_UPDATE.md` - **NUEVO** - Guía de zona preferida
15. ✅ `DEPLOYMENT_GUIDE.md` - Guía de despliegue
16. ✅ `LOGICA_ASIGNACION_MESAS.md` - Documentación de lógica
17. ✅ `README.md` - Índice del directorio
18. ✅ `TEST_PUBLIC_API.md` - Guía de testing

---

## ❌ Archivos que Pueden Eliminarse

### **1. INSTALL_PUBLIC_API_FUNCTIONS.sql**
**Motivo:** Las funciones de API pública ya están incluidas en `03_reservation_functions.sql` (PARTE 2)

**Funciones que contenía:**
- `public_find_reservation` → Ya en `03_reservation_functions.sql` línea 467
- `public_cancel_reservation` → Ya en `03_reservation_functions.sql` línea 525
- `public_create_reservation` → Ya en `03_reservation_functions.sql` línea 592

**Acción:** ❌ ELIMINAR

---

### **2. CLEAN_TEST_DATA.sql**
**Motivo:** Script temporal de limpieza, no necesario para producción

**Contenido:** Limpia datos de prueba de la base de datos

**Acción:** 
- ❌ ELIMINAR si ya no necesitas limpiar datos de prueba
- ✅ MANTENER si todavía estás en fase de testing

---

## 📊 Resumen

| Tipo | Mantener | Eliminar | Opcional |
|------|----------|----------|----------|
| **SQL de instalación** | 8 | 1 | 0 |
| **SQL de API** | 1 | 0 | 0 |
| **SQL de utilidad** | 0 | 0 | 1 |
| **Documentación** | 9 | 0 | 0 |
| **TOTAL** | **18** | **1** | **1** |

---

## 🔍 Verificación de Contenido

### **INSTALL_PUBLIC_API_FUNCTIONS.sql vs 03_reservation_functions.sql**

| Función | INSTALL_PUBLIC_API_FUNCTIONS.sql | 03_reservation_functions.sql |
|---------|----------------------------------|------------------------------|
| `public_find_reservation` | ✅ Incluida | ✅ Incluida (línea 467) |
| `public_cancel_reservation` | ✅ Incluida | ✅ Incluida (línea 525) |
| `public_create_reservation` | ✅ Incluida (sin zona preferida) | ✅ Incluida (CON zona preferida - línea 592) |

**Conclusión:** `03_reservation_functions.sql` tiene la versión más actualizada con `p_preferred_zone_id`.

---

## 🚀 Comando para Eliminar

```bash
# Desde el directorio docs/sql/

# Eliminar archivo redundante
rm INSTALL_PUBLIC_API_FUNCTIONS.sql

# Opcional: Eliminar archivo de limpieza de tests
rm CLEAN_TEST_DATA.sql
```

---

## 📝 Notas Importantes

### **Reorganización de 03_reservation_functions.sql:**

El archivo ha sido reorganizado en 2 partes:

**PARTE 1: FUNCIONES INTERNAS DEL SISTEMA**
1. `assign_tables_to_reservation` - Asignación automática de mesas
2. `create_reservation_with_assignment` - Crear reserva con asignación
3. `get_available_time_slots_with_zones` - Obtener slots disponibles
4. `get_available_tables_for_reservation` - Mesas disponibles para admin

**PARTE 2: FUNCIONES DE API PÚBLICA** (para agentes externos)
5. `public_find_reservation` - Buscar reservas por teléfono
6. `public_cancel_reservation` - Cancelar reserva
7. `public_create_reservation` - Crear reserva con zona preferida opcional

---

## ✅ Checklist de Limpieza

- [ ] Verificar que `03_reservation_functions.sql` está actualizado
- [ ] Verificar que `API_CHECK_AVAILABILITY.sql` incluye `zone_id`
- [ ] Eliminar `INSTALL_PUBLIC_API_FUNCTIONS.sql`
- [ ] Decidir si eliminar `CLEAN_TEST_DATA.sql`
- [ ] Actualizar `README.md` si es necesario
- [ ] Commit de cambios

---

**¡Limpieza completada!** 🎉
