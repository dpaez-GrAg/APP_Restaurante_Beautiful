# 📋 Changelog - api_check_availability

## 🚨 [v2.0.0] - Validación de Fechas y Horarios Pasados

### **Fecha:** 2 de noviembre de 2025

---

### 🎯 Objetivo

Prevenir que se consulte disponibilidad en fechas/horarios pasados, mejorando la robustez de la API y la experiencia del usuario.

---

### ⚠️ BREAKING CHANGES

1. **Fechas pasadas rechazadas:** La API ahora devuelve error si `p_date < CURRENT_DATE`
2. **Slots pasados filtrados:** En el día actual, solo muestra slots futuros (con margen de 30 minutos)

---

### 📊 Cambios Implementados

#### **Validación 1: Rechazo de Fechas Pasadas**

**Comportamiento:**
- Si `p_date < CURRENT_DATE` → Error inmediato
- No se ejecuta lógica de búsqueda de disponibilidad

**Respuesta de Error:**
```json
{
  "success": false,
  "error": "No se puede consultar disponibilidad en fechas pasadas",
  "date": "2025-10-31",
  "guests": 4
}
```

#### **Validación 2: Filtrado de Slots Pasados (Día Actual)**

**Comportamiento:**
- Si `p_date = CURRENT_DATE` → Solo muestra slots donde `slot_time > CURRENT_TIME + 30 minutos`
- Si `p_date > CURRENT_DATE` → Muestra todos los slots normalmente

**Margen de Seguridad:** 30 minutos para dar tiempo al usuario a completar la reserva

**Ejemplo:**
- **Hora actual:** 14:20
- **Slots mostrados:** 14:45, 15:00, 15:15, 15:30...
- **Slots filtrados:** 14:00, 14:15, 14:30

---

### 🔍 Ejemplos de Uso

#### Consulta de Fecha Pasada
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

#### Consulta de Hoy (14:20) con Slots Futuros
```sql
SELECT api_check_availability(CURRENT_DATE, 4, 120);
```

**Respuesta (slots desde 14:50):**
```json
{
  "success": true,
  "date": "2025-11-02",
  "guests": 4,
  "lunch": {
    "open": true,
    "message": null,
    "slots": [
      {"time": "15:00", "zone": "Terraza"},
      {"time": "15:30", "zone": "Salón"}
    ]
  },
  "dinner": {
    "open": true,
    "message": null,
    "slots": [...]
  }
}
```

---

### 💡 Beneficios

✅ **Previene errores:** Usuarios no pueden reservar en el pasado  
✅ **Mejor UX:** Mensajes de error claros y específicos  
✅ **Margen de seguridad:** 30 minutos para completar la reserva  
✅ **API más robusta:** Validaciones tempranas reducen carga  
✅ **Agentes externos:** Reciben feedback inmediato sobre errores  

---

### 🛠️ Archivos Modificados

1. **`API_CHECK_AVAILABILITY.sql`**
   - Variables añadidas: `v_current_date`, `v_current_time`
   - Validación de fecha pasada al inicio
   - Filtrado de slots con `WHERE` clause en ambos CTEs

---

### 🚀 Implementación

```bash
# Ejecutar el script actualizado
psql -h [host] -U [user] -d [database] -f docs/sql/API_CHECK_AVAILABILITY.sql
```

---

## ✅ Mejora Implementada: Campo `message` en Servicios

### **Fecha:** 1 de noviembre de 2025

---

## 🎯 Objetivo

Proporcionar información clara al agente conversacional sobre **por qué** no hay slots disponibles en cada servicio (comida/cena).

---

## 📊 Cambios Realizados

### **ANTES:**
```json
{
  "lunch": {
    "open": true,
    "slots": []
  }
}
```

**Problema:** No se sabía si `slots: []` era porque:
- El restaurante está cerrado en ese horario
- No hay disponibilidad para la cantidad de personas solicitada

---

### **AHORA:**
```json
{
  "lunch": {
    "open": true,
    "message": "No hay disponibilidad",
    "slots": []
  }
}
```

**Solución:** El campo `message` indica claramente el motivo.

---

## 🔍 Valores Posibles de `message`

| Valor | Significado | Cuándo Aparece |
|-------|-------------|----------------|
| `null` | Hay disponibilidad | Cuando `slots` tiene elementos |
| `"No hay disponibilidad"` | Servicio abierto pero sin mesas | `open: true` y `slots: []` |
| `"El restaurante está cerrado en este horario"` | Servicio no opera | `open: false` |

---

## 📝 Casos de Uso

### **Caso 1: Disponibilidad en ambos servicios**
```json
{
  "lunch": {
    "open": true,
    "message": null,  // ← Hay slots disponibles
    "slots": [...]
  },
  "dinner": {
    "open": true,
    "message": null,  // ← Hay slots disponibles
    "slots": [...]
  }
}
```

**Agente:** Muestra ambas opciones al usuario.

---

### **Caso 2: Solo cena disponible (comida sin mesas)**
```json
{
  "lunch": {
    "open": true,
    "message": "No hay disponibilidad",  // ← Servicio abierto pero sin mesas
    "slots": []
  },
  "dinner": {
    "open": true,
    "message": null,
    "slots": [...]
  }
}
```

**Agente:** 
- Si usuario pidió comida → "No hay disponibilidad para comida, pero sí para cena"
- Si usuario pidió cena → Muestra solo opciones de cena

---

### **Caso 3: Restaurante solo abre para cena**
```json
{
  "lunch": {
    "open": false,
    "message": "El restaurante está cerrado en este horario",  // ← No opera
    "slots": []
  },
  "dinner": {
    "open": true,
    "message": null,
    "slots": [...]
  }
}
```

**Agente:** "El restaurante no abre para comidas ese día, solo para cena"

---

### **Caso 4: Restaurante completamente cerrado**
```json
{
  "lunch": {
    "open": false,
    "message": "El restaurante está cerrado en este horario",
    "slots": []
  },
  "dinner": {
    "open": false,
    "message": "El restaurante está cerrado en este horario",
    "slots": []
  }
}
```

**Agente:** "El restaurante está cerrado en esta fecha"

---

## 🛠️ Archivos Modificados

1. **`API_CHECK_AVAILABILITY.sql`**
   - Añadido campo `message` en respuestas de `lunch` y `dinner`
   - Lógica CASE para determinar el mensaje apropiado
   - 6 ejemplos actualizados con el nuevo formato

2. **`API_PUBLICA_DOCUMENTACION.md`**
   - 5 casos de uso documentados
   - Tabla de campos actualizada con `message`
   - Ejemplos de respuesta actualizados

3. **`AGENTE_CONVERSACIONAL_FLUJO.md`**
   - Sección "Interpretar el campo message" añadida
   - Ejemplos de código JavaScript para el agente
   - Todos los escenarios actualizados con `message`

---

## 💡 Beneficios

✅ **Claridad:** El agente sabe exactamente por qué no hay disponibilidad  
✅ **Mejor UX:** Mensajes más precisos al usuario  
✅ **Menos errores:** No hay ambigüedad en la interpretación  
✅ **Flexibilidad:** Fácil añadir más tipos de mensajes en el futuro  

---

## 🚀 Implementación

Para aplicar estos cambios en tu base de datos:

```bash
# Ejecutar el script actualizado
psql -h [host] -U [user] -d [database] -f docs/sql/API_CHECK_AVAILABILITY.sql
```

O desde Supabase Dashboard:
1. Ir a SQL Editor
2. Copiar contenido de `API_CHECK_AVAILABILITY.sql`
3. Ejecutar

---

## ✅ Checklist de Integración

- [ ] Función SQL actualizada en base de datos
- [ ] Agente conversacional actualizado para leer campo `message`
- [ ] Lógica de respuesta del agente adaptada a los 3 valores posibles
- [ ] Tests realizados con los 6 casos de uso documentados
- [ ] Documentación del agente actualizada

---

**¡Mejora completada y lista para producción!** 🎉
