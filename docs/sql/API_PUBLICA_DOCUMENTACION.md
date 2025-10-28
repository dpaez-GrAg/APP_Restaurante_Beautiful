# 🍽️ API PÚBLICA - SISTEMA DE RESERVAS RESTAURANTE

## 📋 **DESCRIPCIÓN GENERAL**

API REST pública para gestión de reservas de restaurante diseñada específicamente para **agentes externos** e **integraciones automatizadas**.

### ✨ **CARACTERÍSTICAS PRINCIPALES**

- ✅ **Sin UUIDs**: Solo requiere datos básicos (nombre, teléfono)
- ✅ **Gestión automática**: Crea/actualiza clientes automáticamente
- ✅ **Respuestas JSON**: Estructuradas y completas
- ✅ **Manejo de errores**: Mensajes claros para debugging
- ✅ **Parámetros normalizados**: Nomenclatura limpia y consistente

---

## 🚀 **ENDPOINTS DISPONIBLES**

### **BASE URL**

```
https://api.restaurante1.gridded.agency/rest/v1/rpc/
```

---

## 1️⃣ **VERIFICAR DISPONIBILIDAD**

### **Endpoint**

```http
POST /api_check_availability
```

### **Descripción**

Verifica disponibilidad de mesas para una fecha, número de comensales y duración específica.

### **Parámetros**

```json
{
  "p_date": "2025-09-24",
  "p_guests": 4,
  "p_duration_minutes": 120
}
```

| Parámetro            | Tipo    | Obligatorio | Descripción                      |
| -------------------- | ------- | ----------- | -------------------------------- |
| `p_date`             | date    | ✅          | Fecha de la reserva (YYYY-MM-DD) |
| `p_guests`           | integer | ✅          | Número de comensales             |
| `p_duration_minutes` | integer | ✅          | Duración en minutos              |

### **Respuesta**

```json
{
  "success": true,
  "date": "2025-09-24",
  "guests": 4,
  "available_slots": [
    {
      "time": "13:30",
      "zone": "Terraza"
    },
    {
      "time": "14:00",
      "zone": "Salón Principal"
    },
    {
      "time": "14:15",
      "zone": "Terraza"
    }
  ]
}
```

**Campos de respuesta:**

| Campo                    | Tipo    | Descripción                                 |
| ------------------------ | ------- | ------------------------------------------- |
| `success`                | boolean | Indica si la consulta fue exitosa           |
| `date`                   | string  | Fecha consultada (YYYY-MM-DD)               |
| `guests`                 | integer | Número de comensales consultado             |
| `available_slots`        | array   | Lista de horarios disponibles               |
| `available_slots[].time` | string  | Hora disponible en formato HH:MM            |
| `available_slots[].zone` | string  | Nombre de la zona donde se asignará la mesa |

---

## 2️⃣ **CREAR RESERVA**

### **Endpoint**

```http
POST /public_create_reservation
```

### **Descripción**

Crea una reserva completa con gestión automática de clientes. Si el cliente no existe, se crea automáticamente. Si existe, se actualizan sus datos.

### **Parámetros**

```json
{
  "p_name": "Juan Pérez",
  "p_phone": "666777888",
  "p_date": "2025-09-24",
  "p_time": "20:00:00",
  "p_guests": 4,
  "p_email": "juan@email.com",
  "p_duration_minutes": 120,
  "p_special_requests": "Mesa junto a ventana"
}
```

| Parámetro            | Tipo    | Obligatorio | Default | Descripción                 |
| -------------------- | ------- | ----------- | ------- | --------------------------- |
| `p_name`             | text    | ✅          | -       | Nombre completo del cliente |
| `p_phone`            | text    | ✅          | -       | Teléfono del cliente        |
| `p_date`             | date    | ✅          | -       | Fecha de la reserva         |
| `p_time`             | time    | ✅          | -       | Hora de la reserva          |
| `p_guests`           | integer | ✅          | -       | Número de comensales        |
| `p_email`            | text    | ❌          | NULL    | Email del cliente           |
| `p_duration_minutes` | integer | ❌          | 90      | Duración en minutos         |
| `p_special_requests` | text    | ❌          | NULL    | Peticiones especiales       |

### **Respuesta Exitosa**

```json
{
  "success": true,
  "message": "Reserva creada exitosamente",
  "customer": {
    "name": "Juan Pérez",
    "phone": "666777888"
  },
  "reservation": {
    "date": "2025-09-24",
    "time": "20:00:00",
    "guests": 4,
    "duration_minutes": 120,
    "special_requests": "Mesa junto a ventana"
  },
  "tables": [
    {
      "name": "Mesa 19",
      "zone": "Comedor"
    },
    {
      "name": "Mesa 20",
      "zone": "Comedor"
    }
  ]
}
```

**Campos de respuesta:**

| Campo                    | Tipo    | Descripción                              |
| ------------------------ | ------- | ---------------------------------------- |
| `success`                | boolean | Indica si la operación fue exitosa       |
| `message`                | string  | Mensaje descriptivo                      |
| `customer.name`          | string  | Nombre del cliente                       |
| `customer.phone`         | string  | Teléfono del cliente                     |
| `reservation.date`       | string  | Fecha de la reserva (YYYY-MM-DD)         |
| `reservation.time`       | string  | Hora de la reserva (HH:MM:SS)            |
| `reservation.guests`     | integer | Número de comensales                     |
| `reservation.duration_minutes` | integer | Duración en minutos            |
| `reservation.special_requests` | string | Peticiones especiales           |
| `tables`                 | array   | Lista de mesas asignadas                 |
| `tables[].name`          | string  | Nombre de la mesa                        |
| `tables[].zone`          | string  | Zona donde está ubicada la mesa          |

### **Respuesta de Error**

```json
{
  "success": false,
  "error": "El nombre del cliente es obligatorio"
}
```

---

## 3️⃣ **BUSCAR RESERVAS**

### **Endpoint**

```http
POST /public_find_reservation
```

### **Descripción**

Busca todas las reservas activas asociadas a un número de teléfono.

### **Parámetros**

```json
{
  "p_phone": "666777888"
}
```

| Parámetro | Tipo | Obligatorio | Descripción          |
| --------- | ---- | ----------- | -------------------- |
| `p_phone` | text | ✅          | Teléfono del cliente |

### **Respuesta**

```json
{
  "success": true,
  "message": "Reservas encontradas",
  "reservations": [
    {
      "id": "uuid-reserva",
      "customer_name": "Juan Pérez",
      "customer_phone": "666777888",
      "date": "2025-09-24",
      "time": "20:00:00",
      "guests": 4,
      "status": "confirmed",
      "special_requests": "Mesa junto a ventana"
    }
  ]
}
```

---

## 4️⃣ **CANCELAR RESERVA**

### **Endpoint**

```http
POST /public_cancel_reservation
```

### **Descripción**

Cancela una reserva específica por teléfono y fecha. Si hay múltiples reservas en la misma fecha, requiere especificar la hora.

### **Parámetros**

```json
{
  "p_phone": "666777888",
  "p_date": "2025-09-24",
  "p_time": "20:00:00",
  "p_reason": "Cambio de planes"
}
```

| Parámetro  | Tipo | Obligatorio | Default                    | Descripción                                           |
| ---------- | ---- | ----------- | -------------------------- | ----------------------------------------------------- |
| `p_phone`  | text | ✅          | -                          | Teléfono del cliente                                  |
| `p_date`   | date | ✅          | -                          | Fecha de la reserva                                   |
| `p_time`   | time | ❌          | NULL                       | Hora específica (requerida si hay múltiples reservas) |
| `p_reason` | text | ❌          | "Cancelada por el cliente" | Motivo de cancelación                                 |

### **Respuesta**

```json
{
  "success": true,
  "message": "Reserva cancelada exitosamente",
  "reservation_id": "uuid-de-la-reserva"
}
```

---

## 🔄 **FLUJO COMPLETO PARA AGENTES**

### **1. Verificar Disponibilidad**

```bash
curl -X POST https://api.restaurante1.gridded.agency/rest/v1/rpc/api_check_availability \
  -H "Content-Type: application/json" \
  -d '{
    "p_date": "2025-09-24",
    "p_guests": 4,
    "p_duration_minutes": 120
  }'
```

### **2. Crear Reserva**

```bash
curl -X POST https://api.restaurante1.gridded.agency/rest/v1/rpc/public_create_reservation \
  -H "Content-Type: application/json" \
  -d '{
    "p_name": "Cliente Agente IA",
    "p_phone": "666777888",
    "p_date": "2025-09-24",
    "p_time": "20:00:00",
    "p_guests": 4,
    "p_duration_minutes": 120,
    "p_special_requests": "Reserva creada por agente"
  }'
```

### **3. Buscar Reservas**

```bash
curl -X POST https://api.restaurante1.gridded.agency/rest/v1/rpc/public_find_reservation \
  -H "Content-Type: application/json" \
  -d '{
    "p_phone": "666777888"
  }'
```

### **4. Cancelar Reserva**

```bash
curl -X POST https://api.restaurante1.gridded.agency/rest/v1/rpc/public_cancel_reservation \
  -H "Content-Type: application/json" \
  -d '{
    "p_phone": "666777888",
    "p_date": "2025-09-24",
    "p_time": "20:00:00",
    "p_reason": "Cancelada por agente"
  }'
```

---

## ⚠️ **CÓDIGOS DE ERROR COMUNES**

| Error                                              | Descripción                        | Solución                      |
| -------------------------------------------------- | ---------------------------------- | ----------------------------- |
| `El nombre del cliente es obligatorio`             | Parámetro `p_name` vacío o nulo    | Proporcionar nombre válido    |
| `El teléfono del cliente es obligatorio`           | Parámetro `p_phone` vacío o nulo   | Proporcionar teléfono válido  |
| `No se encontraron reservas para este teléfono`    | No hay reservas activas            | Verificar teléfono y fechas   |
| `Se encontraron múltiples reservas para esa fecha` | Varias reservas en la misma fecha  | Especificar `p_time`          |
| `Reserva no encontrada o no se puede cancelar`     | Reserva inexistente o ya cancelada | Verificar datos de la reserva |

---

## 🛡️ **CONSIDERACIONES DE SEGURIDAD**

- ✅ **Validación de datos**: Todos los parámetros son validados
- ✅ **Sanitización**: Datos limpiados con `trim()`
- ✅ **Manejo de errores**: Excepciones capturadas y controladas
- ✅ **SECURITY DEFINER**: Funciones ejecutadas con permisos apropiados

---

## 📊 **LÍMITES Y RESTRICCIONES**

- **Duración mínima**: 30 minutos
- **Duración máxima**: 240 minutos (4 horas)
- **Comensales máximos**: Según capacidad del restaurante
- **Reservas por teléfono**: Sin límite
- **Cancelación**: Solo reservas con estado 'confirmed' o 'pending'

---

## 🔧 **INSTALACIÓN**

Para implementar esta API en tu base de datos, ejecuta:

```sql
-- Ejecutar en orden:
\i PUBLIC_API_NORMALIZED_FIXED.sql
```

---

## 📞 **SOPORTE**

Para soporte técnico o consultas sobre la API, contacta al equipo de desarrollo.

**¡API lista para integración con agentes externos!** 🚀
