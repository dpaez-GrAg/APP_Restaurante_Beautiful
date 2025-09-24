# ANÁLISIS EXHAUSTIVO: FRONTEND vs BASE DE DATOS

## 🔍 **INCONSISTENCIAS CRÍTICAS IDENTIFICADAS**

### 1. **ESTADOS DE RESERVA - INCONSISTENCIA TOTAL**

#### **BASE DE DATOS (01_database_structure.sql):**

```sql
-- Línea 15: Define ENUM
CREATE TYPE reservation_status AS ENUM ('pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show');

-- Línea 145: Pero usa TEXT en la tabla ❌
status TEXT DEFAULT 'pending'
```

#### **FRONTEND (ReservationsManager.tsx):**

```typescript
// Línea 190: Solo maneja 3 estados
updateReservationStatus = async (id: string, newStatus: "confirmed" | "cancelled" | "arrived") => {

// Línea 548: Usa "confirmed"
onClick={() => updateReservationStatus(reservation.id, "confirmed")}

// Línea 661: Usa "cancelled"
updateReservationStatus(reservationToCancel?.id, "cancelled");
```

#### **FRONTEND (types/customer.ts):**

```typescript
// Línea 36: Define solo 4 estados
status: "pending" | "confirmed" | "completed" | "cancelled";
```

#### **FRONTEND (useDashboardData.ts):**

```typescript
// Líneas 66-68: Filtra por estados que no coinciden
const confirmedReservations = reservations?.filter((r) => r.status === "confirmed") || [];
const cancelledReservations = reservations?.filter((r) => r.status === "cancelled") || [];
const completedReservations = reservations?.filter((r) => r.status === "completed") || [];
```

**❌ PROBLEMA:** Frontend usa `arrived` pero BD define `seated`. Frontend no maneja `no_show`.

---

### 2. **CAMPO CLASSIFICATION FALTANTE**

#### **BASE DE DATOS (01_database_structure.sql):**

```sql
-- Líneas 127-134: customers table SIN campo classification
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,  -- ❌ UNIQUE pero frontend espera nullable
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
```

#### **FRONTEND (types/customer.ts):**

```typescript
// Línea 8: Espera campo classification
classification: CustomerClassification;

// Línea 1: Define tipos de classification
export type CustomerClassification = "VIP" | "NEUTRO" | "ALERTA" | "RED_FLAG";
```

**❌ PROBLEMA:** Frontend espera campo `classification` que no existe en BD.

---

### 3. **CAMPO MAX_DINERS INCONSISTENTE**

#### **BASE DE DATOS (01_database_structure.sql):**

```sql
-- Línea 301: Crea campo max_diners
ADD COLUMN IF NOT EXISTS max_diners INTEGER;
```

#### **BASE DE DATOS (03_reservation_functions.sql):**

```sql
-- Línea 75: Busca max_diners (correcto)
SELECT ssd.opening_time, ssd.closing_time, ssd.max_diners

-- Línea 105: Busca max_diners (correcto)
SELECT rs.opening_time, rs.closing_time, rs.max_diners
```

#### **TU ERROR ACTUAL:**

```
Error: record "v_schedule_record" has no field "max_diners_per_service"
```

**❌ PROBLEMA:** Alguna función busca `max_diners_per_service` en lugar de `max_diners`.

---

### 4. **FUNCIÓN is_table_available PROBLEMÁTICA**

#### **BASE DE DATOS (03_reservation_functions.sql):**

```sql
-- Línea 42: Solo considera 'confirmed' y 'seated'
AND r.status IN ('confirmed', 'seated')
```

#### **FRONTEND:** Usa estado `arrived` que no se considera en disponibilidad.

**❌ PROBLEMA:** Reservas con estado `arrived` no bloquean mesas → SUPERPOSICIONES.

---

### 5. **TIPOS DE SUPABASE DESACTUALIZADOS**

#### **FRONTEND (integrations/supabase/types.ts):**

```typescript
// Línea 121: status como string genérico
status: string | null;

// Línea 20: email como required
email: string;

// Línea 28: email como required en Insert
email: string;
```

**❌ PROBLEMA:** Tipos no reflejan la estructura real de BD.

---

## 🎯 **SOLUCIÓN DEFINITIVA**

### **OPCIÓN A: CORREGIR ARCHIVOS 01-07 (RECOMENDADO)**

Crear archivos SQL base completamente corregidos:

#### **01_database_structure_FIXED.sql:**

```sql
-- ✅ CORRECCIÓN 1: Usar ENUM en tabla reservations
CREATE TABLE IF NOT EXISTS public.reservations (
    -- ... otros campos ...
    status reservation_status DEFAULT 'pending',  -- ✅ ENUM en lugar de TEXT
    -- ... otros campos ...
);

-- ✅ CORRECCIÓN 2: Agregar campo classification a customers
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS classification customer_classification DEFAULT 'NEUTRO';

-- ✅ CORRECCIÓN 3: Hacer email nullable
ALTER TABLE public.customers
ALTER COLUMN email DROP NOT NULL;
```

#### **03_reservation_functions_FIXED.sql:**

```sql
-- ✅ CORRECCIÓN 4: Incluir 'arrived' en is_table_available
CREATE OR REPLACE FUNCTION is_table_available(...)
AS $$
BEGIN
    RETURN NOT EXISTS (
        SELECT 1
        FROM public.reservation_table_assignments rta
        JOIN public.reservations r ON rta.reservation_id = r.id
        WHERE rta.table_id = p_table_id
          AND r.date = p_date
          AND r.status IN ('confirmed', 'seated', 'arrived')  -- ✅ INCLUIR 'arrived'
          -- ... resto de la lógica ...
    );
END;
$$;
```

### **OPCIÓN B: ACTUALIZAR FRONTEND (NO RECOMENDADO)**

Cambiar todo el frontend para usar los estados incorrectos de BD.

---

## 📋 **ARCHIVOS QUE NECESITAN CORRECCIÓN**

### **BASE DE DATOS:**

1. `01_database_structure.sql` - Corregir tipos y campos faltantes
2. `03_reservation_functions.sql` - Corregir función is_table_available
3. `04_customer_functions.sql` - Agregar soporte para classification

### **FRONTEND (SI ELIGES OPCIÓN A):**

1. `src/integrations/supabase/types.ts` - Regenerar tipos
2. `src/pages/admin/ReservationsManager.tsx` - Usar estados consistentes
3. `src/hooks/useDashboardData.ts` - Actualizar filtros de estado

---

## ✅ **PLAN DE ACCIÓN RECOMENDADO**

### **PASO 1: Crear Archivos SQL Corregidos**

- Corregir 01_database_structure.sql
- Corregir 03_reservation_functions.sql
- Corregir 04_customer_functions.sql

### **PASO 2: Crear Base de Datos Limpia**

```bash
# Eliminar BD actual
supabase db reset

# Aplicar archivos corregidos
supabase db reset
```

### **PASO 3: Regenerar Tipos Frontend**

```bash
supabase gen types typescript --local > src/integrations/supabase/types.ts
```

### **PASO 4: Probar Sistema**

- Crear reserva
- Cambiar estados
- Verificar disponibilidad
- Confirmar que no hay superposiciones

---

## 🚨 **CONCLUSIÓN**

**Los archivos 01-07 ESTÁN CORRUPTOS** y crearán una base de datos inconsistente con el frontend desde el primer momento.

**RECOMENDACIÓN:** Crear archivos SQL base completamente corregidos antes que seguir parcheando.

¿Quieres que proceda a crear los archivos 01-07 corregidos para una instalación limpia?
