# 🤖 Flujo Conversacional para Agente de Reservas

## 📋 Descripción General

Este documento describe el flujo completo de conversación que debe seguir un agente conversacional para gestionar reservas en el restaurante.

---

## 🎯 Flujo Principal: Crear Reserva

### **PASO 1: Recolección de Información Inicial**

**Agente pregunta:**
```
¡Hola! Estoy aquí para ayudarte a reservar mesa en [Nombre Restaurante].

¿Para qué día te gustaría hacer la reserva?
¿Cuántas personas sois?
¿Prefieres comida o cena?
```

**Usuario responde:**
```
"Para el sábado 15 de noviembre, somos 4 personas, para cenar"
```

---

### **PASO 2: Consultar Disponibilidad**

**Llamada API:**
```bash
POST /api_check_availability
{
  "p_date": "2025-11-15",
  "p_guests": 4,
  "p_duration_minutes": 120
}
```

#### **Escenario A: Hay disponibilidad**

**Respuesta API:**
```json
{
  "success": true,
  "date": "2025-11-15",
  "guests": 4,
  "lunch": {
    "open": true,
    "message": null,
    "slots": [
      {"time": "13:00", "zone": "Terraza"},
      {"time": "13:30", "zone": "Salón Principal"}
    ]
  },
  "dinner": {
    "open": true,
    "message": null,
    "slots": [
      {"time": "20:00", "zone": "Terraza"},
      {"time": "20:30", "zone": "Comedor"},
      {"time": "21:00", "zone": "Terraza"}
    ]
  }
}
```

**Agente responde:**
```
¡Perfecto! Tenemos disponibilidad para 4 personas el sábado 15 de noviembre.

Para la CENA tenemos estos horarios disponibles:
• 20:00 en la Terraza
• 20:30 en el Comedor
• 21:00 en la Terraza

¿Qué horario prefieres?
```

**Nota:** El agente debe filtrar y mostrar solo los horarios del servicio solicitado (comida o cena).

---

#### **Escenario B: Disponibilidad parcial (solo en un servicio)**

**Respuesta API:**
```json
{
  "success": true,
  "date": "2025-10-31",
  "guests": 7,
  "lunch": {
    "open": true,
    "message": "No hay disponibilidad",
    "slots": []
  },
  "dinner": {
    "open": true,
    "message": null,
    "slots": [
      {"time": "20:30", "zone": "Comedor"},
      {"time": "21:00", "zone": "Terraza"}
    ]
  }
}
```

**Agente responde (si usuario pidió comida):**
```
Lo siento, no tenemos disponibilidad para comida para 7 personas el 31 de octubre.

Sin embargo, SÍ tenemos disponibilidad para CENA:
• 20:30 en el Comedor
• 21:00 en la Terraza

¿Te gustaría reservar para la cena en su lugar?
```

**Agente responde (si usuario pidió cena):**
```
¡Perfecto! Tenemos disponibilidad para 7 personas el 31 de octubre para la CENA:
• 20:30 en el Comedor
• 21:00 en la Terraza

¿Qué horario prefieres?
```

---

#### **Escenario C: No hay disponibilidad en ningún servicio**

**Respuesta API:**
```json
{
  "success": true,
  "date": "2025-11-15",
  "guests": 8,
  "message": "No hay disponibilidad para 8 personas en esta fecha",
  "lunch": {
    "open": true,
    "message": "No hay disponibilidad",
    "slots": []
  },
  "dinner": {
    "open": true,
    "message": "No hay disponibilidad",
    "slots": []
  }
}
```

**Agente responde:**
```
Lo siento, no tenemos disponibilidad para 8 personas el sábado 15 de noviembre.

¿Te gustaría que busque en otra fecha? 
O puedes contactar directamente al restaurante al [teléfono] para consultar opciones especiales para grupos grandes.
```

---

#### **Escenario D: Restaurante cerrado**

**Respuesta API:**
```json
{
  "success": true,
  "date": "2025-12-25",
  "guests": 4,
  "message": "El restaurante está cerrado en esta fecha",
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

**Agente responde:**
```
Lo siento, el restaurante está cerrado el 25 de diciembre.

¿Te gustaría buscar disponibilidad en otra fecha?
```

---

#### **Escenario E: Solo un servicio abierto (comida cerrada)**

**Respuesta API:**
```json
{
  "success": true,
  "date": "2025-11-15",
  "guests": 4,
  "lunch": {
    "open": false,
    "message": "El restaurante está cerrado en este horario",
    "slots": []
  },
  "dinner": {
    "open": true,
    "message": null,
    "slots": [
      {"time": "20:00", "zone": "Terraza"},
      {"time": "20:30", "zone": "Comedor"}
    ]
  }
}
```

**Agente responde (si usuario pidió comida):**
```
Lo siento, el restaurante no abre para comidas ese día.

Sin embargo, tenemos disponibilidad para CENA:
• 20:00 en la Terraza
• 20:30 en el Comedor

¿Te gustaría reservar para la cena en su lugar?
```

---

### **PASO 3: Usuario Selecciona Horario**

**Usuario responde:**
```
"Me gustaría el de las 20:00 en la terraza"
```

**Agente confirma y solicita datos:**
```
Perfecto, voy a reservar para el sábado 15 de noviembre a las 20:00 en la Terraza.

Para confirmar la reserva necesito:
• Tu nombre completo
• Número de teléfono de contacto
• ¿Tienes alguna petición especial? (opcional)
```

---

### **PASO 4: Crear Reserva**

**Usuario responde:**
```
"Juan Pérez García, 666777888, me gustaría una mesa junto a la ventana si es posible"
```

**Llamada API:**
```bash
POST /public_create_reservation
{
  "p_name": "Juan Pérez García",
  "p_phone": "666777888",
  "p_date": "2025-11-15",
  "p_time": "20:00:00",
  "p_guests": 4,
  "p_duration_minutes": 120,
  "p_special_requests": "Mesa junto a la ventana si es posible"
}
```

**Respuesta API:**
```json
{
  "success": true,
  "message": "Reserva creada exitosamente",
  "customer": {
    "name": "Juan Pérez García",
    "phone": "666777888"
  },
  "reservation": {
    "date": "2025-11-15",
    "time": "20:00:00",
    "guests": 4,
    "duration_minutes": 120,
    "special_requests": "Mesa junto a la ventana si es posible"
  },
  "tables": [
    {
      "name": "Mesa 19",
      "zone": "Terraza"
    }
  ]
}
```

**Agente confirma:**
```
¡Reserva confirmada! ✅

📅 Fecha: Sábado 15 de noviembre
🕐 Hora: 20:00
👥 Personas: 4
📍 Ubicación: Mesa 19 en la Terraza
⏱️ Duración: 2 horas
📝 Petición especial: Mesa junto a la ventana si es posible

Hemos registrado tu reserva a nombre de Juan Pérez García.
Te esperamos el sábado. ¡Que disfrutes tu cena!

Si necesitas modificar o cancelar la reserva, puedes contactarnos al [teléfono del restaurante].
```

---

## 🔄 Flujo Alternativo: Modificar/Cancelar Reserva

### **PASO 1: Buscar Reserva**

**Usuario solicita:**
```
"Quiero cancelar mi reserva"
```

**Agente pregunta:**
```
Para buscar tu reserva necesito tu número de teléfono.
```

**Usuario responde:**
```
"666777888"
```

**Llamada API:**
```bash
POST /public_find_reservation
{
  "p_phone": "666777888"
}
```

**Respuesta API:**
```json
{
  "success": true,
  "message": "Reservas encontradas",
  "reservations": [
    {
      "reservation_id": "uuid-123",
      "date": "2025-11-15",
      "time": "20:00:00",
      "guests": 4,
      "status": "confirmed",
      "special_requests": "Mesa junto a la ventana",
      "customer_name": "Juan Pérez García",
      "tables": [
        {
          "name": "Mesa 19",
          "zone": "Terraza"
        }
      ]
    }
  ]
}
```

**Agente muestra:**
```
He encontrado tu reserva:

📅 Sábado 15 de noviembre a las 20:00
👥 4 personas
📍 Mesa 19 en la Terraza

¿Quieres cancelar esta reserva?
```

---

### **PASO 2: Cancelar Reserva**

**Usuario confirma:**
```
"Sí, cancélala por favor"
```

**Llamada API:**
```bash
POST /public_cancel_reservation
{
  "p_phone": "666777888",
  "p_date": "2025-11-15",
  "p_time": "20:00:00",
  "p_reason": "Cancelada por el cliente"
}
```

**Respuesta API:**
```json
{
  "success": true,
  "message": "Reserva cancelada exitosamente",
  "reservation_id": "uuid-123",
  "customer_name": "Juan Pérez García",
  "date": "2025-11-15",
  "time": "20:00:00"
}
```

**Agente confirma:**
```
Tu reserva ha sido cancelada correctamente.

Reserva cancelada:
📅 Sábado 15 de noviembre a las 20:00
👥 4 personas

Si cambias de opinión, puedes hacer una nueva reserva cuando quieras.
¡Esperamos verte pronto!
```

---

## Recomendaciones para el Agente

### **1. Interpretar el campo `message`**

Cada servicio (lunch/dinner) puede tener un campo `message` que explica por qué no hay slots:

- **`message: null`** → Hay disponibilidad (slots no vacío)
- **`message: "No hay disponibilidad"`** → El servicio está abierto pero no hay mesas para la cantidad solicitada
- **`message: "El restaurante está cerrado en este horario"`** → El servicio no opera ese día

**Ejemplo de uso:**
```javascript
if (response.lunch.message === "No hay disponibilidad") {
  // Informar al usuario que no hay mesas disponibles para comida
  // Sugerir alternativas: otra fecha, cena, etc.
}

if (response.lunch.message === "El restaurante está cerrado en este horario") {
  // Informar que el restaurante no abre para comidas ese día
  // Ofrecer solo opciones de cena si están disponibles
}
```

### **2. Manejo de Errores**

Si la API devuelve `success: false`:
```
Lo siento, ha ocurrido un problema al procesar tu solicitud.
Por favor, contacta directamente al restaurante al [teléfono].
```

### **3. Información de Zona**

Siempre mencionar la zona donde está la mesa:
- "20:00 en la Terraza"
- ❌ "20:00" (sin zona)

### **4. Confirmación Visual**

Usar emojis y formato claro para confirmaciones:
- 📅 Fecha
- 🕐 Hora
- 👥 Personas
- 📍 Ubicación
- ⏱️ Duración
- 📝 Peticiones especiales

### **4. Duración Predeterminada**

Si el usuario no especifica duración, usar 120 minutos (2 horas) por defecto.

### **5. Validación de Datos**

Antes de crear la reserva, confirmar todos los datos con el usuario:
```
Déjame confirmar los datos:
• Fecha: Sábado 15 de noviembre
• Hora: 20:00
• Personas: 4
• Zona: Terraza
• Nombre: Juan Pérez García
• Teléfono: 666777888
• Petición especial: Mesa junto a la ventana

¿Es correcto?
```

---

## 📊 Resumen de Endpoints

| Acción | Endpoint | Cuándo Usar |
|--------|----------|-------------|
| Verificar disponibilidad | `/api_check_availability` | Después de obtener fecha, personas y servicio (comida/cena) |
| Crear reserva | `/public_create_reservation` | Después de que usuario confirme horario y proporcione datos |
| Buscar reserva | `/public_find_reservation` | Cuando usuario quiere modificar/cancelar |
| Cancelar reserva | `/public_cancel_reservation` | Cuando usuario confirma cancelación |

---

## ✅ Checklist de Implementación

- [ ] Agente recolecta: fecha, personas, comida/cena
- [ ] Agente llama a `api_check_availability`
- [ ] Agente filtra y muestra solo horarios del servicio solicitado
- [ ] Agente maneja correctamente los 3 escenarios: disponible, no disponible, cerrado
- [ ] Agente menciona siempre la zona de la mesa
- [ ] Agente solicita: nombre, teléfono, peticiones especiales
- [ ] Agente confirma todos los datos antes de crear reserva
- [ ] Agente llama a `public_create_reservation`
- [ ] Agente muestra confirmación clara con todos los detalles
- [ ] Agente maneja errores de forma amigable

---

**¡Sistema listo para integración con agentes conversacionales!** 🚀
