# Guía de Uso de APIs - Sistema de Reservas

Esta guía documenta todas las APIs disponibles en el sistema de reservas, incluyendo las nuevas funcionalidades de límite de comensales por turno.

## 🔗 Base URL

```
https://api.restaurante1.gridded.agency/rest/v1/rpc/
```

## 🔑 Autenticación

Todas las llamadas requieren el header de autenticación:

```bash
-H "apikey: TU_ANON_KEY"
-H "Content-Type: application/json"
```

---

## 📋 APIs Disponibles

### 1. **Verificar Disponibilidad (Básica)**

**Endpoint:** `api_check_availability`

Verifica disponibilidad básica considerando mesas y límites de comensales.

#### Parámetros

- `date` (string): Fecha en formato YYYY-MM-DD
- `guests` (integer): Número de comensales
- `duration_minutes` (integer, opcional): Duración en minutos (default: 90)

#### Ejemplo de Llamada

```bash
curl -X POST "https://api.restaurante1.gridded.agency/rest/v1/rpc/api_check_availability" \
  -H "Content-Type: application/json" \
  -H "apikey: TU_ANON_KEY" \
  -d '{
    "date": "2024-01-15",
    "guests": 4,
    "duration_minutes": 90
  }'
```

#### Respuesta

```json
{
  "available": true,
  "available_slots": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "time": "13:00:00",
      "capacity": 8
    },
    {
      "id": "123e4567-e89b-12d3-a456-426614174001",
      "time": "13:30:00",
      "capacity": 6
    }
  ],
  "total_slots": 2,
  "date": "2024-01-15",
  "guests": 4,
  "duration_minutes": 90
}
```

---

### 2. **Verificar Disponibilidad con Información de Capacidad**

**Endpoint:** `api_check_availability_with_capacity`

Verifica disponibilidad con información detallada sobre límites de comensales por turno.

#### Parámetros

- `date` (string): Fecha en formato YYYY-MM-DD
- `guests` (integer): Número de comensales
- `duration_minutes` (integer, opcional): Duración en minutos (default: 90)

#### Ejemplo de Llamada

```bash
curl -X POST "https://api.restaurante1.gridded.agency/rest/v1/rpc/api_check_availability_with_capacity" \
  -H "Content-Type: application/json" \
  -H "apikey: TU_ANON_KEY" \
  -d '{
    "date": "2024-01-15",
    "guests": 4,
    "duration_minutes": 90
  }'
```

#### Respuesta Completa

```json
{
  "available": true,
  "date": "2024-01-15",
  "guests": 4,
  "duration_minutes": 90,
  "available_slots": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "time": "13:00:00",
      "capacity": 8
    },
    {
      "id": "123e4567-e89b-12d3-a456-426614174001",
      "time": "13:30:00",
      "capacity": 6
    }
  ],
  "total_slots": 2,
  "capacity_info": [
    {
      "schedule_id": "456e7890-e89b-12d3-a456-426614174000",
      "opening_time": "12:00:00",
      "closing_time": "16:00:00",
      "max_diners": 25,
      "current_diners": 18,
      "available_diners": 7,
      "is_special_schedule": false,
      "occupancy_percentage": 72.0,
      "status": "available"
    },
    {
      "schedule_id": "456e7890-e89b-12d3-a456-426614174001",
      "opening_time": "20:00:00",
      "closing_time": "23:30:00",
      "max_diners": 30,
      "current_diners": 5,
      "available_diners": 25,
      "is_special_schedule": false,
      "occupancy_percentage": 16.7,
      "status": "available"
    }
  ],
  "has_capacity_limits": true,
  "summary": {
    "can_accommodate": true,
    "table_availability": "available",
    "capacity_status": "capacity_available",
    "recommendation": "Reservation can be made"
  },
  "generated_at": "2024-01-15T10:30:00.000Z"
}
```

---

### 3. **Crear Reserva**

**Endpoint:** `api_create_reservation`

Crea una nueva reserva en el sistema.

#### Parámetros

- `customer_name` (string): Nombre del cliente
- `customer_email` (string): Email del cliente
- `customer_phone` (string, opcional): Teléfono del cliente
- `date` (string): Fecha en formato YYYY-MM-DD
- `time` (string): Hora en formato HH:MM
- `guests` (integer): Número de comensales
- `duration_minutes` (integer, opcional): Duración en minutos (default: 90)
- `special_requests` (string, opcional): Peticiones especiales

#### Ejemplo de Llamada

```bash
curl -X POST "https://api.restaurante1.gridded.agency/rest/v1/rpc/api_create_reservation" \
  -H "Content-Type: application/json" \
  -H "apikey: TU_ANON_KEY" \
  -d '{
    "customer_name": "Juan Pérez",
    "customer_email": "juan@example.com",
    "customer_phone": "+34600123456",
    "date": "2024-01-15",
    "time": "13:00",
    "guests": 4,
    "duration_minutes": 90,
    "special_requests": "Mesa cerca de la ventana"
  }'
```

#### Respuesta Exitosa

```json
{
  "success": true,
  "reservation_id": "789e0123-e89b-12d3-a456-426614174000",
  "message": "Reservation created successfully",
  "details": {
    "customer_name": "Juan Pérez",
    "date": "2024-01-15",
    "time": "13:00:00",
    "guests": 4,
    "status": "confirmed",
    "assigned_tables": [
      {
        "table_id": "abc123-def456",
        "table_name": "Mesa 5"
      }
    ]
  }
}
```

#### Respuesta de Error

```json
{
  "success": false,
  "error": "No tables available for the requested time",
  "error_code": "NO_AVAILABILITY",
  "details": {
    "date": "2024-01-15",
    "time": "13:00:00",
    "guests": 4,
    "reason": "All tables are occupied or diner capacity limit reached"
  }
}
```

---

### 4. **Obtener Información de Capacidad de Comensales**

**Endpoint:** `get_diners_capacity_info`

Obtiene información detallada sobre la capacidad de comensales por turno para una fecha específica.

#### Parámetros

- `p_date` (string): Fecha en formato YYYY-MM-DD

#### Ejemplo de Llamada

```bash
curl -X POST "https://api.restaurante1.gridded.agency/rest/v1/rpc/get_diners_capacity_info" \
  -H "Content-Type: application/json" \
  -H "apikey: TU_ANON_KEY" \
  -d '{
    "p_date": "2024-01-15"
  }'
```

#### Respuesta

```json
[
  {
    "schedule_id": "456e7890-e89b-12d3-a456-426614174000",
    "opening_time": "12:00:00",
    "closing_time": "16:00:00",
    "max_diners": 25,
    "current_diners": 18,
    "available_diners": 7,
    "is_special_schedule": false
  },
  {
    "schedule_id": "456e7890-e89b-12d3-a456-426614174001",
    "opening_time": "20:00:00",
    "closing_time": "23:30:00",
    "max_diners": 30,
    "current_diners": 5,
    "available_diners": 25,
    "is_special_schedule": false
  }
]
```

---

## 📊 Estados de Capacidad

### Estados de Turno (`status`)

- **`unlimited`** - Sin límite de comensales configurado
- **`available`** - Disponible (menos del 75% de ocupación)
- **`busy`** - Ocupado (75-90% de ocupación)
- **`nearly_full`** - Casi lleno (90-100% de ocupación)
- **`full`** - Completo (100% de ocupación)
- **`insufficient`** - No hay suficiente capacidad para el grupo solicitado

### Estados de Disponibilidad de Mesas (`table_availability`)

- **`available`** - Hay mesas disponibles
- **`unavailable`** - No hay mesas disponibles

### Estados de Capacidad General (`capacity_status`)

- **`no_limits`** - No hay límites de capacidad configurados
- **`no_schedule`** - No hay horarios configurados para el día
- **`capacity_full`** - Capacidad de comensales completa
- **`capacity_insufficient`** - Capacidad insuficiente para el grupo
- **`capacity_nearly_full`** - Capacidad casi completa
- **`capacity_available`** - Capacidad disponible

---

## 🔍 Ejemplos de Casos de Uso

### Caso 1: Verificar Disponibilidad para Grupo Grande

```bash
curl -X POST "https://api.restaurante1.gridded.agency/rest/v1/rpc/api_check_availability_with_capacity" \
  -H "Content-Type: application/json" \
  -H "apikey: TU_ANON_KEY" \
  -d '{
    "date": "2024-01-20",
    "guests": 8,
    "duration_minutes": 120
  }'
```

### Caso 2: Crear Reserva con Peticiones Especiales

```bash
curl -X POST "https://api.restaurante1.gridded.agency/rest/v1/rpc/api_create_reservation" \
  -H "Content-Type: application/json" \
  -H "apikey: TU_ANON_KEY" \
  -d '{
    "customer_name": "María García",
    "customer_email": "maria@example.com",
    "customer_phone": "+34600987654",
    "date": "2024-01-20",
    "time": "20:30",
    "guests": 6,
    "duration_minutes": 120,
    "special_requests": "Cumpleaños - necesitamos espacio para tarta"
  }'
```

### Caso 3: Verificar Capacidad para Día Específico

```bash
curl -X POST "https://api.restaurante1.gridded.agency/rest/v1/rpc/get_diners_capacity_info" \
  -H "Content-Type: application/json" \
  -H "apikey: TU_ANON_KEY" \
  -d '{
    "p_date": "2024-01-20"
  }'
```

---

## ⚠️ Manejo de Errores

### Códigos de Error Comunes

| Código              | Descripción                   | Solución                       |
| ------------------- | ----------------------------- | ------------------------------ |
| `NO_AVAILABILITY`   | No hay disponibilidad         | Probar otra fecha/hora         |
| `CAPACITY_EXCEEDED` | Límite de comensales excedido | Reducir número de invitados    |
| `INVALID_DATE`      | Fecha inválida                | Usar formato YYYY-MM-DD        |
| `RESTAURANT_CLOSED` | Restaurante cerrado           | Elegir día de apertura         |
| `INVALID_TIME`      | Hora fuera del horario        | Verificar horarios de apertura |

### Ejemplo de Respuesta de Error

```json
{
  "success": false,
  "error": "Capacity limit exceeded for this time slot",
  "error_code": "CAPACITY_EXCEEDED",
  "details": {
    "requested_guests": 8,
    "available_capacity": 3,
    "max_capacity": 25,
    "current_occupancy": 22,
    "recommendation": "Try a different time slot or reduce party size"
  }
}
```

---

## 🧪 Testing

### Herramientas Recomendadas

- **Postman** - Para testing interactivo
- **curl** - Para scripts automatizados
- **Insomnia** - Alternativa a Postman

### Variables de Entorno

```bash
export API_BASE_URL="https://api.restaurante1.gridded.agency/rest/v1/rpc"
export API_KEY="tu_anon_key_aqui"
```

### Script de Prueba Básico

```bash
#!/bin/bash
# Test básico de disponibilidad
curl -X POST "$API_BASE_URL/api_check_availability_with_capacity" \
  -H "Content-Type: application/json" \
  -H "apikey: $API_KEY" \
  -d '{
    "date": "2024-01-15",
    "guests": 4,
    "duration_minutes": 90
  }' | jq '.'
```

---

## 📝 Notas Importantes

1. **Límites de Capacidad**: Los límites de comensales por turno se configuran en el panel de administración
2. **Horarios Especiales**: Los horarios especiales tienen prioridad sobre los horarios regulares
3. **Duración por Defecto**: Si no se especifica, la duración por defecto es 90 minutos
4. **Zona Horaria**: Todas las horas están en zona horaria Europe/Madrid
5. **Rate Limiting**: Las APIs tienen límites de velocidad, respeta los headers de rate limiting

---

## 🔄 Versionado

- **v1** - Versión actual con soporte completo para límites de comensales
- Las APIs mantienen compatibilidad hacia atrás
- Los cambios breaking se comunicarán con antelación

---

## 📞 Soporte

Para dudas sobre la implementación o problemas con las APIs:

- Revisar los logs de Supabase para errores detallados
- Verificar que todas las funciones SQL estén correctamente implementadas
- Comprobar la configuración de horarios y límites en el panel de administración
