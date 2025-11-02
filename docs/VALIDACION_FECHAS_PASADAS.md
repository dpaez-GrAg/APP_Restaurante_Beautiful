# 🚨 Validación de Fechas y Horarios Pasados - API v2.0.0

## 📋 Resumen

Se ha modificado la función `api_check_availability` para **prevenir consultas de disponibilidad en fechas/horarios pasados**.

---

## ✨ Cambios Implementados

### 1️⃣ Validación de Fechas Pasadas

**Comportamiento:**
- Si la fecha consultada (`p_date`) es anterior a la fecha actual → **Error inmediato**
- No se ejecuta ninguna lógica de búsqueda de disponibilidad

**Ejemplo:**
```sql
SELECT api_check_availability('2025-10-31', 4, 120);
```

**Respuesta:**
```json
{
  "success": false,
  "error": "No se puede consultar disponibilidad en fechas pasadas",
  "date": "2025-10-31",
  "guests": 4
}
```

---

### 2️⃣ Filtrado de Slots Pasados (Día Actual)

**Comportamiento:**
- Si la fecha consultada es **HOY** → Solo muestra slots donde:
  - `slot_time > CURRENT_TIME + 30 minutos`
- Si la fecha es **FUTURA** → Muestra todos los slots disponibles

**Margen de Seguridad:** 30 minutos para dar tiempo al usuario a completar la reserva

**Ejemplo:**
- **Hora actual:** 14:20
- **Slots mostrados:** 15:00, 15:15, 15:30... (desde 14:50 en adelante)
- **Slots ocultos:** 14:00, 14:15, 14:30, 14:45

---

## 🎯 Casos de Uso

### Caso 1: Consulta de Fecha Pasada
```bash
# Intento de consultar disponibilidad para ayer
curl -X POST https://api.restaurante1.gridded.agency/rest/v1/rpc/api_check_availability \
  -H "Content-Type: application/json" \
  -d '{
    "p_date": "2025-10-31",
    "p_guests": 4,
    "p_duration_minutes": 120
  }'
```

**Respuesta:**
```json
{
  "success": false,
  "error": "No se puede consultar disponibilidad en fechas pasadas",
  "date": "2025-10-31",
  "guests": 4
}
```

**Mensaje al usuario:**
> "No se puede consultar disponibilidad en fechas pasadas. Por favor selecciona una fecha a partir de hoy."

---

### Caso 2: Consulta del Día Actual (14:20)
```bash
curl -X POST https://api.restaurante1.gridded.agency/rest/v1/rpc/api_check_availability \
  -H "Content-Type: application/json" \
  -d '{
    "p_date": "2025-11-02",
    "p_guests": 4,
    "p_duration_minutes": 120
  }'
```

**Respuesta (solo slots desde 14:50):**
```json
{
  "success": true,
  "date": "2025-11-02",
  "guests": 4,
  "lunch": {
    "open": true,
    "message": null,
    "slots": [
      {"time": "15:00", "zone": "Terraza", "zone_id": "uuid-terraza"},
      {"time": "15:30", "zone": "Salón Principal", "zone_id": "uuid-salon"}
    ]
  },
  "dinner": {
    "open": true,
    "message": null,
    "slots": [
      {"time": "20:00", "zone": "Comedor", "zone_id": "uuid-comedor"},
      {"time": "20:30", "zone": "Terraza", "zone_id": "uuid-terraza"}
    ]
  }
}
```

**Nota:** Los slots de 14:00, 14:15, 14:30, 14:45 NO aparecen porque ya pasaron.

---

### Caso 3: Consulta de Fecha Futura
```bash
curl -X POST https://api.restaurante1.gridded.agency/rest/v1/rpc/api_check_availability \
  -H "Content-Type: application/json" \
  -d '{
    "p_date": "2025-11-09",
    "p_guests": 4,
    "p_duration_minutes": 120
  }'
```

**Respuesta:**
```json
{
  "success": true,
  "date": "2025-11-09",
  "guests": 4,
  "lunch": {
    "open": true,
    "message": null,
    "slots": [
      {"time": "13:00", "zone": "Terraza"},
      {"time": "13:30", "zone": "Salón Principal"},
      {"time": "14:00", "zone": "Comedor"},
      ...
    ]
  },
  "dinner": {
    "open": true,
    "message": null,
    "slots": [...]
  }
}
```

**Nota:** Todos los slots disponibles se muestran porque la fecha es futura.

---

## 💡 Beneficios

### Para Usuarios
✅ **No más errores:** No pueden intentar reservar en fechas/horarios imposibles  
✅ **Mensajes claros:** Errores específicos indican el problema exacto  
✅ **Mejor experiencia:** Solo ven opciones válidas y realizables  

### Para Agentes Conversacionales
✅ **Validación automática:** No necesitan validar fechas antes de llamar la API  
✅ **Feedback inmediato:** Saben exactamente por qué no hay disponibilidad  
✅ **Menos llamadas fallidas:** Prevención temprana de errores  

### Para el Sistema
✅ **Menos carga:** No se ejecuta búsqueda de disponibilidad para fechas inválidas  
✅ **Datos consistentes:** Imposible crear reservas en el pasado  
✅ **API más robusta:** Validaciones tempranas reducen complejidad  

---

## 🛠️ Implementación

### Paso 1: Aplicar en Base de Datos

**Opción A: Archivo completo**
```bash
psql -h api.restaurante1.gridded.agency -U postgres -d postgres \
  -f docs/sql/API_CHECK_AVAILABILITY.sql
```

**Opción B: Solo la actualización**
```bash
psql -h api.restaurante1.gridded.agency -U postgres -d postgres \
  -f docs/sql/UPDATE_API_AVAILABILITY_V2.sql
```

**Opción C: Desde Supabase Dashboard**
1. Ir a SQL Editor
2. Copiar contenido de `UPDATE_API_AVAILABILITY_V2.sql`
3. Ejecutar

---

### Paso 2: Verificar Funcionamiento

```sql
-- Test 1: Fecha pasada (debe retornar error)
SELECT api_check_availability('2025-10-31', 4, 120);

-- Test 2: Fecha de hoy (debe filtrar slots pasados)
SELECT api_check_availability(CURRENT_DATE, 4, 120);

-- Test 3: Fecha futura (debe mostrar todos los slots)
SELECT api_check_availability(CURRENT_DATE + 7, 4, 120);
```

---

## ⚠️ Breaking Changes

### Para Integraciones Existentes

Si tienes agentes o sistemas que llaman a `api_check_availability`:

**ANTES (v1.x):**
- Permitía consultar fechas pasadas (aunque inútil)
- Mostraba todos los slots del día actual

**AHORA (v2.0):**
- ❌ Rechaza fechas pasadas con error
- ⏰ Filtra slots pasados en día actual

### Adaptación Necesaria

**Tu código de integración debe:**

1. **Manejar el nuevo error:**
```javascript
const response = await fetch('https://api.restaurante1.gridded.agency/rest/v1/rpc/api_check_availability', {
  method: 'POST',
  body: JSON.stringify({
    p_date: selectedDate,
    p_guests: 4,
    p_duration_minutes: 120
  })
});

const data = await response.json();

if (!data.success) {
  // NUEVO: Manejar error de fecha pasada
  if (data.error.includes('fechas pasadas')) {
    console.log('Error: El usuario seleccionó una fecha pasada');
    // Mostrar mensaje al usuario
  }
  return;
}

// Continuar con lógica normal...
```

2. **Entender que en día actual puede haber menos slots:**
```javascript
// Si es hoy a las 14:20, solo habrá slots desde 14:50
// Esto es correcto y esperado
if (data.lunch.slots.length === 0 && data.dinner.slots.length === 0) {
  console.log('No hay slots disponibles para hoy');
  // Sugerir mañana u otra fecha
}
```

---

## 📚 Documentación Relacionada

- **Changelog completo:** `docs/sql/API_CHECK_AVAILABILITY_CHANGELOG.md`
- **Función actualizada:** `docs/sql/API_CHECK_AVAILABILITY.sql`
- **Script de migración:** `docs/sql/UPDATE_API_AVAILABILITY_V2.sql`
- **Documentación API:** `docs/sql/API_PUBLICA_DOCUMENTACION.md`

---

## ✅ Checklist de Integración

- [ ] Script SQL ejecutado en base de datos
- [ ] Tests realizados (fechas pasadas, hoy, futuro)
- [ ] Agente conversacional actualizado para manejar error de fecha pasada
- [ ] Frontend actualizado (si hace llamadas directas)
- [ ] Documentación del agente actualizada
- [ ] Usuarios informados del cambio (si aplica)

---

**Versión:** 2.0.0  
**Fecha:** 2 de noviembre de 2025  
**Estado:** ✅ Listo para producción
