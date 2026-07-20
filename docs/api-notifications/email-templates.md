# Plantillas de email

El servicio incluye **9 plantillas HTML** predefinidas para los casos de uso más comunes de Carpooling. Las plantillas usan interpolación de variables con la sintaxis `{{variable}}`.

## Cómo funcionan

1. El cliente envía una petición a `POST /api/emails/send/template` con el nombre de la plantilla y los datos.
2. El servicio carga el archivo HTML desde `src/templates/`.
3. Reemplaza las variables `{{variable}}` con los valores del campo `data`.
4. Convierte el HTML a texto plano automáticamente.
5. Envía el email con el asunto predefinido de cada plantilla.

### Interpolación

Las variables se interpolan con la sintaxis `{{ nombreVariable }}` (con o sin espacios). El valor se convierte a string. Si una variable no se proporciona, se reemplaza por una cadena vacía.

### Variable especial: `frontendUrl`

El servicio inyecta automáticamente la variable `frontendUrl` (configurada con `FRONTEND_URL` en `.env`) en todas las plantillas. Se usa para construir los enlaces de los botones en los emails.

---

## Catálogo de plantillas

### `welcome`

**Asunto**: `Bienvenido a Carpooling`

**Color de cabecera**: Azul (`#2563eb`)

**Descripción**: Email de bienvenida enviado cuando un usuario se registra.

**Campos requeridos:**

| Campo  | Descripción        |
| ------ | ------------------ |
| `name` | Nombre del usuario |

**Ejemplo de uso:**

```bash
curl -X POST http://localhost:3004/api/emails/send/template \
  -H "Content-Type: application/json" \
  -d '{
    "to": "usuario@example.com",
    "template": "welcome",
    "data": { "name": "Sergio" }
  }'
```

**Vista previa del contenido:**

- Cabecera azul con logo "Carpooling"
- Título: "¡Bienvenido, {{name}}! 🎉"
- Texto de bienvenida
- Botón: "Empezar a viajar" → `{{frontendUrl}}/login`
- Footer

---

### `trip_confirmation`

**Asunto**: `Confirmación de tu viaje - Carpooling`

**Color de cabecera**: Verde (`#16a34a`)

**Descripción**: Email enviado al conductor cuando publica un viaje correctamente.

**Campos requeridos:**

| Campo         | Descripción                               |
| ------------- | ----------------------------------------- |
| `userName`    | Nombre del conductor                      |
| `origin`      | Ciudad o punto de origen                  |
| `destination` | Ciudad o punto de destino                 |
| `date`        | Fecha del viaje (ej. `15 de Julio, 2025`) |
| `time`        | Hora del viaje (ej. `10:30`)              |
| `seats`       | Número de asientos disponibles            |
| `price`       | Precio por asiento en euros               |
| `tripId`      | ID del viaje (para el enlace)             |

**Ejemplo de uso:**

```bash
curl -X POST http://localhost:3004/api/emails/send/template \
  -H "Content-Type: application/json" \
  -d '{
    "to": "conductor@example.com",
    "template": "trip_confirmation",
    "data": {
      "userName": "Sergio",
      "origin": "Madrid",
      "destination": "Barcelona",
      "date": "15 de Julio, 2025",
      "time": "10:30",
      "seats": 3,
      "price": 25,
      "tripId": "abc123"
    }
  }'
```

**Vista previa del contenido:**

- Cabecera verde con logo "Carpooling"
- Título: "Viaje confirmado ✅"
- Tabla con detalles: origen, destino, fecha, hora, asientos, precio
- Botón: "Ver detalles del viaje" → `{{frontendUrl}}/trips/{{tripId}}`

---

### `trip_cancelled`

**Asunto**: `Viaje cancelado - Carpooling`

**Color de cabecera**: Rojo (`#dc2626`)

**Descripción**: Email enviado a los pasajeros cuando un viaje es cancelado por el conductor.

**Campos requeridos:**

| Campo         | Descripción              |
| ------------- | ------------------------ |
| `userName`    | Nombre del pasajero      |
| `origin`      | Origen del viaje         |
| `destination` | Destino del viaje        |
| `date`        | Fecha del viaje          |
| `time`        | Hora del viaje           |
| `reason`      | Motivo de la cancelación |

**Ejemplo de uso:**

```bash
curl -X POST http://localhost:3004/api/emails/send/template \
  -H "Content-Type: application/json" \
  -d '{
    "to": "pasajero@example.com",
    "template": "trip_cancelled",
    "data": {
      "userName": "Ana",
      "origin": "Madrid",
      "destination": "Barcelona",
      "date": "15 de Julio, 2025",
      "time": "10:30",
      "reason": "El conductor tiene una avería mecánica"
    }
  }'
```

**Vista previa del contenido:**

- Cabecera roja con logo "Carpooling"
- Título: "Viaje cancelado ❌"
- Tabla con ruta, fecha/hora y motivo
- Texto sobre reembolso
- Botón: "Buscar otros viajes" → `{{frontendUrl}}/trips`

---

### `booking_request`

**Asunto**: `Nueva solicitud de reserva - Carpooling`

**Color de cabecera**: Morado (`#7c3aed`)

**Descripción**: Email enviado al conductor cuando un pasajero solicita reservar asientos en su viaje.

**Campos requeridos:**

| Campo            | Descripción                      |
| ---------------- | -------------------------------- |
| `driverName`     | Nombre del conductor             |
| `passengerName`  | Nombre del pasajero que solicita |
| `origin`         | Origen del viaje                 |
| `destination`    | Destino del viaje                |
| `date`           | Fecha del viaje                  |
| `time`           | Hora del viaje                   |
| `seatsRequested` | Número de asientos solicitados   |
| `tripId`         | ID del viaje (para el enlace)    |

**Ejemplo de uso:**

```bash
curl -X POST http://localhost:3004/api/emails/send/template \
  -H "Content-Type: application/json" \
  -d '{
    "to": "conductor@example.com",
    "template": "booking_request",
    "data": {
      "driverName": "Sergio",
      "passengerName": "Ana",
      "origin": "Madrid",
      "destination": "Barcelona",
      "date": "15 de Julio, 2025",
      "time": "10:30",
      "seatsRequested": 2,
      "tripId": "abc123"
    }
  }'
```

**Vista previa del contenido:**

- Cabecera morada con logo "Carpooling"
- Título: "Nueva solicitud de reserva 📩"
- Tabla con ruta, fecha/hora y asientos solicitados
- Botón: "Revisar solicitud" → `{{frontendUrl}}/trips/{{tripId}}/requests`
- Texto: "Responde lo antes posible..."

---

### `password_reset`

**Asunto**: `Restablece tu contraseña - Carpooling`

**Color de cabecera**: Naranja (`#f59e0b`)

**Descripción**: Email enviado cuando un usuario solicita restablecer su contraseña. Contiene un enlace con token de reset.

**Campos requeridos:**

| Campo      | Descripción                                                                                   |
| ---------- | --------------------------------------------------------------------------------------------- |
| `name`     | Nombre del usuario                                                                            |
| `resetUrl` | URL completa con el token de reset (ej. `https://carpooling.com/reset-password?token=abc123`) |

**Ejemplo de uso:**

```bash
curl -X POST http://localhost:3004/api/emails/send/template \
  -H "Content-Type: application/json" \
  -d '{
    "to": "usuario@example.com",
    "template": "password_reset",
    "data": {
      "name": "Sergio",
      "resetUrl": "https://carpooling.com/reset-password?token=abc123xyz"
    }
  }'
```

**Vista previa del contenido:**

- Cabecera naranja con logo "Carpooling"
- Título: "Restablece tu contraseña 🔐"
- Botón: "Restablecer contraseña" → `{{resetUrl}}`
- Enlace en texto plano (copiar/pegar)
- Aviso: "Este enlace expirará en 1 hora"

---

### `suggestion_received`

**Asunto**: `Nueva sugerencia de empresa - Carpooling`

**Color de cabecera**: Gris oscuro (`#0f172a`)

**Descripción**: Email enviado al administrador cuando un usuario sugiere una nueva empresa promotora de eventos. Incluye un enlace directo al panel de administración para aceptar o rechazar la sugerencia.

**Campos requeridos:**

| Campo          | Descripción                                              |
| -------------- | -------------------------------------------------------- |
| `companyName`  | Nombre de la empresa sugerida                            |
| `companyEmail` | Email de la empresa sugerida                             |
| `userName`     | Nombre del usuario que hizo la sugerencia                |
| `userEmail`    | Email del usuario que hizo la sugerencia                 |
| `suggestionId` | ID de la sugerencia (se añade a `ADMIN_SUGGESTIONS_URL`) |

> La URL final del botón `{{adminUrl}}` se construye automáticamente a partir de `ADMIN_SUGGESTIONS_URL` (variable de entorno) + `/{suggestionId}`.

**Campos opcionales:**

| Campo       | Descripción                                                       |
| ----------- | ----------------------------------------------------------------- |
| `website`   | Sitio web de la empresa                                           |
| `createdAt` | Fecha de la sugerencia (se genera automáticamente si no se envía) |

**Ejemplo de uso:**

```bash
curl -X POST http://localhost:3004/api/emails/send/suggestion \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "Eventos Madrid SL",
    "companyEmail": "contacto@eventosmadrid.com",
    "website": "https://eventosmadrid.com",
    "userName": "Sergio",
    "userEmail": "sergio@example.com",
    "suggestionId": "abc123"
  }'
```

**Vista previa del contenido:**

- Cabecera oscura con logo "Carpooling"
- Título: "Nueva sugerencia de empresa 🏢"
- Tabla con datos: nombre, email, sitio web, usuario, fecha
- Botón: "Revisar sugerencia" → `{{adminUrl}}`
- Enlace en texto plano (copiar/pegar)

### `trip_completed`

**Asunto**: `Tu viaje ha finalizado - Carpooling`

**Color de cabecera**: Verde azulado (`#0d9488`)

**Descripción**: Email enviado al conductor cuando un viaje ha finalizado correctamente. Incluye un resumen de ingresos y un botón para valorar el viaje.

**Campos requeridos:**

| Campo         | Descripción                                  |
| ------------- | -------------------------------------------- |
| `userName`    | Nombre del conductor                         |
| `origin`      | Ciudad o punto de origen                     |
| `destination` | Ciudad o punto de destino                    |
| `date`        | Fecha del viaje (ej. `15 de Julio, 2025`)    |
| `time`        | Hora del viaje (ej. `10:30`)                 |
| `passengers`  | Número de pasajeros que completaron el viaje |
| `earnings`    | Ingresos totales del viaje en euros          |
| `tripId`      | ID del viaje (para el enlace)                |

**Ejemplo de uso:**

```bash
curl -X POST http://localhost:3004/api/emails/send/template \
  -H "Content-Type: application/json" \
  -d '{
    "to": "conductor@example.com",
    "template": "trip_completed",
    "data": {
      "userName": "Sergio",
      "origin": "Madrid",
      "destination": "Barcelona",
      "date": "15 de Julio, 2025",
      "time": "10:30",
      "passengers": 3,
      "earnings": 75,
      "tripId": "abc123"
    }
  }'
```

**Vista previa del contenido:**

- Cabecera verde azulado con logo "Carpooling"
- Título: "Viaje completado 🎉"
- Tabla con detalles: origen, destino, fecha, hora, pasajeros, ingresos
- Texto invitando a valorar la experiencia
- Botón: "Valorar viaje" → `{{frontendUrl}}/trips/{{tripId}}`

---

### `trip_started`

**Asunto**: `Tu viaje ha comenzado - Carpooling`

**Color de cabecera**: Azul (`#2563eb`)

**Descripción**: Email enviado al conductor y/o pasajeros cuando un viaje ha comenzado.

**Campos requeridos:**

| Campo         | Descripción                               |
| ------------- | ----------------------------------------- |
| `userName`    | Nombre del usuario                        |
| `origin`      | Ciudad o punto de origen                  |
| `destination` | Ciudad o punto de destino                 |
| `date`        | Fecha del viaje (ej. `15 de Julio, 2025`) |
| `time`        | Hora de salida (ej. `10:30`)              |
| `passengers`  | Número de pasajeros                       |
| `tripId`      | ID del viaje (para el enlace)             |

**Ejemplo de uso:**

```bash
curl -X POST http://localhost:3004/api/emails/send/template \
  -H "Content-Type: application/json" \
  -d '{
    "to": "usuario@example.com",
    "template": "trip_started",
    "data": {
      "userName": "Sergio",
      "origin": "Madrid",
      "destination": "Barcelona",
      "date": "15 de Julio, 2025",
      "time": "10:30",
      "passengers": 3,
      "tripId": "abc123"
    }
  }'
```

**Vista previa del contenido:**

- Cabecera azul con logo "Carpooling"
- Título: "El viaje ha comenzado 🚗"
- Tabla con detalles: origen, destino, fecha, hora, pasajeros
- Texto con consejos de seguridad
- Botón: "Ver detalles del viaje" → `{{frontendUrl}}/trips/{{tripId}}`

---

### `trip_booked`

**Asunto**: `Nueva reserva en tu viaje - Carpooling`

**Color de cabecera**: Morado (`#7c3aed`)

**Descripción**: Email enviado al conductor cuando un pasajero ha reservado asientos en su viaje. Incluye los datos del pasajero y los asientos restantes.

**Campos requeridos:**

| Campo            | Descripción                          |
| ---------------- | ------------------------------------ |
| `userName`       | Nombre del conductor                 |
| `passengerName`  | Nombre del pasajero que reservó      |
| `origin`         | Origen del viaje                     |
| `destination`    | Destino del viaje                    |
| `date`           | Fecha del viaje                      |
| `time`           | Hora del viaje                       |
| `seatsBooked`    | Número de asientos reservados        |
| `seatsRemaining` | Asientos disponibles tras la reserva |
| `tripId`         | ID del viaje (para el enlace)        |

**Ejemplo de uso:**

```bash
curl -X POST http://localhost:3004/api/emails/send/template \
  -H "Content-Type: application/json" \
  -d '{
    "to": "conductor@example.com",
    "template": "trip_booked",
    "data": {
      "userName": "Sergio",
      "passengerName": "Ana",
      "origin": "Madrid",
      "destination": "Barcelona",
      "date": "15 de Julio, 2025",
      "time": "10:30",
      "seatsBooked": 2,
      "seatsRemaining": 1,
      "tripId": "abc123"
    }
  }'
```

**Vista previa del contenido:**

- Cabecera morada con logo "Carpooling"
- Título: "Nueva reserva en tu viaje 🧑‍🤝‍🧑"
- Tabla con datos: pasajero, ruta, fecha, hora, asientos reservados, asientos disponibles
- Botón: "Gestionar reserva" → `{{frontendUrl}}/trips/{{tripId}}`

---

## Resumen

| Plantilla             | Asunto                                   | Campos requeridos                                                                                               |
| --------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `welcome`             | Bienvenido a Carpooling                  | `name`                                                                                                          |
| `trip_confirmation`   | Confirmación de tu viaje - Carpooling    | `userName`, `origin`, `destination`, `date`, `time`, `seats`, `price`, `tripId`                                 |
| `trip_cancelled`      | Viaje cancelado - Carpooling             | `userName`, `origin`, `destination`, `date`, `time`, `reason`                                                   |
| `booking_request`     | Nueva solicitud de reserva - Carpooling  | `driverName`, `passengerName`, `origin`, `destination`, `date`, `time`, `seatsRequested`, `tripId`              |
| `password_reset`      | Restablece tu contraseña - Carpooling    | `name`, `resetUrl`                                                                                              |
| `suggestion_received` | Nueva sugerencia de empresa - Carpooling | `companyName`, `companyEmail`, `userName`, `userEmail`, `suggestionId`                                          |
| `trip_completed`      | Tu viaje ha finalizado - Carpooling      | `userName`, `origin`, `destination`, `date`, `time`, `passengers`, `earnings`, `tripId`                         |
| `trip_started`        | Tu viaje ha comenzado - Carpooling       | `userName`, `origin`, `destination`, `date`, `time`, `passengers`, `tripId`                                     |
| `trip_booked`         | Nueva reserva en tu viaje - Carpooling   | `userName`, `passengerName`, `origin`, `destination`, `date`, `time`, `seatsBooked`, `seatsRemaining`, `tripId` |

## Añadir nuevas plantillas

Para crear una nueva plantilla:

1. Crea un archivo HTML en `src/templates/` (ej. `new-template.html`).
2. Usa la sintaxis `{{variable}}` para las variables dinámicas.
3. Registra la plantilla en `src/services/templateService.js` dentro del objeto `TEMPLATES`:

```javascript
const TEMPLATES = {
  // ... plantillas existentes
  new_template: {
    subject: "Asunto del email",
    file: "new-template.html",
  },
};
```

4. Añade el nombre a `VALID_TEMPLATES` y los campos requeridos a `TEMPLATE_REQUIRED_FIELDS` en `src/controllers/emailController.js`:

```javascript
const VALID_TEMPLATES = [
  // ... plantillas existentes
  "new_template",
];

const TEMPLATE_REQUIRED_FIELDS = {
  // ... plantillas existentes
  new_template: ["campo1", "campo2"],
};
```

5. La plantilla estará disponible en `POST /api/emails/send/template` y en `GET /api/emails/templates`.
