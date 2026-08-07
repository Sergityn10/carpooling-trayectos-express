# Admin API

Base URL: `/api/admin`

**Auth:** Todos los endpoints requieren autenticación con token Bearer y rol `admin`.

```
Authorization: Bearer <token>
```

> **Control de acceso:** Todos los endpoints verifican que `req.user.role === "admin"`. Si no se cumple, devuelven `403`.

---

## Trayectos

### Listar todos los trayectos

```
GET /api/admin/trayectos
```

**Query params:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `page` | int | Página (default: 1) |
| `limit` | int | Elementos por página (default: 10, max: 100) |
| `status` | string | Filtrar por estado del trayecto |
| `conductor` | string | Filtrar por ID de conductor |
| `evento_id` | string | Filtrar por ID de evento |
| `fechaDesde` | string | Fecha mínima (ISO) |
| `fechaHasta` | string | Fecha máxima (ISO) |
| `search` | string | Buscar por origen o destino |

**Respuesta 200:**

```json
{
  "data": [
    {
      "id": "uuid",
      "origen": "Madrid",
      "destino": "Valencia",
      "hora": "2025-01-15T10:00:00.000Z",
      "plazas": 4,
      "disponible": 2,
      "precio": 25.5,
      "conductor": "uuid",
      "status": "programado"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

### Obtener trayecto por ID

```
GET /api/admin/trayectos/:id
```

**Respuesta 200:** Datos completos del trayecto.

### Actualizar trayecto

```
PUT /api/admin/trayectos/:id
```

**Body:** Campos a actualizar (origen, destino, hora, plazas, disponible, precio, precio_conductor, status, origen_lat, origen_lng, destino_lat, destino_lng, evento_id, vehiculo_id).

**Respuesta 200:** Trayecto actualizado.

### Eliminar trayecto

```
DELETE /api/admin/trayectos/:id
```

Elimina el trayecto y todos sus datos relacionados (tramos, recorridos, eventos, comentarios, InfoCAEs, pagos, reservas) en una transacción.

**Respuesta 200:**

```json
{
  "status": "Success"
}
```

---

## Reservas

### Listar todas las reservas

```
GET /api/admin/reservas
```

**Query params:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `page` | int | Página (default: 1) |
| `limit` | int | Elementos por página (default: 10, max: 100) |
| `status` | string | Filtrar por estado (`pending`, `confirmed`, `canceled`) |
| `user_id` | string | Filtrar por usuario |
| `id_trayecto` | string | Filtrar por trayecto |
| `trip_outcome` | string | Filtrar por resultado del viaje |
| `orderBy` | string | Campo de ordenación (default: `created_at`) |
| `order` | string | `asc` o `desc` (default: `desc`) |

**Respuesta 200:**

```json
{
  "status": "Success",
  "data": [
    {
      "id_reserva": "uuid",
      "user_id": "uuid",
      "id_trayecto": "uuid",
      "status": "confirmed",
      "trip_outcome": "pending",
      "created_at": "2025-01-15T10:00:00.000Z"
    }
  ],
  "pagination": { ... }
}
```

### Obtener reserva por ID

```
GET /api/admin/reservas/:id
```

**Respuesta 200:** Datos de la reserva incluyendo el trayecto relacionado.

### Actualizar reserva

```
PUT /api/admin/reservas/:id
```

**Body (campos permitidos):**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `status` | string | Estado de la reserva |
| `trip_outcome` | string | Resultado del viaje |
| `trip_outcome_reason` | string | Motivo del resultado |
| `trip_outcome_at` | string | Fecha del resultado (ISO) |
| `stripe_payment_intent_status` | string | Estado del pago en Stripe |

**Respuesta 200:** Reserva actualizada.

### Eliminar reserva

```
DELETE /api/admin/reservas/:id
```

**Respuesta 200:**

```json
{
  "status": "Success",
  "message": "Reserva eliminada correctamente"
}
```

---

## Comentarios

### Listar todos los comentarios

```
GET /api/admin/comments
```

**Query params:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `page` | int | Página (default: 1) |
| `limit` | int | Elementos por página (default: 10, max: 100) |
| `user_id_commentator` | string | Filtrar por comentarista |
| `user_id_trayect` | string | Filtrar por conductor comentado |
| `id_trayecto` | string | Filtrar por trayecto |
| `orderBy` | string | Campo de ordenación (default: `created_at`) |
| `order` | string | `asc` o `desc` (default: `desc`) |

**Respuesta 200:**

```json
{
  "status": "Success",
  "data": [
    {
      "id_comment": "uuid",
      "user_id_commentator": "uuid",
      "user_id_trayect": "uuid",
      "id_trayecto": "uuid",
      "opinion": "Buen viaje",
      "rating": 5,
      "created_at": "2025-01-15T10:00:00.000Z"
    }
  ],
  "pagination": { ... }
}
```

### Obtener comentario por ID

```
GET /api/admin/comments/:id
```

### Actualizar comentario

```
PUT /api/admin/comments/:id
```

**Body (campos permitidos):**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `opinion` | string | Texto de la opinión |
| `rating` | int | Puntuación (1-5) |

### Eliminar comentario

```
DELETE /api/admin/comments/:id
```

---

## Pagos

### Listar todos los pagos

```
GET /api/admin/pagos
```

**Query params:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `page` | int | Página (default: 1) |
| `limit` | int | Elementos por página (default: 10, max: 100) |
| `user_id` | string | Filtrar por usuario |
| `id_trayecto` | string | Filtrar por trayecto |
| `payment_status` | string | Filtrar por estado de pago |
| `orderBy` | string | Campo de ordenación (default: `created_at`) |
| `order` | string | `asc` o `desc` (default: `desc`) |

**Respuesta 200:**

```json
{
  "status": "Success",
  "data": [
    {
      "id": 1,
      "stripe_checkout_session_id": "cs_xxx",
      "stripe_payment_intent_id": "pi_xxx",
      "payment_status": "paid",
      "amount": 2550,
      "currency": "eur",
      "user_id": "uuid",
      "id_trayecto": "uuid",
      "created_at": "2025-01-15T10:00:00.000Z"
    }
  ],
  "pagination": { ... }
}
```

### Obtener pago por ID

```
GET /api/admin/pagos/:id
```

### Eliminar pago

```
DELETE /api/admin/pagos/:id
```

---

## Recorridos (GPS tracking)

### Listar todos los puntos de recorrido

```
GET /api/admin/recorridos
```

**Query params:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `page` | int | Página (default: 1) |
| `limit` | int | Elementos por página (default: 10, max: 100) |
| `id_trayecto` | string | Filtrar por trayecto |
| `user_id` | string | Filtrar por usuario |
| `orderBy` | string | Campo de ordenación (default: `created_at`) |
| `order` | string | `asc` o `desc` (default: `asc`) |

**Respuesta 200:**

```json
{
  "status": "Success",
  "data": [
    {
      "id": "uuid",
      "id_trayecto": "uuid",
      "user_id": "uuid",
      "lat": 40.4168,
      "lng": -3.7038,
      "address": "Madrid, España",
      "created_at": "2025-01-15T10:00:00.000Z"
    }
  ],
  "pagination": { ... }
}
```

### Eliminar punto de recorrido

```
DELETE /api/admin/recorridos/:id
```

### Eliminar todos los puntos de recorrido de un trayecto

```
DELETE /api/admin/recorridos/trayecto/:id_trayecto
```

**Respuesta 200:**

```json
{
  "status": "Success",
  "message": "15 puntos de recorrido eliminados"
}
```

---

## Eventos de Trayecto

### Listar todos los eventos

```
GET /api/admin/eventos
```

**Query params:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `page` | int | Página (default: 1) |
| `limit` | int | Elementos por página (default: 10, max: 100) |
| `id_trayecto` | string | Filtrar por trayecto |
| `user_id` | string | Filtrar por usuario |
| `id_tipo_evento` | int | Filtrar por tipo de evento |
| `orderBy` | string | Campo de ordenación (default: `created_at`) |
| `order` | string | `asc` o `desc` (default: `asc`) |

**Respuesta 200:**

```json
{
  "status": "Success",
  "data": [
    {
      "id": "uuid",
      "id_trayecto": "uuid",
      "id_reserva": "uuid",
      "user_id": "uuid",
      "id_tipo_evento": 1,
      "lat": 40.4168,
      "lng": -3.7038,
      "created_at": "2025-01-15T10:00:00.000Z",
      "TipoEvento": {
        "nombre": "comienzo"
      }
    }
  ],
  "pagination": { ... }
}
```

### Eliminar evento

```
DELETE /api/admin/eventos/:id
```

### Eliminar todos los eventos de un trayecto

```
DELETE /api/admin/eventos/trayecto/:id_trayecto
```

---

## Tramos

### Listar todos los tramos

```
GET /api/admin/tramos
```

**Query params:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `page` | int | Página (default: 1) |
| `limit` | int | Elementos por página (default: 10, max: 100) |
| `id_trayecto` | string | Filtrar por trayecto |
| `orderBy` | string | Campo de ordenación (default: `step_order`) |
| `order` | string | `asc` o `desc` (default: `asc`) |

**Respuesta 200:**

```json
{
  "status": "Success",
  "data": [
    {
      "id": "uuid",
      "id_trayecto": "uuid",
      "lat": 40.4168,
      "lng": -3.7038,
      "address": "Madrid, España",
      "step_order": 0,
      "created_at": "2025-01-15T10:00:00.000Z"
    }
  ],
  "pagination": { ... }
}
```

### Eliminar tramo

```
DELETE /api/admin/tramos/:id
```

### Eliminar todos los tramos de un trayecto

```
DELETE /api/admin/tramos/trayecto/:id_trayecto
```

---

## Ubicaciones

### Listar todas las ubicaciones

```
GET /api/admin/ubicaciones
```

**Query params:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `page` | int | Página (default: 1) |
| `limit` | int | Elementos por página (default: 10, max: 100) |
| `user_id` | string | Filtrar por usuario |
| `orderBy` | string | Campo de ordenación (default: `created_at`) |
| `order` | string | `asc` o `desc` (default: `desc`) |

**Respuesta 200:**

```json
{
  "status": "Success",
  "data": [
    {
      "id": "uuid",
      "lat": 40.4168,
      "lng": -3.7038,
      "display_name": "Casa",
      "address": "Calle Mayor 1, Madrid",
      "city": "Madrid",
      "province": "Madrid",
      "country": "España",
      "postal_code": "28001",
      "type": "home",
      "user_id": "uuid",
      "created_at": "2025-01-15T10:00:00.000Z"
    }
  ],
  "pagination": { ... }
}
```

### Eliminar ubicación

```
DELETE /api/admin/ubicaciones/:id
```

---

## Rutas Frecuentes

### Listar todas las rutas frecuentes

```
GET /api/admin/frequent-routes
```

**Query params:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `page` | int | Página (default: 1) |
| `limit` | int | Elementos por página (default: 10, max: 100) |
| `user_id` | string | Filtrar por usuario |
| `role` | string | Filtrar por rol (`DRIVER`, `PASSENGER`) |
| `orderBy` | string | Campo de ordenación (default: `createdAt`) |
| `order` | string | `asc` o `desc` (default: `desc`) |

**Respuesta 200:**

```json
{
  "status": "Success",
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "name": "Ruta al trabajo",
      "originAddress": "Calle Mayor 1, Madrid",
      "originLat": 40.4168,
      "originLng": -3.7038,
      "destAddress": "Polígono Industrial, Madrid",
      "destLat": 40.45,
      "destLng": -3.65,
      "role": "DRIVER",
      "seats": 4,
      "createdAt": "2025-01-15T10:00:00.000Z"
    }
  ],
  "pagination": { ... }
}
```

### Eliminar ruta frecuente

```
DELETE /api/admin/frequent-routes/:id
```

---

## Info CAEs

### Listar todos los InfoCAEs

```
GET /api/admin/caes
```

**Query params:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `page` | int | Página (default: 1) |
| `limit` | int | Elementos por página (default: 10, max: 100) |
| `status` | string | Filtrar por estado (`pending`, `in_review`, `completed`) |
| `id_trayecto` | string | Filtrar por trayecto |
| `orderBy` | string | Campo de ordenación (default: `created_at`) |
| `order` | string | `asc` o `desc` (default: `desc`) |

**Respuesta 200:**

```json
{
  "status": "Success",
  "data": [
    {
      "id": "uuid",
      "id_trayecto": "uuid",
      "km_recorridos": 350.5,
      "km_with_company": 320.0,
      "kwh_generated": 12.8,
      "eur_generated": 25.6,
      "status_id": 2,
      "StatusInfoCAEs": {
        "id": 2,
        "name": "in_review"
      },
      "created_at": "2025-01-15T10:00:00.000Z"
    }
  ],
  "pagination": { ... }
}
```

### Actualizar InfoCAE

```
PUT /api/admin/caes/:id
```

**Body (campos permitidos):**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `km_recorridos` | float | Kilómetros recorridos |
| `km_with_company` | float | Kilómetros con compañía |
| `kwh_generated` | float | kWh generados |
| `eur_generated` | float | Euros generados |
| `status_id` | int | ID del estado |
| `report_id` | string | ID del reporte CAE asociado |

### Eliminar InfoCAE

```
DELETE /api/admin/caes/:id
```

---

## CAE Reports (ya existentes)

> Los endpoints de CAE Reports (`/api/cae/reports`, `/api/cae/:id/approve`, etc.) ya están documentados en [viajes.md](./viajes.md#reportes-cae).

---

## Resumen de endpoints

| Tabla | GET (list) | GET (by id) | PUT | DELETE | DELETE (by trayecto) |
|-------|-----------|-------------|-----|--------|---------------------|
| Trayectos | ✅ | ✅ | ✅ | ✅ | — |
| Reservas | ✅ | ✅ | ✅ | ✅ | — |
| Comments | ✅ | ✅ | ✅ | ✅ | — |
| Pagos | ✅ | ✅ | — | ✅ | — |
| Recorridos | ✅ | — | — | ✅ | ✅ |
| Eventos | ✅ | — | — | ✅ | ✅ |
| Tramos | ✅ | — | — | ✅ | ✅ |
| Ubicaciones | ✅ | — | — | ✅ | — |
| Frequent Routes | ✅ | — | — | ✅ | — |
| Info CAEs | ✅ | — | ✅ | ✅ | — |
