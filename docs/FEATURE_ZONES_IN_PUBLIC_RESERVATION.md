# Feature: Clasificación por Zonas en Reserva Pública

## Objetivo
Mostrar la disponibilidad de horarios en el proceso público de reserva agrupada por zonas del restaurante, además de la clasificación por comida/cena.

## Estructura Visual

```
COMIDA
  🟢 Terraza
     13:00  13:15  13:30  14:00  14:15
  🔵 Salón Principal
     13:30  14:00  14:30  15:00
  🟠 Barra
     13:00  14:00  15:00

CENA
  🟢 Terraza
     20:00  20:30  21:00  21:30
  🔵 Salón Principal
     20:00  20:30  21:00  21:30  22:00
```

## Cambios Implementados

### 1. Nueva Función SQL
**Archivo:** `docs/sql/ADD_SLOTS_WITH_ZONES_FUNCTION.sql`

```sql
CREATE FUNCTION get_available_time_slots_with_zones(
    p_date date,
    p_guests integer,
    p_duration_minutes integer DEFAULT 90
)
RETURNS TABLE(
    id uuid, 
    slot_time time, 
    capacity integer, 
    zone_id uuid,
    zone_name text,
    zone_color text,
    zone_priority integer,
    is_normalized boolean
)
```

**Características:**
- Devuelve TODOS los slots disponibles con información de zona
- Para cada combinación slot + zona, devuelve la mejor opción (menor capacidad)
- Ordena por prioridad de zona
- Considera mesas individuales y combinaciones
- Verifica que todas las mesas de una combinación estén activas y disponibles

### 2. Hook Actualizado
**Archivo:** `src/hooks/reservations/useAvailability.ts`

**Cambios:**
- Nueva interfaz `TimeSlotWithZone` que extiende `TimeSlot`
- Campos adicionales: `zone_id`, `zone_name`, `zone_color`, `zone_priority`
- Llama a `get_available_time_slots_with_zones` en lugar de `get_available_time_slots_normalized`
- Mapea los campos de zona en la respuesta

### 3. Componente TimeStep Actualizado
**Archivo:** `src/components/reservation/TimeStep.tsx`

**Cambios:**
- Agrupa slots por período (comida/cena) y por zona
- Ordena zonas por prioridad
- Muestra indicador de color para cada zona
- Solo muestra zonas que tienen disponibilidad real

**Lógica de Agrupación:**
```typescript
const groupedSlots = useMemo(() => {
  const lunch: Record<string, TimeSlotWithZone[]> = {};
  const dinner: Record<string, TimeSlotWithZone[]> = {};

  availableSlots.forEach((slot) => {
    const hour = parseInt(slot.time.split(":")[0]);
    const zoneName = slot.zone_name || "Sin zona";
    
    if (isLunchTime) lunch[zoneName].push(slot);
    if (isDinnerTime) dinner[zoneName].push(slot);
  });

  return { lunch: sortByPriority(lunch), dinner: sortByPriority(dinner) };
}, [availableSlots, date]);
```

## Instalación

### 1. Ejecutar Script SQL
```bash
psql -U postgres -d tu_mesa_ideal -f docs/sql/ADD_SLOTS_WITH_ZONES_FUNCTION.sql
```

O desde Supabase Dashboard:
- SQL Editor → Copiar contenido de `ADD_SLOTS_WITH_ZONES_FUNCTION.sql` → Run

### 2. Verificar Función
```sql
SELECT * FROM get_available_time_slots_with_zones(
    '2025-10-25'::date,
    4,
    90
);
```

Debería devolver:
```
id | slot_time | capacity | zone_id | zone_name | zone_color | zone_priority
---|-----------|----------|---------|-----------|------------|---------------
... | 13:00:00 | 4       | uuid... | Terraza   | #10B981    | 1
... | 13:00:00 | 6       | uuid... | Salón     | #3B82F6    | 2
```

## Comportamiento

### Si hay zonas configuradas:
- Muestra horarios agrupados por zona
- Respeta el orden de prioridad de zonas
- Solo muestra zonas con disponibilidad real

### Si NO hay zonas configuradas:
- Todos los slots aparecen bajo "Sin zona"
- Funciona igual que antes pero con la nueva estructura

### Si una zona no tiene disponibilidad:
- No se muestra en la lista
- El usuario solo ve zonas donde puede reservar

## Ventajas

1. **Sin cambios en BD existente:** Usa la tabla `zones` que ya existe
2. **Eficiente:** Una sola consulta SQL devuelve todo
3. **Flexible:** Funciona con o sin zonas configuradas
4. **Visual:** Indicadores de color para cada zona
5. **Ordenado:** Respeta prioridades de zona

## Notas Técnicas

- Los errores de TypeScript en `useAvailability.ts` son esperados (Supabase no conoce la nueva función)
- Los `@ts-ignore` manejan estos errores temporales
- La función SQL tiene permisos para `anon`, `authenticated` y `service_role`
- Límite de 500 slots para evitar timeouts

## Testing

1. Crear zonas en `/admin/zones`
2. Asignar zonas a mesas en `/admin/tables`
3. Ir a `/reservar` y seleccionar fecha y comensales
4. Verificar que los horarios se agrupan por zona
5. Verificar que solo aparecen zonas con disponibilidad
