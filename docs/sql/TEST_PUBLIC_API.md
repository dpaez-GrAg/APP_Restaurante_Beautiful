# 🧪 Tests para API Pública

## 📋 Configuración

```bash
# Variables de entorno
export API_URL="https://api.restaurante1.gridded.agency/rest/v1/rpc"
export API_KEY="tu_api_key_aqui"
```

---

## 1️⃣ Test: Verificar Disponibilidad

```bash
curl -X POST "$API_URL/api_check_availability" \
  -H "Content-Type: application/json" \
  -H "apikey: $API_KEY" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "p_date": "2025-10-28",
    "p_guests": 4,
    "p_duration_minutes": 90
  }'
```

**Respuesta esperada:**
```json
{
  "success": true,
  "date": "2025-10-28",
  "guests": 4,
  "available_slots": [
    {
      "time": "13:00",
      "zone": "Terraza"
    },
    {
      "time": "13:15",
      "zone": "Salón Principal"
    }
  ]
}
```

---

## 2️⃣ Test: Crear Reserva

```bash
curl -X POST "$API_URL/public_create_reservation" \
  -H "Content-Type: application/json" \
  -H "apikey: $API_KEY" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "p_name": "Juan Pérez",
    "p_phone": "666777888",
    "p_date": "2025-10-28",
    "p_time": "15:15",
    "p_guests": 4,
    "p_email": "juan@example.com",
    "p_duration_minutes": 90,
    "p_special_requests": "Mesa junto a ventana"
  }'
```

**Respuesta esperada (éxito):**
```json
{
  "success": true,
  "message": "Reserva creada exitosamente",
  "customer": {
    "name": "Juan Pérez",
    "phone": "666777888"
  },
  "reservation": {
    "date": "2025-10-28",
    "time": "15:15:00",
    "guests": 4,
    "duration_minutes": 90,
    "special_requests": "Mesa junto a ventana"
  },
  "tables": [
    {
      "name": "Mesa 5",
      "zone": "Terraza"
    },
    {
      "name": "Mesa 6",
      "zone": "Terraza"
    }
  ]
}
```

**Respuesta esperada (error - no hay mesas):**
```json
{
  "success": false,
  "error": "No hay mesas disponibles para esta capacidad en el horario solicitado"
}
```

---

## 3️⃣ Test: Buscar Reservas

```bash
curl -X POST "$API_URL/public_find_reservation" \
  -H "Content-Type: application/json" \
  -H "apikey: $API_KEY" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "p_phone": "666777888"
  }'
```

**Respuesta esperada:**
```json
{
  "success": true,
  "message": "Reservas encontradas",
  "reservations": [
    {
      "reservation_id": "uuid",
      "date": "2025-10-28",
      "time": "15:15:00",
      "guests": 4,
      "status": "confirmed",
      "special_requests": "Mesa junto a ventana",
      "customer_name": "Juan Pérez",
      "customer_phone": "666777888",
      "tables": [
        {
          "name": "Mesa 5",
          "capacity": 4,
          "zone": "Terraza"
        }
      ]
    }
  ]
}
```

---

## 4️⃣ Test: Cancelar Reserva

```bash
curl -X POST "$API_URL/public_cancel_reservation" \
  -H "Content-Type: application/json" \
  -H "apikey: $API_KEY" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "p_phone": "666777888",
    "p_date": "2025-10-28",
    "p_time": "15:15",
    "p_reason": "Cambio de planes"
  }'
```

**Respuesta esperada:**
```json
{
  "success": true,
  "message": "Reserva cancelada exitosamente",
  "reservation_id": "uuid",
  "customer_name": "Juan Pérez",
  "date": "2025-10-28",
  "time": "15:15:00"
}
```

---

## 🔍 Verificación en Base de Datos

### Verificar que las funciones existen:

```sql
SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname LIKE 'public_%'
ORDER BY p.proname;
```

**Resultado esperado:**
```
function_name              | arguments
---------------------------|------------------------------------------
api_check_availability     | p_date date, p_guests integer, p_duration_minutes integer DEFAULT 120
public_cancel_reservation  | p_phone text, p_date date, p_time time, p_reason text DEFAULT NULL
public_create_reservation  | p_name text, p_phone text, p_date date, p_time time, p_guests integer, p_email text DEFAULT NULL, p_duration_minutes integer DEFAULT 90, p_special_requests text DEFAULT NULL
public_find_reservation    | p_phone text
```

### Verificar permisos:

```sql
SELECT 
    p.proname,
    array_agg(a.rolname) as granted_to
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
LEFT JOIN pg_proc_acl pa ON p.oid = pa.objid
LEFT JOIN pg_authid a ON pa.grantee = a.oid
WHERE n.nspname = 'public'
  AND p.proname IN ('public_create_reservation', 'public_find_reservation', 'public_cancel_reservation', 'api_check_availability')
GROUP BY p.proname;
```

---

## 🐛 Troubleshooting

### Error: "Could not find the function"

**Causa:** La función no existe en la base de datos.

**Solución:**
```bash
# Ejecutar el script de instalación
psql "postgresql://user:pass@api.restaurante1.gridded.agency/db" \
  -f docs/sql/INSTALL_PUBLIC_API_FUNCTIONS.sql
```

### Error: "permission denied for function"

**Causa:** El rol `anon` no tiene permisos.

**Solución:**
```sql
GRANT EXECUTE ON FUNCTION public_create_reservation TO anon;
GRANT EXECUTE ON FUNCTION public_find_reservation TO anon;
GRANT EXECUTE ON FUNCTION public_cancel_reservation TO anon;
GRANT EXECUTE ON FUNCTION api_check_availability TO anon;
```

### Error: "No hay mesas disponibles"

**Causa:** No hay mesas libres o la capacidad es insuficiente.

**Verificación:**
```sql
-- Ver disponibilidad real
SELECT * FROM get_available_time_slots_with_zones('2025-10-28', 4, 90);

-- Ver mesas activas
SELECT id, name, capacity, is_active FROM tables WHERE is_active = true;

-- Ver reservas del día
SELECT * FROM reservations WHERE date = '2025-10-28' AND status IN ('confirmed', 'arrived');
```

---

## 📊 Flujo Completo de Prueba

```bash
#!/bin/bash

API_URL="https://api.restaurante1.gridded.agency/rest/v1/rpc"
API_KEY="tu_api_key"

echo "1. Verificar disponibilidad..."
curl -X POST "$API_URL/api_check_availability" \
  -H "Content-Type: application/json" \
  -H "apikey: $API_KEY" \
  -d '{"p_date": "2025-10-28", "p_guests": 4, "p_duration_minutes": 90}'

echo -e "\n\n2. Crear reserva..."
RESERVATION=$(curl -X POST "$API_URL/public_create_reservation" \
  -H "Content-Type: application/json" \
  -H "apikey: $API_KEY" \
  -d '{
    "p_name": "Test User",
    "p_phone": "999888777",
    "p_date": "2025-10-28",
    "p_time": "15:00",
    "p_guests": 4,
    "p_duration_minutes": 90
  }')

echo $RESERVATION

echo -e "\n\n3. Buscar reserva..."
curl -X POST "$API_URL/public_find_reservation" \
  -H "Content-Type: application/json" \
  -H "apikey: $API_KEY" \
  -d '{"p_phone": "999888777"}'

echo -e "\n\n4. Cancelar reserva..."
curl -X POST "$API_URL/public_cancel_reservation" \
  -H "Content-Type: application/json" \
  -H "apikey: $API_KEY" \
  -d '{
    "p_phone": "999888777",
    "p_date": "2025-10-28",
    "p_time": "15:00",
    "p_reason": "Test completado"
  }'

echo -e "\n\nTest completado!"
```

---

**Fecha:** 27 de Octubre, 2025  
**Versión:** 1.0
