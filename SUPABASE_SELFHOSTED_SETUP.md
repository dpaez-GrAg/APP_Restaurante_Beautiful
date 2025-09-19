# Configuración de Supabase Autohospedado para Tu Mesa Ideal

Este documento explica cómo implementar las funciones PostgreSQL necesarias para el sistema de reservas en un entorno de Supabase autohospedado.

## Implementación de Funciones PostgreSQL

A diferencia de Supabase Cloud, que utiliza Edge Functions basadas en Deno, en Supabase autohospedado necesitamos implementar funciones PostgreSQL directamente en la base de datos.

### 1. Accede a tu Base de Datos PostgreSQL

Puedes hacerlo a través de:

- La interfaz SQL del panel de administración de Supabase
- Directamente con psql o cualquier cliente PostgreSQL
- A través de la API REST de PostgreSQL

### 2. Implementa las Funciones en el Orden Correcto

Es importante ejecutar los scripts SQL en el siguiente orden:

1. **Primero, implementa la función para crear reservas**:

   ```sql
   -- Abre el archivo docs/sql/agent-create-reservation.sql
   -- Copia todo su contenido y ejecútalo en el editor SQL
   ```

2. **Luego, implementa la función para verificar disponibilidad**:

   ```sql
   -- Abre el archivo docs/sql/agent-availability.sql
   -- Copia todo su contenido y ejecútalo en el editor SQL
   ```

3. **Finalmente, configura los endpoints HTTP**:
   ```sql
   -- Abre el archivo docs/sql/http_endpoints.sql
   -- Copia todo su contenido y ejecútalo en el editor SQL
   ```

### 3. Solución de Errores Comunes

#### Error: "syntax error at or near 'CREATE'"

Si recibes este error:

```
ERROR: 42601: syntax error at or near "CREATE"
LINE 5: CREATE OR REPLACE FUNCTION agent_create_reservation(request JSONB)
```

**Solución**: Asegúrate de ejecutar cada función por separado. No copies comentarios ni líneas vacías adicionales. Cada sentencia `CREATE OR REPLACE FUNCTION` debe ser ejecutada como una consulta independiente.

#### Error: "function create_reservation_with_assignment does not exist"

Si recibes este error, significa que la función base que utiliza nuestra nueva función no existe.

**Solución**: Verifica que la función `create_reservation_with_assignment` exista ejecutando:

```sql
SELECT * FROM pg_proc WHERE proname = 'create_reservation_with_assignment';
```

Si no existe, necesitas ejecutar primero el script de bootstrap:

```sql
-- Ejecuta el script de bootstrap completo
\i docs/sql/bootstrap_full.sql
```

### 4. Prueba los Endpoints

Una vez configurados los endpoints, puedes probarlos usando cURL o Postman:

#### Verificar Disponibilidad

```bash
curl -X POST "https://api.restaurante1.gridded.agency/rest/v1/rpc/http_agent_availability" \
  -H "Content-Type: application/json" \
  -H "apikey: TU_ANON_KEY" \
  -d '{
    "date": "2025-10-01",
    "guests": 2
  }'
```

#### Crear Reserva

```bash
curl -X POST "https://api.restaurante1.gridded.agency/rest/v1/rpc/http_agent_create_reservation" \
  -H "Content-Type: application/json" \
  -H "apikey: TU_ANON_KEY" \
  -d '{
    "customer_name": "Test User",
    "customer_email": "test@example.com",
    "customer_phone": "+34 123 456 789",
    "date": "2025-10-01",
    "time": "20:00",
    "guests": 2,
    "special_requests": "Testing API endpoint"
  }'
```

## Actualización del Frontend

El componente `ReservationForm.tsx` ya está preparado para funcionar tanto con Edge Functions como con RPC directa. Si las Edge Functions no están disponibles, automáticamente utilizará el método RPC.

## Verificación de la Implementación

Para verificar que todo está funcionando correctamente:

1. **Verifica que las funciones existan en la base de datos**:

   ```sql
   SELECT proname, proargnames
   FROM pg_proc
   WHERE proname LIKE 'agent_%' OR proname LIKE 'http_agent_%';
   ```

2. **Verifica los permisos**:

   ```sql
   SELECT grantee, privilege_type
   FROM information_schema.routine_privileges
   WHERE routine_name LIKE 'http_agent_%';
   ```

3. **Prueba la función directamente en SQL**:
   ```sql
   SELECT * FROM agent_availability('{"date": "2025-10-01", "guests": 2}');
   ```

## Notas Adicionales

- Las funciones PostgreSQL son más limitadas que las Edge Functions de Deno, pero son compatibles con todas las instalaciones de Supabase
- Si necesitas funcionalidad más avanzada, considera implementar un servidor API separado que se comunique con Supabase
- Para desarrollo local, puedes seguir usando el método RPC directo sin necesidad de configurar estas funciones

## Archivo Unificado de Implementación

```sql
-- 1. Crear función para reservas con asignación automática
CREATE OR REPLACE FUNCTION create_reservation_with_assignment(
  p_customer_id uuid,
  p_date date,
  p_time time,
  p_guests integer,
  p_special_requests text,
  p_duration_minutes integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reservation_id UUID;
  v_start_at TIMESTAMP WITH TIME ZONE;
  v_end_at TIMESTAMP WITH TIME ZONE;
  v_assigned_tables UUID[];
  v_table_record RECORD;
  v_needed_capacity INTEGER;
  v_current_capacity INTEGER;
  v_day_of_week INTEGER;
  v_schedule_exists BOOLEAN;
  v_special_closed BOOLEAN;
  v_special_schedule RECORD;
  v_combination RECORD;
BEGIN
  -- Normalize to Europe/Madrid
  v_start_at := ((p_date::TEXT || ' ' || p_time::TEXT)::TIMESTAMP AT TIME ZONE 'Europe/Madrid');
  v_end_at := v_start_at + (p_duration_minutes || ' minutes')::INTERVAL;

  v_day_of_week := EXTRACT(DOW FROM p_date);

  -- Check if restaurant is closed
  SELECT COUNT(*) > 0 INTO v_special_closed
  FROM public.special_closed_days
  WHERE (
    (NOT is_range AND date = p_date) OR
    (is_range AND p_date BETWEEN range_start AND range_end)
  );
  IF v_special_closed THEN
    RETURN json_build_object('success', false, 'error', 'Restaurant is closed on selected date');
  END IF;

  -- Check opening hours
  SELECT opening_time, closing_time INTO v_special_schedule
  FROM public.special_schedule_days
  WHERE date = p_date AND is_active = true
  LIMIT 1;

  IF FOUND THEN
    IF p_time < v_special_schedule.opening_time OR p_time >= v_special_schedule.closing_time THEN
      RETURN json_build_object('success', false, 'error', 'Restaurant is closed at selected time');
    END IF;
  ELSE
    SELECT COUNT(*) > 0 INTO v_schedule_exists
    FROM public.restaurant_schedules
    WHERE day_of_week = v_day_of_week AND is_active = true
      AND p_time >= opening_time AND p_time < closing_time;
    IF NOT v_schedule_exists THEN
      RETURN json_build_object('success', false, 'error', 'Restaurant is closed at selected time');
    END IF;
  END IF;

  v_needed_capacity := p_guests;
  v_assigned_tables := ARRAY[]::UUID[];
  v_current_capacity := 0;

  -- PASO 1: Buscar una mesa individual con capacidad suficiente
  SELECT t.id
  INTO v_table_record
  FROM public.tables t
  WHERE t.is_active = true
    AND (t.capacity + COALESCE(t.extra_capacity, 0)) >= v_needed_capacity
    AND t.id NOT IN (
      SELECT rta.table_id
      FROM public.reservation_table_assignments rta
      JOIN public.reservations r ON rta.reservation_id = r.id
      WHERE r.date = p_date
        AND r.status != 'cancelled'
        AND (
          ((r.date::text || ' ' || r.time::text)::timestamp AT TIME ZONE 'Europe/Madrid') < v_end_at
          AND ((r.date::text || ' ' || r.time::text)::timestamp AT TIME ZONE 'Europe/Madrid'
               + (COALESCE(r.duration_minutes, 90) || ' minutes')::interval) > v_start_at
        )
    )
  ORDER BY (t.capacity + COALESCE(t.extra_capacity, 0)) ASC  -- Mesa más pequeña que cubra la necesidad
  LIMIT 1;

  IF FOUND THEN
    -- Encontramos una mesa individual que funciona
    v_assigned_tables := ARRAY[v_table_record.id]::uuid[];
    SELECT (t.capacity + COALESCE(t.extra_capacity, 0)) INTO v_current_capacity
    FROM public.tables t WHERE t.id = v_table_record.id;
  ELSE
    -- PASO 2: No hay mesa individual, buscar combinaciones válidas
    FOR v_combination IN
      SELECT tc.*, tc.total_capacity + COALESCE(tc.extra_capacity, 0) as effective_capacity
      FROM public.table_combinations tc
      WHERE tc.is_active = true
        AND p_guests >= COALESCE(tc.min_capacity, 1)
        AND (tc.max_capacity IS NULL OR p_guests <= tc.max_capacity)
        AND (tc.total_capacity + COALESCE(tc.extra_capacity, 0)) >= p_guests
      ORDER BY tc.total_capacity + COALESCE(tc.extra_capacity, 0) ASC  -- Combinación más pequeña que funcione
    LOOP
      -- Check if all tables in this combination are available
      IF NOT EXISTS (
        SELECT 1
        FROM public.reservation_table_assignments rta
        JOIN public.reservations r ON rta.reservation_id = r.id
        WHERE rta.table_id = ANY(v_combination.table_ids)
          AND r.date = p_date
          AND r.status != 'cancelled'
          AND (
            ((r.date::text || ' ' || r.time::text)::timestamp AT TIME ZONE 'Europe/Madrid') < v_end_at
            AND ((r.date::text || ' ' || r.time::text)::timestamp AT TIME ZONE 'Europe/Madrid'
                 + (COALESCE(r.duration_minutes, 90) || ' minutes')::interval) > v_start_at
          )
      ) THEN
        -- This combination is available
        v_assigned_tables := v_combination.table_ids;
        v_current_capacity := v_combination.effective_capacity;
        EXIT;
      END IF;
    END LOOP;

    -- Si no encontramos combinación válida, la reserva no se puede realizar
    IF array_length(v_assigned_tables, 1) = 0 OR v_assigned_tables IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'No hay mesas individuales ni combinaciones disponibles para esta capacidad');
    END IF;
  END IF;

  -- Verificar que tenemos capacidad suficiente
  IF v_current_capacity < v_needed_capacity THEN
    RETURN json_build_object('success', false, 'error', 'Not enough table capacity available');
  END IF;

  INSERT INTO public.reservations (
    customer_id, date, time, guests, special_requests,
    status, duration_minutes, start_at, end_at
  )
  VALUES (
    p_customer_id, p_date, p_time, p_guests, p_special_requests,
    'confirmed', p_duration_minutes, v_start_at, v_end_at
  )
  RETURNING id INTO v_reservation_id;

  FOR i IN 1..array_length(v_assigned_tables, 1) LOOP
    INSERT INTO public.reservation_table_assignments (reservation_id, table_id)
    VALUES (v_reservation_id, v_assigned_tables[i]);
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'reservation_id', v_reservation_id,
    'assigned_tables', v_assigned_tables
  );
END;
$$;

-- 2. Crear función para reservas con mesas específicas
CREATE OR REPLACE FUNCTION create_reservation_with_specific_tables(
  p_customer_id uuid,
  p_date date,
  p_time time,
  p_guests integer,
  p_special_requests text,
  p_table_ids uuid[],
  p_duration_minutes integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reservation_id UUID;
  v_start_at TIMESTAMP WITH TIME ZONE;
  v_end_at TIMESTAMP WITH TIME ZONE;
  v_current_capacity INTEGER;
  v_day_of_week INTEGER;
  v_schedule_exists BOOLEAN;
  v_special_closed BOOLEAN;
  v_special_schedule RECORD;
BEGIN
  -- Normalize to Europe/Madrid
  v_start_at := ((p_date::TEXT || ' ' || p_time::TEXT)::TIMESTAMP AT TIME ZONE 'Europe/Madrid');
  v_end_at := v_start_at + (p_duration_minutes || ' minutes')::INTERVAL;

  v_day_of_week := EXTRACT(DOW FROM p_date);

  SELECT COUNT(*) > 0 INTO v_special_closed
  FROM public.special_closed_days
  WHERE (
    (NOT is_range AND date = p_date) OR
    (is_range AND p_date BETWEEN range_start AND range_end)
  );
  IF v_special_closed THEN
    RETURN json_build_object('success', false, 'error', 'Restaurant is closed on selected date');
  END IF;

  SELECT opening_time, closing_time INTO v_special_schedule
  FROM public.special_schedule_days
  WHERE date = p_date AND is_active = true
  LIMIT 1;

  IF FOUND THEN
    IF p_time < v_special_schedule.opening_time OR p_time >= v_special_schedule.closing_time THEN
      RETURN json_build_object('success', false, 'error', 'Restaurant is closed at selected time');
    END IF;
  ELSE
    SELECT COUNT(*) > 0 INTO v_schedule_exists
    FROM public.restaurant_schedules
    WHERE day_of_week = v_day_of_week AND is_active = true
      AND p_time >= opening_time AND p_time < closing_time;
    IF NOT v_schedule_exists THEN
      RETURN json_build_object('success', false, 'error', 'Restaurant is closed at selected time');
    END IF;
  END IF;

  -- Effective capacity of selected tables
  SELECT COALESCE(SUM(t.capacity + COALESCE(t.extra_capacity, 0)), 0) INTO v_current_capacity
  FROM public.tables t
  WHERE t.id = ANY(p_table_ids) AND t.is_active = true;

  IF v_current_capacity < p_guests THEN
    RETURN json_build_object('success', false, 'error', 'Selected tables do not have enough capacity');
  END IF;

  -- Check overlap with selected tables using local Europe/Madrid times
  IF EXISTS (
    SELECT 1
    FROM public.reservation_table_assignments rta
    JOIN public.reservations r ON rta.reservation_id = r.id
    WHERE rta.table_id = ANY(p_table_ids)
      AND r.date = p_date
      AND r.status != 'cancelled'
      AND (
        ((r.date::text || ' ' || r.time::text)::timestamp AT TIME ZONE 'Europe/Madrid') <= v_start_at
        AND ((r.date::text || ' ' || r.time::text)::timestamp AT TIME ZONE 'Europe/Madrid'
             + (COALESCE(r.duration_minutes, 90) || ' minutes')::interval) > v_start_at
      ) OR (
        ((r.date::text || ' ' || r.time::text)::timestamp AT TIME ZONE 'Europe/Madrid') < v_end_at
        AND ((r.date::text || ' ' || r.time::text)::timestamp AT TIME ZONE 'Europe/Madrid'
             + (COALESCE(r.duration_minutes, 90) || ' minutes')::interval) >= v_end_at
      ) OR (
        ((r.date::text || ' ' || r.time::text)::timestamp AT TIME ZONE 'Europe/Madrid') >= v_start_at
        AND ((r.date::text || ' ' || r.time::text)::timestamp AT TIME ZONE 'Europe/Madrid'
             + (COALESCE(r.duration_minutes, 90) || ' minutes')::interval) <= v_end_at
      )
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Selected tables are not available at this time');
  END IF;

  INSERT INTO public.reservations (
    customer_id, date, time, guests, special_requests,
    status, duration_minutes, start_at, end_at
  )
  VALUES (
    p_customer_id, p_date, p_time, p_guests, p_special_requests,
    'confirmed', p_duration_minutes, v_start_at, v_end_at
  )
  RETURNING id INTO v_reservation_id;

  FOR i IN 1..array_length(p_table_ids, 1) LOOP
    INSERT INTO public.reservation_table_assignments (reservation_id, table_id)
    VALUES (v_reservation_id, p_table_ids[i]);
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'reservation_id', v_reservation_id,
    'assigned_tables', p_table_ids
  );
END;
$$;

-- 3. Crear función para obtener slots disponibles
CREATE OR REPLACE FUNCTION get_available_time_slots(
  p_date date,
  p_guests integer,
  p_duration_minutes integer DEFAULT 90
)
RETURNS TABLE(id uuid, slot_time time, capacity integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_day_of_week integer;
  v_special_closed boolean;
  v_opening time without time zone;
  v_closing time without time zone;
  rec record;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_available_capacity integer;
BEGIN
  v_day_of_week := EXTRACT(DOW FROM p_date);

  SELECT COUNT(*) > 0 INTO v_special_closed
  FROM public.special_closed_days scd
  WHERE (
    (NOT scd.is_range AND scd.date = p_date) OR
    (scd.is_range AND p_date BETWEEN scd.range_start AND scd.range_end)
  );

  IF v_special_closed THEN
    RETURN;
  END IF;

  SELECT ssd.opening_time, ssd.closing_time
  INTO v_opening, v_closing
  FROM public.special_schedule_days ssd
  WHERE ssd.date = p_date AND ssd.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    SELECT rs.opening_time, rs.closing_time
    INTO v_opening, v_closing
    FROM public.restaurant_schedules rs
    WHERE rs.day_of_week = v_day_of_week AND rs.is_active = true
    LIMIT 1;

    IF NOT FOUND THEN
      RETURN;
    END IF;
  END IF;

  FOR rec IN
    SELECT ts.id, ts.time, ts.max_capacity
    FROM public.time_slots ts
    WHERE ts.time >= v_opening AND ts.time < v_closing
    ORDER BY ts.time
  LOOP
    -- Europe/Madrid local time baseline
    v_start_at := ((p_date::text || ' ' || rec.time::text)::timestamp AT TIME ZONE 'Europe/Madrid');
    v_end_at := v_start_at + (p_duration_minutes || ' minutes')::interval;

    -- Effective available capacity (capacity + extra_capacity) excluding overlapping reservations
    SELECT COALESCE(SUM(t.capacity + COALESCE(t.extra_capacity, 0)), 0) INTO v_available_capacity
    FROM public.tables t
    WHERE t.is_active = true
      AND t.id NOT IN (
        SELECT rta.table_id
        FROM public.reservation_table_assignments rta
        JOIN public.reservations r ON rta.reservation_id = r.id
        WHERE r.date = p_date
          AND r.status <> 'cancelled'
          AND (
            -- Compute reservation start/end from date + time consistently in Europe/Madrid
            (((r.date::text || ' ' || r.time::text)::timestamp AT TIME ZONE 'Europe/Madrid') <= v_start_at
              AND ((r.date::text || ' ' || r.time::text)::timestamp AT TIME ZONE 'Europe/Madrid'
                   + (COALESCE(r.duration_minutes, 90) || ' minutes')::interval) > v_start_at)
            OR
            (((r.date::text || ' ' || r.time::text)::timestamp AT TIME ZONE 'Europe/Madrid') < v_end_at
              AND ((r.date::text || ' ' || r.time::text)::timestamp AT TIME ZONE 'Europe/Madrid'
                   + (COALESCE(r.duration_minutes, 90) || ' minutes')::interval) >= v_end_at)
            OR
            (((r.date::text || ' ' || r.time::text)::timestamp AT TIME ZONE 'Europe/Madrid') >= v_start_at
              AND ((r.date::text || ' ' || r.time::text)::timestamp AT TIME ZONE 'Europe/Madrid'
                   + (COALESCE(r.duration_minutes, 90) || ' minutes')::interval) <= v_end_at)
          )
      );

    IF LEAST(v_available_capacity, rec.max_capacity) >= p_guests THEN
      id := rec.id;
      slot_time := rec.time;
      capacity := LEAST(v_available_capacity, rec.max_capacity);
      RETURN NEXT;
    END IF;
  END LOOP;

  RETURN;
END;
$$;

-- 4. Crear función administrativa principal
CREATE OR REPLACE FUNCTION admin_create_reservation(
  p_customer_name text,
  p_customer_email text,
  p_date date,
  p_time time,
  p_guests integer,
  p_customer_phone text,
  p_special_requests text,
  p_table_ids uuid[],
  p_duration_minutes integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_customer_id UUID;
  v_reservation_result JSON;
BEGIN
  -- Create or get customer
  INSERT INTO public.customers (name, email, phone)
  VALUES (p_customer_name, p_customer_email, p_customer_phone)
  ON CONFLICT (email) DO UPDATE SET
    name = EXCLUDED.name,
    phone = COALESCE(EXCLUDED.phone, customers.phone),
    updated_at = now()
  RETURNING id INTO v_customer_id;

  -- Create reservation with specific tables or auto-assignment
  IF p_table_ids IS NOT NULL THEN
    SELECT public.create_reservation_with_specific_tables(
      v_customer_id, p_date, p_time, p_guests, p_special_requests, p_table_ids, p_duration_minutes
    ) INTO v_reservation_result;
  ELSE
    SELECT public.create_reservation_with_assignment(
      v_customer_id, p_date, p_time, p_guests, p_special_requests, p_duration_minutes
    ) INTO v_reservation_result;
  END IF;

  RETURN v_reservation_result;
END;
$$;

-- 5. Crear funciones wrapper para API externa
CREATE OR REPLACE FUNCTION api_create_reservation(request_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT admin_create_reservation(
    request_data->>'customer_name',
    request_data->>'customer_email',
    (request_data->>'date')::date,
    (request_data->>'time')::time,
    (request_data->>'guests')::integer,
    request_data->>'customer_phone',
    request_data->>'special_requests',
    CASE
      WHEN request_data->'table_ids' IS NOT NULL
      THEN ARRAY(SELECT jsonb_array_elements_text(request_data->'table_ids'))::uuid[]
      ELSE NULL
    END,
    COALESCE((request_data->>'duration_minutes')::integer, 90)
  ) INTO result;

  RETURN result::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION api_check_availability(request_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  available_slots jsonb;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', slot.id,
      'time', slot.slot_time,
      'capacity', slot.capacity
    )
  ) INTO available_slots
  FROM get_available_time_slots(
    (request_data->>'date')::date,
    (request_data->>'guests')::integer,
    COALESCE((request_data->>'duration_minutes')::integer, 90)
  ) AS slot;

  RETURN jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'date', request_data->>'date',
      'guests', request_data->>'guests',
      'available_slots', COALESCE(available_slots, '[]'::jsonb)
    )
  );
END;
$$;

-- Otorgar permisos para acceso anónimo
GRANT EXECUTE ON FUNCTION api_create_reservation(jsonb) TO anon;
GRANT EXECUTE ON FUNCTION api_check_availability(jsonb) TO anon;
```

## Cómo Ejecutar

1. **Accede a tu panel de Supabase**

   - Ve a la sección "SQL Editor"

2. **Para cada bloque SQL**:

   - Copia el bloque completo
   - Pégalo en el SQL Editor de Supabase
   - Ejecuta la consulta
   - Verifica que no haya errores

3. **Verifica la instalación**:
   ```sql
   -- Verificar que las funciones se crearon correctamente
   SELECT proname, proargnames
   FROM pg_proc
   WHERE proname IN (
     'admin_create_reservation',
     'create_reservation_with_assignment',
     'create_reservation_with_specific_tables',
     'get_available_time_slots',
     'api_create_reservation',
     'api_check_availability'
   );
   ```

## Endpoints API Disponibles

Una vez implementadas las funciones, tendrás estos endpoints disponibles:

### Opción 1: Usando funciones con objeto JSON

#### Crear Reserva

```bash
curl -X POST "https://api.restaurante1.gridded.agency/rest/v1/rpc/api_create_reservation" \
  -H "Content-Type: application/json" \
  -H "apikey: TU_ANON_KEY" \
  -d '{
    "request_data": {
      "customer_name": "Juan Pérez",
      "customer_email": "juan@example.com",
      "customer_phone": "+34 123 456 789",
      "date": "2025-01-15",
      "time": "20:00",
      "guests": 4,
      "special_requests": "Mesa cerca de la ventana",
      "duration_minutes": 90
    }
  }'
```

#### Verificar Disponibilidad

```bash
curl -X POST "https://api.restaurante1.gridded.agency/rest/v1/rpc/api_check_availability" \
  -H "Content-Type: application/json" \
  -H "apikey: TU_ANON_KEY" \
  -d '{
    "request_data": {
      "date": "2025-01-15",
      "guests": 4,
      "duration_minutes": 90
    }
  }'
```

### Opción 2: Usando funciones con parámetros individuales

#### Crear Reserva

```bash
curl -X POST "https://api.restaurante1.gridded.agency/rest/v1/rpc/api_create_reservation" \
  -H "Content-Type: application/json" \
  -H "apikey: TU_ANON_KEY" \
  -d '{
    "customer_name": "Juan Pérez",
    "customer_email": "juan@example.com",
    "customer_phone": "+34 123 456 789",
    "reservation_date": "2025-01-15",
    "reservation_time": "20:00",
    "guests": 4,
    "special_requests": "Mesa cerca de la ventana",
    "duration_minutes": 90
  }'
```

#### Verificar Disponibilidad

```bash
curl -X POST "https://api.restaurante1.gridded.agency/rest/v1/rpc/api_check_availability" \
  -H "Content-Type: application/json" \
  -H "apikey: TU_ANON_KEY" \
  -d '{
    "date": "2025-01-15",
    "guests": 4,
    "duration_minutes": 90
  }'
```

## Actualización del Frontend

El frontend ya está configurado para usar estas funciones. Las llamadas a Edge Functions fallarán automáticamente y usarán las funciones RPC como respaldo.

## Solución de Problemas

### Error: "function does not exist"

- Verifica que ejecutaste los archivos en el orden correcto
- Asegúrate de que no hay errores de sintaxis en las funciones
- Comprueba que el nombre y los parámetros de la función son correctos en la llamada

### Error: "permission denied"

- Verifica que las funciones tienen `SECURITY DEFINER`
- Asegúrate de que se ejecutaron los comandos `GRANT`

### Error: "relation does not exist"

- Verifica que todas las tablas necesarias existen en tu base de datos
- Ejecuta el script de bootstrap si es necesario

### Error: "syntax error at or near 'time'"

- Evita usar palabras reservadas como nombres de parámetros
- Usa prefijos como `p_` o nombres más descriptivos como `reservation_time` en lugar de `time`

## Funciones Implementadas

✅ `admin_create_reservation` - Función principal para crear reservas
✅ `create_reservation_with_assignment` - Asignación automática de mesas
✅ `create_reservation_with_specific_tables` - Asignación de mesas específicas  
✅ `get_available_time_slots` - Obtener horarios disponibles
✅ `api_create_reservation` - Wrapper para API externa (crear reservas)
✅ `api_check_availability` - Wrapper para API externa (verificar disponibilidad)

Estas funciones replican exactamente la funcionalidad que tenías en Supabase Cloud.
