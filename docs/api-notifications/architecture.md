# Arquitectura

## Visión general

El microservicio de notificaciones es una aplicación **Node.js + Express** que funciona de forma independiente al resto del ecosistema Carpooling. Su única responsabilidad es **enviar notificaciones** (emails y push) y **gestionar tokens de dispositivos**.

```
                    ┌─────────────────────────────────┐
                    │    Microservicio de Notificaciones    │
                    │              (Port 3004)              │
                    │                                       │
  Otros microservicios   │  ┌──────────┐  ┌──────────┐      │
  (trips, users, etc.)──┼──┤  Emails   │  │   Push   │      │
                    │  │  │ (SMTP)   │  │  (FCM)   │      │
                    │  │  └────┬─────┘  └────┬─────┘      │
                    │  │       │              │             │
  App móvil ─────────┼──┤  ┌────┴──────────────┴─────┐     │
                    │  │  │    Device Tokens (JWT)   │     │
                    │  │  └────────────┬─────────────┘     │
                    │  └───────────────┼───────────────────┘
                    │                  │
                    │         ┌────────┴────────┐
                    │         │  Prisma ORM      │
                    │         └────────┬────────┘
                    │                  │
                    │         ┌────────┴────────┐
                    │         │  MySQL 8.4       │
                    │         │  (Docker:3307)   │
                    │         └─────────────────┘
                    │
           ┌────────┴────────┐
           │  Servidor SMTP   │
           │  (Gmail, etc.)   │
           └─────────────────┘
```

## Estructura del proyecto

```
carpooling-notiifications/
├── docker-compose.yml          # MySQL 8.4 en Docker
├── package.json                # Dependencias y scripts
├── .env.example                # Plantilla de variables de entorno
├── prisma/
│   ├── schema.prisma           # Esquema de la base de datos
│   └── migrations/             # Migraciones de Prisma
├── src/
│   ├── server.js               # Punto de entrada de Express
│   ├── config/
│   │   └── index.js            # Carga de variables de entorno
│   ├── routes/
│   │   ├── emailRoutes.js      # Rutas /api/emails
│   │   ├── pushRoutes.js       # Rutas /api/push
│   │   └── deviceTokenRoutes.js# Rutas /api/device-tokens
│   ├── controllers/
│   │   ├── emailController.js  # Lógica de validación de emails
│   │   ├── pushController.js   # Lógica de validación de push
│   │   └── deviceTokenController.js
│   ├── services/
│   │   ├── emailService.js     # Nodemailer - envío de emails
│   │   ├── pushService.js      # Firebase Admin - envío de push
│   │   ├── deviceTokenService.js # Prisma - CRUD de tokens
│   │   └── templateService.js  # Renderizado de plantillas HTML
│   ├── middleware/
│   │   ├── authMiddleware.js   # Verificación JWT RS256
│   │   └── errorMiddleware.js  # Manejo de errores 404/500
│   ├── lib/
│   │   └── prisma.js           # Singleton de PrismaClient
│   └── templates/              # Plantillas HTML de email
│       ├── welcome.html
│       ├── trip-confirmation.html
│       ├── trip-cancelled.html
│       ├── booking-request.html
│       └── password-reset.html
└── docs/                       # Esta documentación
```

## Patrón de capas

El servicio sigue un patrón **Routes → Controllers → Services**:

| Capa | Responsabilidad | Archivos |
|------|-----------------|----------|
| **Routes** | Definición de rutas HTTP y mapeo a controllers | `src/routes/*.js` |
| **Controllers** | Validación de input, manejo de req/res, delegación a services | `src/controllers/*.js` |
| **Services** | Lógica de negocio: envío de emails, push, operaciones DB | `src/services/*.js` |
| **Middleware** | Autenticación JWT y manejo centralizado de errores | `src/middleware/*.js` |
| **Lib** | Utilidades compartidas (Prisma singleton) | `src/lib/prisma.js` |

## Modelo de datos

El servicio gestiona una única tabla: `UserDeviceToken`.

### Esquema Prisma

```prisma
model UserDeviceToken {
  id         String   @id @default(cuid()) @db.VarChar(191)
  userId     String   @db.VarChar(191)
  email      String   @db.VarChar(191)
  role       String   @db.VarChar(191)
  token      String   @unique @db.VarChar(512)
  platform   String?  @db.VarChar(191)
  deviceId   String?  @db.VarChar(191)
  deviceName String?  @db.VarChar(191)
  active     Boolean  @default(true)
  lastUsedAt DateTime @default(now())
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([userId])
  @@index([email])
  @@index([active])
  @@unique([userId, deviceId])
}
```

### Descripción de campos

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | `String` (CUID) | Identificador único del registro |
| `userId` | `String` | ID del usuario (extraído del JWT) |
| `email` | `String` | Email del usuario (extraído del JWT) |
| `role` | `String` | Rol del usuario (extraído del JWT) |
| `token` | `String` | Token FCM del dispositivo (único) |
| `platform` | `String?` | Plataforma: `android`, `ios`, `web`, etc. |
| `deviceId` | `String?` | ID estable del dispositivo |
| `deviceName` | `String?` | Nombre legible del dispositivo |
| `active` | `Boolean` | Si el dispositivo está activo (`true` por defecto) |
| `lastUsedAt` | `DateTime` | Última vez que se usó/registró el token |
| `createdAt` | `DateTime` | Fecha de creación |
| `updatedAt` | `DateTime` | Fecha de última actualización |

### Reglas de unicidad

- **`token`**: único a nivel global. Un mismo token FCM no puede registrarse dos veces.
- **`userId + deviceId`**: único compuesto. Un usuario no puede registrar el mismo `deviceId` dos veces (si se envía `deviceId`).

### Índices

- `userId` — Para búsquedas rápidas por usuario
- `email` — Para búsquedas por email
- `active` — Para filtrar dispositivos activos eficientemente

## Flujos principales

### 1. Registro de dispositivo (app móvil)

```
App móvil                    Notifications Service              MySQL
   │                                │                              │
   │  POST /api/device-tokens       │                              │
   │  Authorization: Bearer <JWT>   │                              │
   │  { token, platform, deviceId } │                              │
   │───────────────────────────────>│                              │
   │                                │  Verifica JWT (RS256)        │
   │                                │  Extrae userId, email, role  │
   │                                │                              │
   │                                │  Upsert por deviceId o token │
   │                                │─────────────────────────────>│
   │                                │  <─── UserDeviceToken ──────│
   │  <─── 201 Created ────────────│                              │
   │  { success, deviceToken }      │                              │
```

### 2. Envío de push a un usuario (desde otro microservicio)

```
Microservicio X              Notifications Service              MySQL        FCM
   │                                │                              │           │
   │  POST /api/push/send/user      │                              │           │
   │  { userId, title, body, data } │                              │           │
   │───────────────────────────────>│                              │           │
   │                                │  SELECT tokens WHERE userId  │           │
   │                                │  AND active = true           │           │
   │                                │─────────────────────────────>│           │
   │                                │  <─── [token1, token2] ─────│           │
   │                                │                              │           │
   │                                │  Envía push a cada token     │           │
   │                                │─────────────────────────────────────────>│
   │                                │  <─── messageIds ────────────────────────│
   │  <─── 200 OK ─────────────────│                              │           │
   │  { success, succeeded, failed }│                              │           │
```

### 3. Envío de email con plantilla (desde otro microservicio)

```
Microservicio X              Notifications Service           SMTP Server
   │                                │                              │
   │  POST /api/emails/send/template│                              │
   │  { to, template, data }        │                              │
   │───────────────────────────────>│                              │
   │                                │  Valida template y campos    │
   │                                │  Renderiza HTML con data     │
   │                                │  Convierte HTML → texto      │
   │                                │                              │
   │                                │  sendMail(from, to, html)    │
   │                                │─────────────────────────────>│
   │                                │  <── messageId ─────────────│
   │  <─── 200 OK ─────────────────│                              │
   │  { success, messageId, ... }   │                              │
```

## Dependencias técnicas

| Dependencia | Versión | Propósito |
|-------------|---------|-----------|
| `express` | ^5.2.1 | Framework HTTP |
| `nodemailer` | ^9.0.3 | Envío de emails por SMTP |
| `firebase-admin` | ^14.1.0 | Firebase Cloud Messaging (push) |
| `@prisma/client` | ^6.19.3 | ORM para MySQL |
| `jsonwebtoken` | ^9.0.3 | Verificación de JWT |
| `cors` | ^2.8.6 | Middleware CORS |
| `dotenv` | ^17.4.2 | Carga de variables de entorno |
| `prisma` (dev) | ^6.19.3 | CLI de Prisma para migraciones |

## Comunicación con otros servicios

Este microservicio **no inicia comunicación** hacia otros servicios. Es completamente pasivo: solo responde a peticiones HTTP entrantes.

### Servicios que consumen este microservicio

| Servicio | Uso típico |
|----------|------------|
| **Users** | Email de bienvenida (`welcome`), reset de contraseña (`password_reset`) |
| **Trips** | Confirmación de viaje (`trip_confirmation`), cancelación (`trip_cancelled`) |
| **Bookings** | Solicitud de reserva (`booking_request`), push de nueva reserva |
| **Chat/Mensajes** | Push de nuevo mensaje |
| **App móvil** | Registro de device tokens, listar/desactivar dispositivos |

### Lo que este servicio necesita de otros

- **Clave pública JWT** del servicio de autenticación (para verificar tokens)
- **Estructura del JWT**: payload con `{ userId, email, role }`
