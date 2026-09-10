# Trayectos

Endpoints para gestionar trayectos (viajes compartidos).

**Base URL:** `/api/trayecto`

## Modelo de datos

| Campo         | Tipo     | Descripción                                    |
| ------------- | -------- | ---------------------------------------------- |
| `id`          | UUID     | Identificador único del trayecto               |
| `origen`      | String   | Dirección de origen                            |
| `destino`     | String   | Dirección de destino                           |
| `hora`        | DateTime | Fecha y hora de salida (UTC)                   |
| `plazas`      | Int      | Número total de plazas                         |
| `disponible`  | Int      | Plazas disponibles                             |
| `precio`      | Float    | Precio por plaza (€)                           |
| `conductor`   | UUID     | ID del conductor                               |
| `vehiculo_id` | UUID     | **Obligatorio.** ID del vehículo del conductor |
| `routeIndex`  | Int      | Índice de ruta (default 0)                     |
| `status`      | String   | `programado`, `en curso`, `finalizado`         |
| `origen_lat`  | Float    | Latitud del origen (auto)                      |
| `origen_lng`  | Float    | Longitud del origen (auto)                     |
| `destino_lat` | Float    | Latitud del destino (auto)                     |
| `destino_lng` | Float    | Longitud del destino (auto)                    |
| `evento_id`   | UUID     | ID del evento asociado (opcional)              |
| `created_at`  | DateTime | Fecha de creación                              |
| `updated_at`  | DateTime | Fecha de última actualización                  |

## Endpoints

### Listar todos los trayectos

```
GET /api/trayecto
```

**Auth:** Requerida

**Descripción:** Devuelve todos los trayectos disponibles (excluyendo finalizados, en curso y cancelados) con paginación. Incluye nombre e imagen del conductor y campo `valorado`.

**Query params:**

| Parámetro | Tipo | Descripción                                    |
| --------- | ---- | ---------------------------------------------- |
| `page`    | Int  | Página (por defecto 1)                         |
| `limit`   | Int  | Elementos por página (por defecto 10, máx 100) |

**Respuesta 200:**

```json
{
  "status": "Success",
  "data": [
    {
      "id": "uuid",
      "origen": "Madrid",
      "destino": "Valencia",
      "conductor": "Juan Pérez",
      "conductor_id": "uuid",
      "img_perfil": "https://...",
      "valorado": false
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

---

### Buscar trayectos

```
GET /api/trayecto/search
```

**Auth:** Opcional

**Query params:**

| Param       | Tipo   | Descripción                   |
| ----------- | ------ | ----------------------------- |
| `origen`    | String | Dirección o ciudad de origen  |
| `destino`   | String | Dirección o ciudad de destino |
| `fecha`     | String | Fecha en formato `YYYY-MM-DD` |
| `plazas`    | Int    | Plazas mínimas requeridas     |
| `evento_id` | UUID   | Filtrar por evento            |

> **Nota:** Cada búsqueda se registra automáticamente en la tabla `trayecto_search_history` con origen, destino, fecha, pasajeros, coordenadas geocodificadas, número de resultados, IP y User-Agent. Si el usuario está autenticado, se asocia su `user_id`; si no, queda como anónimo.

---

### Obtener historial de búsquedas

```
GET /api/trayecto/search-history
```

**Auth:** Requerida

**Descripción:** Devuelve el historial de búsquedas de trayectos del usuario autenticado, ordenado por fecha descendente (más recientes primero). Solo incluye búsquedas realizadas por el usuario autenticado.

**Query params:**

| Parámetro | Tipo | Descripción                                    |
| --------- | ---- | ---------------------------------------------- |
| `page`    | Int  | Página (por defecto 1)                         |
| `limit`   | Int  | Elementos por página (por defecto 20, máx 100) |

**Respuesta 200:**

```json
{
  "data": [
    {
      "id": 1,
      "user_id": "uuid",
      "origin": "Madrid",
      "destination": "Toledo",
      "search_date": "2026-09-02",
      "passengers": 2,
      "origin_lat": 40.4168,
      "origin_lng": -3.7038,
      "destination_lat": 39.8628,
      "destination_lng": -4.0229,
      "results_count": 5,
      "ip_address": "192.168.1.1",
      "user_agent": "Mozilla/5.0 ...",
      "created_at": "2026-09-02T07:50:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 35,
    "totalPages": 2,
    "hasNext": true,
    "hasPrev": false,
    "nextPage": 2,
    "prevPage": null
  }
}
```

**Modelo de datos `trayecto_search_history`:**

| Campo             | Tipo     | Descripción                             |
| ----------------- | -------- | --------------------------------------- |
| `id`              | Int      | Autoincrement                           |
| `user_id`         | UUID?    | ID del usuario (null si anónimo)        |
| `origin`          | String   | Origen buscado                          |
| `destination`     | String   | Destino buscado                         |
| `search_date`     | String   | Fecha del trayecto buscado (YYYY-MM-DD) |
| `passengers`      | Int      | Número de pasajeros                     |
| `origin_lat`      | Float?   | Latitud geocodificada del origen        |
| `origin_lng`      | Float?   | Longitud geocodificada del origen       |
| `destination_lat` | Float?   | Latitud geocodificada del destino       |
| `destination_lng` | Float?   | Longitud geocodificada del destino      |
| `results_count`   | Int      | Número de resultados encontrados        |
| `ip_address`      | String?  | IP del usuario                          |
| `user_agent`      | String?  | User-Agent del navegador                |
| `created_at`      | DateTime | Timestamp de la búsqueda                |

**Errores:**

- `401` — No autenticado.
- `500` — Error en el servidor.

---

### Obtener mis trayectos (como conductor)

```
GET /api/trayecto/mis-trayectos
```

**Auth:** Requerida

**Descripción:** Devuelve los trayectos del usuario autenticado como conductor, con paginación. Incluye nombre e imagen del conductor y campo `valorado`.

**Query params:**

| Parámetro | Tipo | Descripción                                    |
| --------- | ---- | ---------------------------------------------- |
| `page`    | Int  | Página (por defecto 1)                         |
| `limit`   | Int  | Elementos por página (por defecto 10, máx 100) |

**Respuesta 200:**

```json
{
  "data": [
    {
      "id": "uuid",
      "origen": "Madrid",
      "destino": "Valencia",
      "conductor": "Juan Pérez",
      "conductor_id": "uuid",
      "img_perfil": "https://...",
      "valorado": false
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 15,
    "totalPages": 2,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

---

### Obtener próximos trayectos (como pasajero)

```
GET /api/trayecto/proximos
```

**Auth:** Requerida

**Descripción:** Devuelve los próximos trayectos del usuario (como conductor o pasajero con reserva activa) dentro de las próximas 48 horas o en curso. **Sin paginación** (devuelve todos los resultados). Incluye reservas confirmadas con info de pasajeros (nombre e imagen).

**Respuesta 200:**

```json
{
  "data": [
    {
      "id": "uuid",
      "origen": "Madrid",
      "destino": "Valencia",
      "hora": "2025-01-15T10:00:00.000Z",
      "conductor": "Juan Pérez",
      "conductor_id": "uuid",
      "img_perfil": "https://...",
      "valorado": false,
      "reservas": [
        {
          "id_reserva": "uuid",
          "user_id": "uuid",
          "status": "completed",
          "trip_outcome": "pending",
          "created_at": "2025-01-10T12:00:00.000Z",
          "nombre": "Ana López",
          "img_perfil": "https://..."
        }
      ]
    }
  ]
}
```

---

### Obtener trayecto por ID

```
GET /api/trayecto/:id
```

**Auth:** Opcional

**Respuesta:** Datos completos del trayecto + preferencias del conductor + nombre e imagen del conductor.

---

### Obtener trayecto completo

```
GET /api/trayecto/:id/completo
```

**Auth:** Opcional

**Respuesta:** Trayecto + reservas + eventos + preferencias + información del conductor.

---

### Obtener estado del trayecto (pasajero)

```
GET /api/trayecto/:id/estado
```

**Auth:** Requerida

---

### Crear trayecto

```
POST /api/trayecto
```

**Auth:** Requerida

**Body:**

```json
{
  "origen": "Madrid",
  "destino": "Toledo",
  "fecha": "2026-07-20",
  "hora": "10:00",
  "plazas": 4,
  "precio": 0,
  "conductor": "uuid-del-conductor",
  "vehiculo_id": "uuid-del-vehiculo",
  "routeIndex": 0,
  "evento_id": "uuid-del-evento (opcional)",
  "origen_lat": 40.4168,
  "origen_lng": -3.7038,
  "destino_lat": 39.8628,
  "destino_lng": -4.0273
}
```

**Campos obligatorios:** `origen`, `destino`, `fecha`, `hora`, `plazas`, `precio`, `conductor`, `vehiculo_id`

**Notas:**
- Si `conductor` no se envía, se usa el ID del usuario autenticado.
- Si `disponible` no se envía, se usa el valor de `plazas`.
- Si `precio` es `0`, se calcula automáticamente según el precio del gasoil de la provincia.
- Si la hora está a menos de 2 minutos de ahora, el estado inicial es `en curso`; si no, `programado`.
- Se crea automáticamente un chat asociado al trayecto en el microservicio de mensajes.

**Respuesta 201:**

```json
{
  "status": "Success",
  "message": "Trayecto creado correctamente",
  "trayecto": {
    "id": "uuid",
    "origen": "Madrid",
    "destino": "Toledo",
    "fecha": "2026-07-20",
    "hora": "10:00",
    "plazas": 4,
    "conductor": "Nombre del conductor",
    "conductor_id": "uuid-del-conductor",
    "vehiculo_id": "uuid-del-vehiculo",
    "precio": 5
  }
}
```

---

### Crear trayecto para un evento

```
POST /api/trayecto/evento
```

**Auth:** Requerida

**Body:** Igual que crear trayecto, pero con `evento_id` obligatorio.

---

### Obtener trayectos por evento

```
GET /api/trayecto/evento/:eventoId
```

**Auth:** Opcional

---

### Buscar trayectos por evento cerca de tu ubicación

```
GET /api/trayecto/evento/:eventoId/cerca
```

**Auth:** Opcional

**Descripción:** Busca trayectos asociados a un evento concreto que pasen cerca de la ubicación del usuario. Permite buscar por coordenadas (`lat`/`lng`) o por nombre de ciudad (se geocodifica automáticamente). Obtiene las coordenadas del evento desde el microservicio de usuarios y filtra los trayectos según dirección (ida/vuelta), fecha y proximidad.

**Path params:**

| Parámetro  | Tipo          | Descripción   |
| ---------- | ------------- | ------------- |
| `eventoId` | string (UUID) | ID del evento |

**Query params:**

| Parámetro   | Tipo   | Requerido | Descripción                                                              |
| ----------- | ------ | --------- | ------------------------------------------------------------------------ |
| `lat`       | Float  | Sí*       | Latitud de tu ubicación actual                                           |
| `lng`       | Float  | Sí*       | Longitud de tu ubicación actual                                          |
| `ciudad`    | String | Sí*       | Nombre de ciudad (alternativa a lat/lng, se geocodifica automáticamente) |
| `radius`    | Float  | No        | Radio de búsqueda en km (por defecto 0.2 km = 200 m)                     |
| `direccion` | String | No        | `ida` (trayectos que van al evento) o `vuelta` (trayectos que vuelven)   |
| `fecha`     | String | No        | Filtrar por fecha del trayecto en formato `YYYY-MM-DD`                   |

> *\*Debes proporcionar `lat`+`lng` **o** `ciudad`. Si se proporcionan ambos, se usa `lat`/`lng`.*

**Lógica de filtrado:**

1. Obtiene las coordenadas del evento desde el microservicio de usuarios
2. Filtra trayectos con `evento_id` = `eventoId`, plazas disponibles y estado activo
3. Si `fecha` se especifica, filtra por la fecha del trayecto
4. Si `direccion=ida`: filtra trayectos cuyo destino coincide con la ubicación del evento
5. Si `direccion=vuelta`: filtra trayectos cuyo origen coincide con la ubicación del evento
6. Calcula con Haversine qué trayectos pasan cerca del usuario (origen o tramos intermedios dentro del radio)

**Ejemplos de uso:**

```
GET /api/trayecto/evento/550e8400.../cerca?lat=40.4168&lng=-3.7038&radius=5&direccion=ida
GET /api/trayecto/evento/550e8400.../cerca?ciudad=Madrid&direccion=ida&fecha=2026-09-15
GET /api/trayecto/evento/550e8400.../cerca?ciudad=Toledo&radius=10&direccion=vuelta
```

**Respuesta 200:**

```json
{
  "status": "Success",
  "evento_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_location": { "lat": 40.4168, "lng": -3.7038 },
  "search_radius_km": 5,
  "ciudad": "Madrid",
  "fecha": "2026-09-15",
  "direccion": "ida",
  "total": 3,
  "trayectos": [
    {
      "id": "uuid",
      "origen": "Madrid Centro",
      "destino": "Palacio Vistalegre",
      "hora": "2026-09-15T18:00:00.000Z",
      "plazas": 4,
      "disponible": 2,
      "precio": 5,
      "conductor": "Juan Pérez",
      "conductor_id": "uuid",
      "img_perfil": "https://...",
      "valorado": false,
      "distancia_km": 1.23
    }
  ]
}
```

**Errores:**

- `400` — Falta `eventoId`, o no se proporcionó `lat`/`lng` ni `ciudad`, o no se pudo geocodificar la ciudad.
- `404` — No se pudieron obtener las coordenadas del evento.
- `500` — Error en el servidor.

---

### Actualizar trayecto (PATCH parcial)

```
PATCH /api/trayecto/:id
```

**Auth:** No requerida (verificar en producción)

**Body:** Todos los campos del schema (validación completa `validateTrayectoSinId`), incluyendo `vehiculo_id` obligatorio.

**Notas:**
- Recalcula coordenadas si cambia `origen` o `destino`.
- Recalcula `disponible` si cambia `plazas`.

---

### Actualizar trayecto (PUT parcial)

```
PUT /api/trayecto/:id
```

**Auth:** No requerida (verificar en producción)

**Body:** Campos parciales (validación `validateTrayectoPartial`). Si se envía `vehiculo_id`, se actualiza.

**Notas:**
- `fecha` y `hora` deben enviarse juntos si se quieren actualizar.

---

### Iniciar trayecto

```
POST /api/trayecto/:id/iniciar
```

**Auth:** Requerida

**Notas:** Cambia el estado a `en curso` y envía notificaciones (push + email) a conductor y pasajeros.

---

### Finalizar trayecto

```
POST /api/trayecto/:id/finalizar
```

**Auth:** Requerida (solo el conductor puede finalizar)

**Notas:** Cambia el estado a `finalizado`, envía notificaciones (push + email) a conductor y pasajeros, y genera informe CAE.

---

### Eliminar trayecto

```
DELETE /api/trayecto/:id
```

**Auth:** No requerida (verificar en producción)

---

### Obtener trayectos por conductor

```
GET /api/trayecto/conductor/:id
```

**Auth:** Opcional

**Descripción:** Devuelve los trayectos de un conductor específico, con paginación.

**Path params:**

| Parámetro | Tipo          | Descripción      |
| --------- | ------------- | ---------------- |
| `id`      | string (UUID) | ID del conductor |

**Query params:**

| Parámetro | Tipo | Descripción                                    |
| --------- | ---- | ---------------------------------------------- |
| `page`    | Int  | Página (por defecto 1)                         |
| `limit`   | Int  | Elementos por página (por defecto 10, máx 100) |

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
      "status": "programado"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 8,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

---

### Actualizar coordenadas (administración)

```
PUT /api/trayecto/update
PUT /api/trayecto/update/id/:id
```

Recalcula las coordenadas (lat/lng) de todos los trayectos o de uno específico a partir de sus direcciones.

---

## Recorridos y recogidas

### Guardar ubicación en tiempo real

```
POST /api/trayecto/:id/recorrido
```

**Auth:** Requerida

### Obtener recorrido

```
GET /api/trayecto/:id/recorrido
```

**Auth:** Requerida

### Crear recogida

```
POST /api/trayecto/:id/recoger
```

**Auth:** Requerida

### Obtener recogidas

```
GET /api/trayecto/:id/recoger
GET /api/trayecto/:id/recoger/:idUser
```

**Auth:** Requerida

### Eliminar recogida

```
DELETE /api/trayecto/:id/recoger/:idUser
```

**Auth:** Requerida

### Registrar llegada a destino

```
POST /api/trayecto/:id/llegada
```

**Auth:** Requerida

---

## Administración de trayectos (Admin)

Endpoints exclusivos para administradores (`req.user.role === "admin"`). Permiten gestionar todos los trayectos del sistema, incluidos los ya finalizados o cancelados.

**Base URL:** `/api/admin/trayectos`

### Listar todos los trayectos (admin)

```
GET /api/admin/trayectos
```

**Auth:** Requerida (solo admin)

**Descripción:** Devuelve todos los trayectos del sistema (incluidos pasados y cancelados) con filtros avanzados, ordenación y paginación. Incluye nombre y email del conductor obtenidos del microservicio de usuarios.

**Query params:**

| Param        | Tipo   | Descripción                                                                             |
| ------------ | ------ | --------------------------------------------------------------------------------------- |
| `status`     | String | Filtrar por estado. Acepta múltiples separados por coma (ej: `programado,en curso`)     |
| `conductor`  | UUID   | Filtrar por ID de conductor                                                             |
| `evento_id`  | UUID   | Filtrar por evento asociado                                                             |
| `fechaDesde` | String | Fecha mínima del campo `hora` (formato ISO 8601)                                        |
| `fechaHasta` | String | Fecha máxima del campo `hora` (formato ISO 8601)                                        |
| `search`     | String | Búsqueda textual sobre `origen` y `destino`                                             |
| `orderBy`    | String | Campo por el que ordenar (ej: `hora`, `created_at`, `precio`). Por defecto `created_at` |
| `order`      | String | Dirección de ordenación: `asc` o `desc`. Por defecto `desc`                             |
| `page`       | Int    | Página (por defecto 1)                                                                  |
| `limit`      | Int    | Elementos por página (por defecto 10, máximo 100)                                       |

**Respuesta 200:**

```json
{
  "status": "Success",
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "origen": "Madrid",
      "destino": "Toledo",
      "hora": "2026-07-15T10:00:00.000Z",
      "plazas": 4,
      "disponible": 3,
      "precio": 15,
      "precio_conductor": 11.00,
      "conductor": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "conductor_nombre": "Juan Pérez",
      "conductor_email": "juan@example.com",
      "vehiculo_id": "v1e2d3c4-b5a6-7890-abcd-ef1234567890",
      "status": "finalizado",
      "created_at": "2026-07-10T12:00:00.000Z",
      "updated_at": "2026-07-15T11:35:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 150,
    "totalPages": 15,
    "hasNext": true,
    "hasPrev": false,
    "nextPage": 2,
    "prevPage": null
  }
}
```

**Errores:**

- `403` — El usuario no es admin.
- `500` — Error en el servidor.

---

### Obtener trayecto por ID (admin)

```
GET /api/admin/trayectos/:id
```

**Auth:** Requerida (solo admin)

**Descripción:** Devuelve el detalle completo de un trayecto, incluyendo reservas, tramos de ruta y eventos del trayecto (comienzo, recogida, llegada_destino, finalizacion).

**Path params:**

| Parámetro | Tipo          | Descripción     |
| --------- | ------------- | --------------- |
| `id`      | string (UUID) | ID del trayecto |

**Respuesta 200:**

```json
{
  "status": "Success",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "origen": "Madrid",
    "destino": "Toledo",
    "hora": "2026-07-15T10:00:00.000Z",
    "plazas": 4,
    "disponible": 3,
    "precio": 15,
    "conductor": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "conductor_nombre": "Juan Pérez",
    "conductor_email": "juan@example.com",
    "status": "finalizado",
    "Reservas": [ ... ],
    "Tramos": [ ... ],
    "eventos": [
      {
        "id": "e0f1a2b3-c4d5-7890-abcd-ef1234567890",
        "tipo": "comienzo",
        "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "id_reserva": null,
        "lat": 40.4168,
        "lng": -3.7038,
        "created_at": "2026-07-15T10:00:00.000Z"
      }
    ]
  }
}
```

**Errores:**

- `403` — El usuario no es admin.
- `404` — Trayecto no encontrado.
- `500` — Error en el servidor.

---

### Actualizar trayecto (admin)

```
PUT /api/admin/trayectos/:id
```

**Auth:** Requerida (solo admin)

**Descripción:** Actualiza los campos permitidos de un trayecto. A diferencia del PUT público, este endpoint permite modificar el `status` y el `conductor` directamente, sin las validaciones de precio del fluente normal.

**Path params:**

| Parámetro | Tipo          | Descripción     |
| --------- | ------------- | --------------- |
| `id`      | string (UUID) | ID del trayecto |

**Body (JSON):** Cualquier subconjunto de los campos permitidos:

```json
{
  "origen": "Madrid, Nueva dirección",
  "destino": "Toledo, Plaza Mayor",
  "hora": "2026-07-16T11:00:00.000Z",
  "plazas": 3,
  "disponible": 2,
  "precio": 20,
  "precio_conductor": 15,
  "conductor": "b2c3d4e5-f678-90ab-cdef-123456789012",
  "vehiculo_id": "v1e2d3c4-b5a6-7890-abcd-ef1234567890",
  "routeIndex": 1,
  "status": "programado",
  "origen_lat": 40.4168,
  "origen_lng": -3.7038,
  "destino_lat": 39.8628,
  "destino_lng": -4.0273,
  "evento_id": "f1e2d3c4-b5a6-7890-abcd-ef1234567890"
}
```

**Campos actualizables:**

`origen`, `destino`, `hora`, `plazas`, `disponible`, `precio`, `precio_conductor`, `conductor`, `vehiculo_id`, `routeIndex`, `status`, `origen_lat`, `origen_lng`, `destino_lat`, `destino_lng`, `evento_id`

**Respuesta 200:**

```json
{
  "status": "Success",
  "message": "Trayecto actualizado correctamente",
  "data": { ... }
}
```

**Errores:**

- `400` — No hay campos para actualizar.
- `403` — El usuario no es admin.
- `404` — Trayecto no encontrado.
- `500` — Error en el servidor.

---

### Eliminar trayecto (admin)

```
DELETE /api/admin/trayectos/:id
```

**Auth:** Requerida (solo admin)

**Descripción:** Elimina permanentemente un trayecto y todas sus dependencias (tramos, recorridos, eventos, comentarios, informes CAE, pagos y reservas) en una transacción atómica.

**Path params:**

| Parámetro | Tipo          | Descripción     |
| --------- | ------------- | --------------- |
| `id`      | string (UUID) | ID del trayecto |

**Respuesta 200:**

```json
{
  "status": "Success",
  "message": "Trayecto eliminado correctamente"
}
```

**Errores:**

- `403` — El usuario no es admin.
- `404` — Trayecto no encontrado.
- `500` — Error en el servidor.
