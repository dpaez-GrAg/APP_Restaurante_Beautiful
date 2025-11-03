# Modificación Temporal: Reservas Telefónicas para Fin de Semana

**Fecha de implementación:** 3 de Noviembre, 2025  
**Modificación:** Temporal  
**Objetivo:** Dirigir reservas de viernes, sábados y domingos al teléfono +34 881 88 89 49

---

## Resumen de Cambios

Se modificó el componente `TimeStep.tsx` para mostrar un mensaje telefónico cuando no hay horarios disponibles en viernes, sábados o domingos.

### Archivo Modificado
- `/src/components/reservation/TimeStep.tsx`

### Cambios Implementados

1. **Import del icono Phone** (línea 4)
   - Agregado: `Phone` de `lucide-react`

2. **Función helper** (líneas 19-23)
   ```typescript
   const isWeekendReservationDay = (date: Date): boolean => {
     const day = date.getDay();
     return day === 0 || day === 5 || day === 6; // Domingo=0, Viernes=5, Sábado=6
   };
   ```

3. **Mensaje condicional** (líneas 238-261)
   - Si es viernes/sábado/domingo: Muestra mensaje de teléfono con enlace clickeable
   - Si es otro día: Muestra mensaje original "No hay horarios disponibles"

---

## Comportamiento

### Días de Semana (Lunes-Jueves)
- Flujo normal: DateStep → GuestsStep → TimeStep
- Si no hay horarios: "No hay horarios disponibles para esta fecha"

### Fin de Semana (Viernes-Domingo)
- Flujo normal: DateStep → GuestsStep → TimeStep
- Si no hay horarios: "Las reservas de viernes, sábados y domingos se realizan por teléfono"
- Muestra icono de teléfono y enlace clickeable: `tel:+34881888949`

---

## Reversión

### Opción 1: Git Revert
```bash
cd /Users/diegopaezmacias/GRIDDED.AGENCY.dev/05_APP_Restaurante_Beautiful
git diff HEAD src/components/reservation/TimeStep.tsx > weekend-changes.patch
# Para revertir:
git checkout src/components/reservation/TimeStep.tsx
```

### Opción 2: Manual
Editar `/src/components/reservation/TimeStep.tsx`:

1. **Eliminar del import** (línea 4):
   ```typescript
   // De:
   import { Clock, AlertTriangle, MapPin, Phone } from "lucide-react";
   // A:
   import { Clock, AlertTriangle, MapPin } from "lucide-react";
   ```

2. **Eliminar función helper** (líneas 19-23):
   ```typescript
   // Eliminar completamente:
   const isWeekendReservationDay = (date: Date): boolean => {
     const day = date.getDay();
     return day === 0 || day === 5 || day === 6;
   };
   ```

3. **Restaurar mensaje original** (líneas 238-261):
   ```typescript
   // Reemplazar por:
   {groupedSlots.lunch.length === 0 && groupedSlots.dinner.length === 0 && (
     <div className="text-center py-8">
       <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
       <p className="text-gray-500 mb-2">No hay horarios disponibles para esta fecha</p>
     </div>
   )}
   ```

---

## Testing

### Casos a Probar

1. **Viernes sin horarios disponibles:**
   - Ir a reservar → Seleccionar un viernes → Seleccionar personas
   - ✅ Debe mostrar mensaje telefónico

2. **Sábado sin horarios disponibles:**
   - Ir a reservar → Seleccionar un sábado → Seleccionar personas
   - ✅ Debe mostrar mensaje telefónico

3. **Domingo sin horarios disponibles:**
   - Ir a reservar → Seleccionar un domingo → Seleccionar personas
   - ✅ Debe mostrar mensaje telefónico

4. **Lunes-Jueves sin horarios:**
   - Ir a reservar → Seleccionar día entre semana → Seleccionar personas
   - ✅ Debe mostrar mensaje original "No hay horarios disponibles"

5. **Cualquier día CON horarios:**
   - ✅ Debe mostrar horarios normalmente (no afectado)

6. **Enlace telefónico:**
   - En móvil: ✅ Debe abrir marcador con +34881888949
   - En desktop: ✅ Debe intentar abrir aplicación de llamadas

---

## Notas

- **Horarios en Admin:** Ya actualizados (eliminados para viernes/sábado/domingo)
- **Consulta SQL:** Se realiza igual, simplemente devuelve array vacío
- **Performance:** Sin impacto, solo cambio de UI
- **UX:** Usuario pasa por paso de "personas" pero recibe información clara
- **Reversible:** 100% - cambios aislados en un solo archivo

---

## Estado Pre-Modificación

Para referencia, el código original del bloque era:

```typescript
{groupedSlots.lunch.length === 0 && groupedSlots.dinner.length === 0 && (
  <div className="text-center py-8">
    <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
    <p className="text-gray-500 mb-2">No hay horarios disponibles para esta fecha</p>
  </div>
)}
```
