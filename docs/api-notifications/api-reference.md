# Referencia de la API REST

**Base URL**: `http://localhost:3004`

Todos los endpoints aceptan y devuelven JSON (`Content-Type: application/json`).

## Convenciones

### Códigos de estado

| Código | Significado                                         |
| ------ | --------------------------------------------------- |
| `200`  | OK — Operación exitosa                              |
| `201`  | Created — Recurso creado (registro de device token) |
| `400`  | Bad Request — Faltan campos o son inválidos         |
| `401`  | Unauthorized — JWT ausente, inválido o expirado     |
| `404`  | Not Found — Ruta no existe o recurso no encontrado  |
| `500`  | Internal Server Error — Error del servidor          |
| `502`  | Bad Gateway — Error de conexión con SMTP            |

### Formato de errores

```json
{
  "error": "Descripción del error",
  "detail": "Detalle técnico opcional"
}
```

---

## Health

### `GET /health`

Estado general del servicio. No requiere autenticación.

**Respuesta 200:**

```json
{
  "status": "ok",
  "service": "carpooling-notifications",
  "timestamp": "2025-07-14T08:10:00.000Z"
}
```

---

## Emails

### `GET /api/emails/templates`

Lista las plantillas de email disponibles.

**Respuesta 200:**

```json
{
  "templates": [
    { "name": "welcome", "subject": "Bienvenido a Carpooling" },
    { "name": "trip_confirmation", "subject": "Confirmación de tu viaje - Carpooling" },
    { "name": "trip_cancelled", "subject": "Viaje cancelado - Carpooling" },
    { "name": "booking_request", "subject": "Nueva solicitud de reserva - Carpooling" },
    { "name": "password_reset", "subject": "Restablece tu contraseña - Carpooling" },
    { "name": "suggestion_received", "subject": "Nueva sugerencia de empresa - Carpooling" }
  ]
}
```

---

### `GET /api/emails/health/smtp`

Verifica la conexión con el servidor SMTP.

**Respuesta 200:**

```json
{
  "success": true,
  "message": "Conexión SMTP verificada correctamente"
}
```

**Respuesta 500 (si falla):**

```json
{
  "success": false,
  "error": "No se pudo conectar al servidor SMTP",
  "detail": "connect ECONNREFUSED ..."
}
```

---

### `POST /api/emails/send`

Envía un email con contenido HTML o texto personalizado.

**Body:**

| Campo     | Tipo                 | Requerido | Descripción                                 |
| --------- | -------------------- | --------- | ------------------------------------------- |
| `to`      | `string \| string[]` | Sí        | Email destinatario o array de destinatarios |
| `subject` | `string`             | Sí        | Asunto del email                            |
| `html`    | `string`             | Sí*       | Contenido HTML del email                    |
| `text`    | `string`             | Sí*       | Contenido en texto plano                    |
| `cc`      | `string \| string[]` | No        | Con copia                                   |
| `bcc`     | `string \| string[]` | No        | Con copia oculta                            |
| `replyTo` | `string`             | No        | Email de respuesta                          |

> *Se requiere al menos `html` o `text`.

**Ejemplo:**

```bash
curl -X POST http://localhost:3004/api/emails/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "usuario@example.com",
    "subject": "Hola",
    "html": "<h1>Mensaje de prueba</h1>"
  }'
```

**Respuesta 200:**

```json
{
  "success": true,
  "messageId": "<abc@example.com>",
  "accepted": ["usuario@example.com"],
  "rejected": [],
  "response": "250 OK"
}
```

---

### `POST /api/emails/send/template`

Envía un email usando una plantilla predefinida. El servicio renderiza el HTML automáticamente.

> Para notificar una sugerencia de empresa al administrador, preferir el endpoint específico `POST /api/emails/send/suggestion`.

**Body:**

| Campo      | Tipo                 | Requerido | Descripción                                                     |
| ---------- | -------------------- | --------- | --------------------------------------------------------------- |
| `to`       | `string \| string[]` | Sí        | Email destinatario o array                                      |
| `template` | `string`             | Sí        | Nombre de la plantilla (ver [Plantillas](./email-templates.md)) |
| `data`     | `object`             | Sí        | Variables para interpolar en la plantilla                       |
| `cc`       | `string \| string[]` | No        | Con copia                                                       |
| `bcc`      | `string \| string[]` | No        | Con copia oculta                                                |
| `replyTo`  | `string`             | No        | Email de respuesta                                              |

**Plantillas disponibles:** `welcome`, `trip_confirmation`, `trip_cancelled`, `booking_request`, `password_reset`, `suggestion_received`

**Ejemplo:**

```bash
curl -X POST http://localhost:3004/api/emails/send/template \
  -H "Content-Type: application/json" \
  -d '{
    "to": "usuario@example.com",
    "template": "welcome",
    "data": { "name": "Sergio" }
  }'
```

**Respuesta 200:**

```json
{
  "success": true,
  "messageId": "<abc@example.com>",
  "accepted": ["usuario@example.com"],
  "rejected": [],
  "response": "250 OK"
}
```

**Errores comunes:**

- `400` — `"El campo 'template' es obligatorio"`
- `400` — `"Template no válido. Disponibles: welcome, trip_confirmation, ..."`
- `400` — `"Faltan campos obligatorios para el template: userName, origin, ..."`

---

### `POST /api/emails/send/suggestion`

Notifica a la dirección configurada en `ADMIN_EMAIL` sobre una nueva sugerencia de empresa. El email se envía usando la plantilla `suggestion_received` e incluye un enlace al panel de administración. El enlace se construye automáticamente a partir de la variable de entorno `ADMIN_SUGGESTIONS_URL` + `/{suggestionId}`.

**Requiere en `.env`:**

- `ADMIN_EMAIL`: dirección de email del administrador.
- `ADMIN_SUGGESTIONS_URL`: URL base del panel de administración de sugerencias (ej. `http://localhost:3000/admin/suggestions`).

**Body:**

| Campo          | Tipo     | Requerido | Descripción                                              |
| -------------- | -------- | --------- | -------------------------------------------------------- |
| `companyName`  | `string` | Sí        | Nombre de la empresa sugerida                            |
| `companyEmail` | `string` | Sí        | Email de la empresa sugerida                             |
| `userName`     | `string` | Sí        | Nombre del usuario que sugiere                           |
| `userEmail`    | `string` | Sí        | Email del usuario que sugiere                            |
| `suggestionId` | `string` | Sí        | ID de la sugerencia (se añade a `ADMIN_SUGGESTIONS_URL`) |
| `website`      | `string` | No        | Sitio web de la empresa                                  |

> **Nota:** Requiere que `ADMIN_EMAIL` esté configurada en `.env`. El remitente (`from`) se toma del remitente SMTP configurado.

**Ejemplo:**

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

**Respuesta 200:**

```json
{
  "success": true,
  "to": "admin@example.com",
  "adminUrl": "http://localhost:3000/admin/suggestions/abc123",
  "messageId": "<abc@example.com>",
  "accepted": ["admin@example.com"],
  "rejected": [],
  "response": "250 OK"
}
```

**Errores comunes:**

- `400` — `"El campo 'companyName' es obligatorio"`
- `400` — `"El email de la empresa no es válido"`
- `500` — `"ADMIN_EMAIL no está configurada en el entorno"`
- `500` — `"ADMIN_SUGGESTIONS_URL no está configurada en el entorno"`

---

### `POST /api/emails/send/batch`

Envía múltiples emails en una sola petición. Cada email se procesa de forma independiente: si uno falla, los demás continúan.

**Body:**

| Campo    | Tipo    | Requerido | Descripción            |
| -------- | ------- | --------- | ---------------------- |
| `emails` | `array` | Sí        | Array de objetos email |

Cada objeto del array `emails`:

| Campo     | Tipo     | Requerido | Descripción              |
| --------- | -------- | --------- | ------------------------ |
| `to`      | `string` | Sí        | Email destinatario       |
| `subject` | `string` | Sí        | Asunto                   |
| `html`    | `string` | Sí*       | Contenido HTML           |
| `text`    | `string` | Sí*       | Contenido en texto plano |

**Ejemplo:**

```bash
curl -X POST http://localhost:3004/api/emails/send/batch \
  -H "Content-Type: application/json" \
  -d '{
    "emails": [
      { "to": "a@example.com", "subject": "Hola", "html": "<p>Email 1</p>" },
      { "to": "b@example.com", "subject": "Hola", "html": "<p>Email 2</p>" }
    ]
  }'
```

**Respuesta 200:**

```json
{
  "success": true,
  "total": 2,
  "succeeded": 2,
  "failed": 0,
  "results": [
    { "to": "a@example.com", "success": true, "messageId": "...", "accepted": ["a@example.com"], "rejected": [], "response": "250 OK" },
    { "to": "b@example.com", "success": true, "messageId": "...", "accepted": ["b@example.com"], "rejected": [], "response": "250 OK" }
  ]
}
```

---

## Push Notifications (FCM)

> Los endpoints de push **no requieren autenticación JWT**. Se asume que son llamados por otros microservicios del backend.

### `POST /api/push/send`

Envía una notificación push a un dispositivo concreto por su token FCM.

**Body:**

| Campo       | Tipo     | Requerido | Descripción                                        |
| ----------- | -------- | --------- | -------------------------------------------------- |
| `token`     | `string` | Sí        | Token FCM del dispositivo                          |
| `title`     | `string` | Sí        | Título de la notificación                          |
| `body`      | `string` | Sí        | Cuerpo de la notificación                          |
| `data`      | `object` | No        | Datos personalizados (payload adicional)           |
| `priority`  | `string` | No        | Prioridad Android: `high` (default) o `normal`     |
| `channelId` | `string` | No        | Canal de notificación Android: `default` (default) |
| `badge`     | `number` | No        | Badge de iOS: `1` (default)                        |

**Ejemplo:**

```bash
curl -X POST http://localhost:3004/api/push/send \
  -H "Content-Type: application/json" \
  -d '{
    "token": "FCM_TOKEN_DEL_MOVIL",
    "title": "Nuevo viaje disponible",
    "body": "Hay un viaje que coincide con tu ruta",
    "data": { "tripId": "123", "type": "trip_match" }
  }'
```

**Respuesta 200:**

```json
{
  "success": true,
  "messageId": "projects/your-project-id/messages/123"
}
```

---

### `POST /api/push/send/multicast`

Envía la misma notificación push a múltiples tokens FCM.

**Body:**

| Campo       | Tipo       | Requerido | Descripción                    |
| ----------- | ---------- | --------- | ------------------------------ |
| `tokens`    | `string[]` | Sí        | Array de tokens FCM (mínimo 1) |
| `title`     | `string`   | Sí        | Título                         |
| `body`      | `string`   | Sí        | Cuerpo                         |
| `data`      | `object`   | No        | Datos personalizados           |
| `priority`  | `string`   | No        | Prioridad Android              |
| `channelId` | `string`   | No        | Canal Android                  |
| `badge`     | `number`   | No        | Badge iOS                      |

**Ejemplo:**

```bash
curl -X POST http://localhost:3004/api/push/send/multicast \
  -H "Content-Type: application/json" \
  -d '{
    "tokens": ["token1", "token2", "token3"],
    "title": "Promoción",
    "body": "Descuento en tu próximo viaje"
  }'
```

**Respuesta 200:**

```json
{
  "success": true,
  "total": 3,
  "succeeded": 2,
  "failed": 1,
  "results": [
    { "token": "token1", "success": true, "messageId": "..." },
    { "token": "token2", "success": true, "messageId": "..." },
    { "token": "token3", "success": false, "error": "Requested entity was not found." }
  ]
}
```

---

### `POST /api/push/send/user`

Envía una notificación push a **todos los dispositivos activos** de un usuario. El servicio busca en la base de datos los tokens FCM asociados al `userId`.

**Body:**

| Campo       | Tipo     | Requerido | Descripción          |
| ----------- | -------- | --------- | -------------------- |
| `userId`    | `string` | Sí        | ID del usuario       |
| `title`     | `string` | Sí        | Título               |
| `body`      | `string` | Sí        | Cuerpo               |
| `data`      | `object` | No        | Datos personalizados |
| `priority`  | `string` | No        | Prioridad Android    |
| `channelId` | `string` | No        | Canal Android        |
| `badge`     | `number` | No        | Badge iOS            |

**Ejemplo:**

```bash
curl -X POST http://localhost:3004/api/push/send/user \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER_ID",
    "title": "Nuevo mensaje",
    "body": "Tienes una nueva notificación",
    "data": { "type": "message" }
  }'
```

**Respuesta 200:**

```json
{
  "success": true,
  "total": 2,
  "succeeded": 2,
  "failed": 0,
  "results": [
    { "token": "token1", "success": true, "messageId": "..." },
    { "token": "token2", "success": true, "messageId": "..." }
  ]
}
```

**Respuesta 404 (sin dispositivos):**

```json
{
  "error": "El usuario no tiene dispositivos activos registrados"
}
```

---

### `POST /api/push/send/topic`

Envía una notificación push a todos los dispositivos suscritos a un topic de FCM.

**Body:**

| Campo      | Tipo     | Requerido | Descripción          |
| ---------- | -------- | --------- | -------------------- |
| `topic`    | `string` | Sí        | Nombre del topic     |
| `title`    | `string` | Sí        | Título               |
| `body`     | `string` | Sí        | Cuerpo               |
| `data`     | `object` | No        | Datos personalizados |
| `priority` | `string` | No        | Prioridad Android    |

**Ejemplo:**

```bash
curl -X POST http://localhost:3004/api/push/send/topic \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "trips_madrid_barcelona",
    "title": "Nuevo viaje",
    "body": "Se ha publicado un viaje Madrid → Barcelona"
  }'
```

**Respuesta 200:**

```json
{
  "success": true,
  "messageId": "projects/your-project-id/messages/456"
}
```

---

### `POST /api/push/topic/subscribe`

Suscribe tokens FCM a un topic.

**Body:**

| Campo    | Tipo       | Requerido | Descripción                    |
| -------- | ---------- | --------- | ------------------------------ |
| `tokens` | `string[]` | Sí        | Array de tokens FCM (mínimo 1) |
| `topic`  | `string`   | Sí        | Nombre del topic               |

**Ejemplo:**

```bash
curl -X POST http://localhost:3004/api/push/topic/subscribe \
  -H "Content-Type: application/json" \
  -d '{
    "tokens": ["token1", "token2"],
    "topic": "trips_madrid_barcelona"
  }'
```

**Respuesta 200:**

```json
{
  "success": true,
  "successCount": 2,
  "failureCount": 0,
  "errors": null
}
```

---

### `POST /api/push/topic/unsubscribe`

Desuscribe tokens FCM de un topic.

**Body:**

| Campo    | Tipo       | Requerido | Descripción                    |
| -------- | ---------- | --------- | ------------------------------ |
| `tokens` | `string[]` | Sí        | Array de tokens FCM (mínimo 1) |
| `topic`  | `string`   | Sí        | Nombre del topic               |

**Respuesta 200:**

```json
{
  "success": true,
  "successCount": 2,
  "failureCount": 0,
  "errors": null
}
```

---

### `POST /api/push/send/template/user`

Envía una notificación push con plantilla predefinida a todos los dispositivos activos de un usuario. El servicio renderiza el título, cuerpo y datos de la plantilla con las variables proporcionadas.

**Plantillas disponibles:**

| Plantilla        | Título                        | Campos requeridos                                                             |
| ---------------- | ----------------------------- | ----------------------------------------------------------------------------- |
| `trip_completed` | Viaje completado 🎉            | `userName`, `origin`, `destination`, `tripId`                                 |
| `trip_started`   | El viaje ha comenzado 🚗       | `userName`, `origin`, `destination`, `tripId`                                 |
| `trip_booked`    | Nueva reserva en tu viaje 🧑‍🤝‍🧑 | `passengerName`, `origin`, `destination`, `tripId`, `seatsBooked`, `userName` |

**Body:**

| Campo       | Tipo     | Requerido | Descripción                               |
| ----------- | -------- | --------- | ----------------------------------------- |
| `userId`    | `string` | Sí        | ID del usuario destinatario               |
| `template`  | `string` | Sí        | Nombre de la plantilla push               |
| `data`      | `object` | Sí        | Variables para interpolar en la plantilla |
| `priority`  | `string` | No        | Prioridad FCM (`high` por defecto)        |
| `channelId` | `string` | No        | Canal de notificación Android (`default`) |
| `badge`     | `number` | No        | Badge iOS (1 por defecto)                 |

**Ejemplo:**

```bash
curl -X POST http://localhost:3004/api/push/send/template/user \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-id-123",
    "template": "trip_booked",
    "data": {
      "userName": "Sergio",
      "passengerName": "Ana",
      "origin": "Madrid",
      "destination": "Barcelona",
      "seatsBooked": 2,
      "tripId": "abc123"
    }
  }'
```

**Respuesta 200:**

```json
{
  "success": true,
  "total": 2,
  "succeeded": 2,
  "failed": 0,
  "results": [
    { "token": "FCM_TOKEN_1", "success": true, "messageId": "projects/.../messages/123" },
    { "token": "FCM_TOKEN_2", "success": true, "messageId": "projects/.../messages/124" }
  ]
}
```

**Errores comunes:**

- `400` — `"El campo 'userId' es obligatorio"`
- `400` — `"El campo 'template' es obligatorio"`
- `400` — `"Push template \"xxx\" not found. Available: ..."`
- `404` — `"El usuario no tiene dispositivos activos registrados"`

---

## Device Tokens

> Todos los endpoints de `/api/device-tokens` **requieren autenticación JWT** (`Authorization: Bearer <JWT>`) con `userId`, `email` y `role` en el payload.

### `POST /api/device-tokens`

Registra o actualiza el token FCM del dispositivo. Si ya existe un registro con el mismo `token` o la misma combinación `userId + deviceId`, se actualiza en lugar de crear uno nuevo.

**Headers:**

```
Authorization: Bearer <JWT>
Content-Type: application/json
```

**Body:**

| Campo        | Tipo     | Requerido | Descripción                    |
| ------------ | -------- | --------- | ------------------------------ |
| `token`      | `string` | Sí        | Token FCM del dispositivo      |
| `platform`   | `string` | No        | `android`, `ios`, `web`, etc.  |
| `deviceId`   | `string` | No        | ID estable del dispositivo     |
| `deviceName` | `string` | No        | Nombre legible del dispositivo |

**Ejemplo:**

```bash
curl -X POST http://localhost:3004/api/device-tokens \
  -H "Authorization: Bearer TU_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "FCM_TOKEN_DEL_MOVIL",
    "platform": "android",
    "deviceId": "pixel-7-sergio",
    "deviceName": "Pixel 7"
  }'
```

**Respuesta 201:**

```json
{
  "success": true,
  "deviceToken": {
    "id": "clxxxx...",
    "userId": "user-id",
    "email": "user@example.com",
    "role": "user",
    "token": "FCM_TOKEN_DEL_MOVIL",
    "platform": "android",
    "deviceId": "pixel-7-sergio",
    "deviceName": "Pixel 7",
    "active": true,
    "lastUsedAt": "2025-07-14T08:10:00.000Z",
    "createdAt": "2025-07-14T08:10:00.000Z",
    "updatedAt": "2025-07-14T08:10:00.000Z"
  }
}
```

---

### `GET /api/device-tokens/me`

Lista los dispositivos activos del usuario autenticado.

**Headers:**

```
Authorization: Bearer <JWT>
```

**Ejemplo:**

```bash
curl http://localhost:3004/api/device-tokens/me \
  -H "Authorization: Bearer TU_JWT"
```

**Respuesta 200:**

```json
{
  "success": true,
  "devices": [
    {
      "id": "clxxxx...",
      "userId": "user-id",
      "email": "user@example.com",
      "role": "user",
      "token": "FCM_TOKEN_1",
      "platform": "android",
      "deviceId": "pixel-7",
      "deviceName": "Pixel 7",
      "active": true,
      "lastUsedAt": "2025-07-14T08:10:00.000Z",
      "createdAt": "2025-07-10T10:00:00.000Z",
      "updatedAt": "2025-07-14T08:10:00.000Z"
    }
  ]
}
```

---

### `GET /api/device-tokens/admin/all`

Lista **todos** los dispositivos registrados. Solo accesible para usuarios con rol `admin`.

**Headers:**

```
Authorization: Bearer <JWT>
```

**Restricciones:**

- Requiere JWT válido.
- El `role` del token debe ser `admin`.
- Si no es admin: `403` — `"Acceso denegado: se requiere rol de administrador"`.

**Ejemplo:**

```bash
curl http://localhost:3004/api/device-tokens/admin/all \
  -H "Authorization: Bearer TU_JWT_ADMIN"
```

**Respuesta 200:**

```json
{
  "success": true,
  "devices": [
    {
      "id": "clxxxx...",
      "userId": "user-id",
      "email": "user@example.com",
      "role": "user",
      "token": "FCM_TOKEN_1",
      "platform": "android",
      "deviceId": "pixel-7",
      "deviceName": "Pixel 7",
      "active": true,
      "lastUsedAt": "2025-07-14T08:10:00.000Z",
      "createdAt": "2025-07-10T10:00:00.000Z",
      "updatedAt": "2025-07-14T08:10:00.000Z"
    }
  ]
}
```

---

### `GET /api/device-tokens/admin/user/:userId`

Recupera todos los dispositivos (activos e inactivos) de un usuario específico. Solo accesible para administradores.

**Headers:**

```
Authorization: Bearer <JWT>
```

**Restricciones:**

- Requiere JWT válido con `role` igual a `admin`.
- El `userId` debe enviarse como parámetro de ruta.

**Ejemplo:**

```bash
curl http://localhost:3004/api/device-tokens/admin/user/user-id-123 \
  -H "Authorization: Bearer TU_JWT_ADMIN"
```

**Respuesta 200:**

```json
{
  "success": true,
  "userId": "user-id-123",
  "devices": [
    {
      "id": "clxxxx...",
      "userId": "user-id-123",
      "email": "user@example.com",
      "role": "user",
      "token": "FCM_TOKEN_1",
      "platform": "android",
      "deviceId": "pixel-7",
      "deviceName": "Pixel 7",
      "active": true,
      "lastUsedAt": "2025-07-14T08:10:00.000Z",
      "createdAt": "2025-07-10T10:00:00.000Z",
      "updatedAt": "2025-07-14T08:10:00.000Z"
    }
  ]
}
```

**Errores comunes:**

- `400` — `"El parámetro 'userId' es obligatorio"`
- `403` — `"Acceso denegado: se requiere rol de administrador"`

---

### `DELETE /api/device-tokens`

Desactiva un dispositivo del usuario autenticado. Se puede identificar por `token` o por `deviceId`.

**Headers:**

```
Authorization: Bearer <JWT>
Content-Type: application/json
```

**Body:**

| Campo      | Tipo     | Requerido | Descripción            |
| ---------- | -------- | --------- | ---------------------- |
| `token`    | `string` | Sí*       | Token FCM a desactivar |
| `deviceId` | `string` | Sí*       | Device ID a desactivar |

> *Se requiere al menos uno de los dos. Si se envían ambos, se usa `token`.

**Ejemplo (por deviceId):**

```bash
curl -X DELETE http://localhost:3004/api/device-tokens \
  -H "Authorization: Bearer TU_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "pixel-7-sergio"
  }'
```

**Respuesta 200:**

```json
{
  "success": true
}
```

**Respuesta 404 (no encontrado):**

```json
{
  "error": "Dispositivo no encontrado"
}
```

---

## Resumen de endpoints

| Método   | Ruta                                    | Auth | Descripción                                                 |
| -------- | --------------------------------------- | ---- | ----------------------------------------------------------- |
| `GET`    | `/health`                               | No   | Estado del servicio                                         |
| `GET`    | `/api/emails/templates`                 | No   | Lista plantillas disponibles                                |
| `GET`    | `/api/emails/health/smtp`               | No   | Verifica conexión SMTP                                      |
| `POST`   | `/api/emails/send`                      | No   | Envía email personalizado                                   |
| `POST`   | `/api/emails/send/template`             | No   | Envía email con plantilla                                   |
| `POST`   | `/api/emails/send/suggestion`           | No   | Notifica por email una nueva sugerencia de empresa al admin |
| `POST`   | `/api/emails/send/batch`                | No   | Envía lote de emails                                        |
| `POST`   | `/api/push/send`                        | No   | Push a un token                                             |
| `POST`   | `/api/push/send/multicast`              | No   | Push a múltiples tokens                                     |
| `POST`   | `/api/push/send/user`                   | No   | Push a todos los dispositivos de un usuario                 |
| `POST`   | `/api/push/send/template/user`          | No   | Push con plantilla a un usuario                             |
| `POST`   | `/api/push/send/topic`                  | No   | Push a un topic                                             |
| `POST`   | `/api/push/topic/subscribe`             | No   | Suscribe tokens a un topic                                  |
| `POST`   | `/api/push/topic/unsubscribe`           | No   | Desuscribe tokens de un topic                               |
| `POST`   | `/api/device-tokens`                    | JWT  | Registra/actualiza device token                             |
| `GET`    | `/api/device-tokens/me`                 | JWT  | Lista dispositivos del usuario                              |
| `GET`    | `/api/device-tokens/admin/all`          | JWT  | Lista todos los dispositivos (solo admin)                   |
| `GET`    | `/api/device-tokens/admin/user/:userId` | JWT  | Lista dispositivos de un usuario (solo admin)               |
| `DELETE` | `/api/device-tokens`                    | JWT  | Desactiva un dispositivo                                    |
