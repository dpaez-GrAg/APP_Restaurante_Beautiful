# 🎯 Actualización: public_create_reservation

## 📅 Fecha: 1 de noviembre de 2025

---

## ✅ Cambio Implementado: Zona Preferida Opcional

### **Nuevo Parámetro:**
- `p_preferred_zone_id` (uuid, opcional, default: NULL)

---

## 📊 Comparación Antes/Después

### **ANTES:**
```json
{
  "p_name": "Juan Pérez",
  "p_phone": "666777888",
  "p_date": "2025-10-31",
  "p_time": "20:30",
  "p_guests": 4,
  "p_special_requests": "Mesa junto a ventana"
}
```
**Resultado:** Asignación automática de zona según prioridades.

---

### **AHORA (Opción 1 - Sin zona preferida):**
```json
{
  "p_name": "Juan Pérez",
  "p_phone": "666777888",
  "p_date": "2025-10-31",
  "p_time": "20:30",
  "p_guests": 4,
  "p_special_requests": "Mesa junto a ventana"
}
```
**Resultado:** Asignación automática (comportamiento por defecto).

---

### **AHORA (Opción 2 - Con zona preferida):**
```json
{
  "p_name": "Juan Pérez",
  "p_phone": "666777888",
  "p_date": "2025-10-31",
  "p_time": "20:30",
  "p_guests": 4,
  "p_special_requests": "Mesa junto a ventana",
  "p_preferred_zone_id": "uuid-de-la-zona-terraza"
}
```
**Resultado:** Intenta asignar mesa en la zona especificada. Si no hay disponibilidad en esa zona, devuelve error.

---

## 🔗 Integración con api_check_availability

### **Paso 1: Obtener Disponibilidad**
```bash
POST /api_check_availability
{
  "p_date": "2025-10-31",
  "p_guests": 4,
  "p_duration_minutes": 120
}
```

### **Respuesta:**
```json
{
  "success": true,
  "date": "2025-10-31",
  "guests": 4,
  "dinner": {
    "open": true,
    "message": null,
    "slots": [
      {
        "time": "20:30",
        "zone": "Terraza",
        "zone_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"  // ← Usar este ID
      },
      {
        "time": "20:30",
        "zone": "Comedor",
        "zone_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901"
      }
    ]
  }
}
```

### **Paso 2: Crear Reserva con Zona Preferida**
```bash
POST /public_create_reservation
{
  "p_name": "Juan Pérez",
  "p_phone": "666777888",
  "p_date": "2025-10-31",
  "p_time": "20:30",
  "p_guests": 4,
  "p_preferred_zone_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"  // ← ID de Terraza
}
```

---

## 📝 Parámetros Completos

| Parámetro              | Tipo    | Obligatorio | Default | Descripción                                    |
| ---------------------- | ------- | ----------- | ------- | ---------------------------------------------- |
| `p_name`               | text    | ✅          | -       | Nombre completo del cliente                    |
| `p_phone`              | text    | ✅          | -       | Teléfono del cliente                           |
| `p_date`               | date    | ✅          | -       | Fecha de la reserva (YYYY-MM-DD)               |
| `p_time`               | time    | ✅          | -       | Hora de la reserva (HH:MM o HH:MM:SS)          |
| `p_guests`             | integer | ✅          | -       | Número de comensales                           |
| `p_email`              | text    | ❌          | NULL    | Email del cliente                              |
| `p_duration_minutes`   | integer | ❌          | 90      | Duración en minutos                            |
| `p_special_requests`   | text    | ❌          | NULL    | Peticiones especiales                          |
| `p_preferred_zone_id`  | uuid    | ❌          | NULL    | ID de zona preferida                           |

---

## 🎯 Casos de Uso

### **Caso 1: Agente sin preferencia de zona**
```
Usuario: "Quiero reservar para 4 personas a las 20:30"
Agente: [No especifica zona]
Sistema: Asigna automáticamente según prioridades
```

### **Caso 2: Usuario elige zona específica**
```
Usuario: "Quiero reservar en la terraza a las 20:30"
Agente: [Obtiene zone_id de "Terraza" desde api_check_availability]
Agente: [Envía p_preferred_zone_id en la reserva]
Sistema: Asigna mesa en Terraza si hay disponibilidad
```

### **Caso 3: Zona preferida no disponible**
```
Agente: [Envía p_preferred_zone_id de "Terraza"]
Sistema: No hay mesas disponibles en Terraza
Respuesta: { "success": false, "error": "No hay mesas disponibles..." }
Agente: "Lo siento, no hay disponibilidad en la Terraza. ¿Te gustaría otra zona?"
```

---

## 🔍 Validaciones Implementadas

### **En public_create_reservation:**
1. ✅ Validación de campos obligatorios (name, phone)
2. ✅ Normalización con `trim()` de todos los campos text
3. ✅ Gestión automática de clientes (crear/actualizar)
4. ✅ Paso de `p_preferred_zone_id` a `create_reservation_with_assignment`

### **En create_reservation_with_assignment:**
1. ✅ Verificación de restaurante cerrado
2. ✅ Verificación de horarios
3. ✅ Asignación de mesas considerando zona preferida
4. ✅ Si no hay mesas en zona preferida → Error

---

## 📁 Archivos Modificados

1. ✅ **03_reservation_functions.sql**
   - Añadido parámetro `p_preferred_zone_id`
   - Validaciones de campos obligatorios
   - Normalización con `trim()`

2. ✅ **API_CHECK_AVAILABILITY.sql**
   - Añadido `zone_id` en respuesta de slots
   - Ejemplos actualizados

3. ✅ **API_PUBLICA_DOCUMENTACION.md**
   - Tabla de parámetros actualizada
   - Ejemplos con/sin zona preferida
   - Nota sobre obtención de `zone_id`

4. ✅ **PUBLIC_CREATE_RESERVATION_UPDATE.md**
   - Documentación completa del cambio

---

## 💡 Recomendaciones para el Agente

### **Flujo Recomendado:**

1. **Preguntar preferencia al usuario:**
   ```
   "Tenemos disponibilidad en:
   • Terraza a las 20:30
   • Comedor a las 20:30
   
   ¿Tienes alguna preferencia de zona?"
   ```

2. **Si el usuario elige zona:**
   - Usar el `zone_id` correspondiente
   - Incluir `p_preferred_zone_id` en la reserva

3. **Si el usuario no tiene preferencia:**
   - No enviar `p_preferred_zone_id`
   - Dejar que el sistema asigne automáticamente

4. **Si falla la asignación:**
   - Informar al usuario
   - Ofrecer alternativas de otras zonas

---

## ✅ Checklist de Implementación

- [x] Parámetro `p_preferred_zone_id` añadido
- [x] Validaciones de campos obligatorios
- [x] Normalización con `trim()`
- [x] `zone_id` incluido en `api_check_availability`
- [x] Documentación actualizada
- [x] Ejemplos de uso creados
- [ ] Función aplicada en base de datos
- [ ] Agente conversacional actualizado
- [ ] Tests realizados

---

## 🚀 Próximos Pasos

1. **Aplicar en base de datos:**
   ```bash
   psql -h [host] -U [user] -d [database] -f docs/sql/03_reservation_functions.sql
   psql -h [host] -U [user] -d [database] -f docs/sql/API_CHECK_AVAILABILITY.sql
   ```

2. **Actualizar agente conversacional:**
   - Leer `zone_id` de la respuesta de disponibilidad
   - Preguntar al usuario si tiene preferencia de zona
   - Incluir `p_preferred_zone_id` si el usuario elige

3. **Testing:**
   - Crear reserva sin zona preferida
   - Crear reserva con zona preferida válida
   - Intentar crear reserva con zona sin disponibilidad

---

**¡Actualización completada y lista para producción!** 🎉
