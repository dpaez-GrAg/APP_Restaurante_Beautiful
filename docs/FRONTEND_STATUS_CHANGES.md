# CAMBIOS NECESARIOS EN FRONTEND - ESTADOS SIMPLIFICADOS

## 🎯 OBJETIVO

Simplificar estados de reserva de 6 a 4 estados lógicos para eliminar confusión y optimizar la lógica de disponibilidad.

## 📋 ESTADOS ANTERIORES vs NUEVOS

### ANTES (6 estados confusos):

- `pending` - Pendiente de confirmación
- `confirmed` - Confirmada
- `seated` - Cliente sentado ← **REDUNDANTE**
- `completed` - Completada
- `cancelled` - Cancelada
- `no_show` - No se presentó ← **REDUNDANTE**

### DESPUÉS (4 estados lógicos):

- `pending` - Pendiente de confirmación (mesa **LIBRE**)
- `confirmed` - Reserva confirmada (mesa **OCUPADA**)
- `cancelled` - Cancelada (mesa **LIBRE**)
- `completed` - Finalizada (mesa **LIBRE**)

## 🔧 ARCHIVOS A MODIFICAR

### 1. `src/pages/admin/ReservationsManager.tsx`

**CAMBIOS NECESARIOS:**

```typescript
// LÍNEA 544: Eliminar botón "Confirmar llegada" para pending
// ANTES:
{
  reservation.status === "pending" && <Button onClick={() => confirmArrival(reservation.id)}>Confirmar llegada</Button>;
}

// DESPUÉS: Cambiar a "Confirmar reserva"
{
  reservation.status === "pending" && (
    <Button onClick={() => confirmReservation(reservation.id)}>Confirmar reserva</Button>
  );
}

// LÍNEA 556: Cambiar botón "Marcar llegada" por "Finalizar"
// ANTES:
{
  reservation.status === "confirmed" && <Button onClick={() => markArrival(reservation.id)}>Marcar llegada</Button>;
}

// DESPUÉS:
{
  reservation.status === "confirmed" && <Button onClick={() => completeReservation(reservation.id)}>Finalizar</Button>;
}
```

### 2. `src/components/ReservationTimeGrid.tsx`

**CAMBIOS NECESARIOS:**

```typescript
// LÍNEA 79: Actualizar filtro de estados
// ANTES:
.in('status', ['confirmed', 'pending'])

// DESPUÉS: (sin cambios, ya está correcto)
.in('status', ['confirmed', 'pending'])

// LÍNEA 260: Simplificar lógica de colores
// ANTES:
reservation.status === 'confirmed'
  ? 'bg-green-100 border-green-300'
  : 'bg-yellow-100 border-yellow-300'

// DESPUÉS: (sin cambios, ya está correcto)
reservation.status === 'confirmed'
  ? 'bg-green-100 border-green-300'
  : 'bg-yellow-100 border-yellow-300'
```

### 3. `src/hooks/useDashboardData.ts`

**CAMBIOS NECESARIOS:**

```typescript
// LÍNEA 64-65: Actualizar filtros
// ANTES:
const confirmedReservations = reservations?.filter((r) => r.status === "confirmed") || [];
const cancelledReservations = reservations?.filter((r) => r.status === "cancelled") || [];

// DESPUÉS: (sin cambios, ya está correcto)
const confirmedReservations = reservations?.filter((r) => r.status === "confirmed") || [];
const cancelledReservations = reservations?.filter((r) => r.status === "cancelled") || [];
```

### 4. NUEVAS FUNCIONES A IMPLEMENTAR

```typescript
// En ReservationsManager.tsx - Reemplazar funciones existentes

// ANTES: confirmArrival() y markArrival()
// DESPUÉS: Solo estas dos funciones

const confirmReservation = async (reservationId: string) => {
  try {
    const { error } = await supabase.from("reservations").update({ status: "confirmed" }).eq("id", reservationId);

    if (error) throw error;
    toast.success("Reserva confirmada");
    loadReservations();
  } catch (error) {
    toast.error("Error al confirmar reserva");
  }
};

const completeReservation = async (reservationId: string) => {
  try {
    const { error } = await supabase.from("reservations").update({ status: "completed" }).eq("id", reservationId);

    if (error) throw error;
    toast.success("Reserva finalizada");
    loadReservations();
  } catch (error) {
    toast.error("Error al finalizar reserva");
  }
};
```

## 🎨 CAMBIOS EN UI/UX

### Botones por Estado:

**PENDING (Amarillo):**

- ✅ "Confirmar reserva" → cambia a `confirmed`
- ✅ "Cancelar" → cambia a `cancelled`
- ✅ "Editar"

**CONFIRMED (Verde):**

- ✅ "Finalizar" → cambia a `completed`
- ✅ "Cancelar" → cambia a `cancelled`
- ✅ "Editar"

**CANCELLED (Rojo):**

- ✅ Solo "Ver detalles" (solo lectura)

**COMPLETED (Gris):**

- ✅ Solo "Ver detalles" (solo lectura)

## 🔄 FLUJO SIMPLIFICADO

```
NUEVA RESERVA
     ↓
  PENDING (mesa libre)
     ↓
  CONFIRMED (mesa ocupada) ← ÚNICO ESTADO QUE OCUPA MESA
     ↓
  COMPLETED (mesa libre)

     O

  PENDING → CANCELLED (mesa libre)
  CONFIRMED → CANCELLED (mesa libre)
```

## ✅ BENEFICIOS

1. **Lógica simple:** Solo `confirmed` ocupa mesa
2. **Sin redundancia:** Eliminados `seated` y `no_show`
3. **Menos confusión:** 4 estados claros vs 6 confusos
4. **Mejor UX:** Flujo lógico y predecible
5. **Menos bugs:** Una sola fuente de verdad para disponibilidad

## 🚨 IMPORTANTE

**EJECUTAR PRIMERO:** `SIMPLIFY_RESERVATION_STATUS.sql`
**DESPUÉS:** Aplicar cambios en frontend
**PROBAR:** Crear reservas y verificar disponibilidad

## 📝 CHECKLIST DE IMPLEMENTACIÓN

- [ ] Ejecutar script SQL de simplificación
- [ ] Actualizar ReservationsManager.tsx
- [ ] Actualizar funciones confirmArrival/markArrival
- [ ] Probar flujo completo de reservas
- [ ] Verificar que no hay superposiciones
- [ ] Actualizar documentación de estados
