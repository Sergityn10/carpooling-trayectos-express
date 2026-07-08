# Viajes (Trayectos y Opiniones)

Gestión de trayectos/viajes del sistema de carpooling y opiniones/comentarios asociados.

---

## Trayectos

### 1. Obtener todos los trayectos

```
GET /api/trayecto
```

**Autenticación:** Requerida (`authenticate`)

**Descripción:** Devuelve todos los trayectos con estado distinto a `cancelado`, incluyendo las preferencias del conductor.

**Parámetros:** Ninguno

**Respuesta 200:**

```json
{
  "status": "Success",
  "trayectos": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "origen": "Madrid",
      "destino": "Toledo",
      "hora": "2025-01-15T10:00:00.000Z",
      "plazas": 4,
      "conductor": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "disponible": 3,
      "precio": 15,
      "origen_lat": 40.4168,
      "origen_lng": -3.7038,
      "destino_lat": 39.8628,
      "destino_lng": -4.0273,
      "routeIndex": null,
      "status": "pendiente",
      "driverPreferences": {
        "music": true,
        "smoking": false
      }
    }
  ]
}
```

---

### 2. Buscar trayectos

```
GET /api/trayecto/search
```

**Autenticación:** Opcional (`tryAuthenticate`)

**Descripción:** Busca trayectos por origen, destino, fecha y número de pasajeros. Geocodifica las direcciones de origen y destino del usuario y busca trayectos cuyas coordenadas estén dentro de un radio de 200 metros. Devuelve resultados paginados.

**Query params:**

| Parámetro     | Tipo   | Requerido | Descripción                                    |
| ------------- | ------ | --------- | ---------------------------------------------- |
| `origin`      | string | Sí        | Dirección de origen                            |
| `destination` | string | Sí        | Dirección de destino                           |
| `date`        | string | Sí        | Fecha en formato `YYYY-MM-DD`                  |
| `passengers`  | int    | Sí        | Número de pasajeros (>= 1)                     |
| `page`        | int    | No        | Página (por defecto 1)                         |
| `limit`       | int    | No        | Elementos por página (por defecto 10, máx 100) |

**Respuesta 200:**

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "origen": "Madrid, Centro",
      "destino": "Toledo, Casco",
      "hora": "2025-01-15T10:00:00.000Z",
      "plazas": 4,
      "conductor": "Juan Pérez",
      "conductor_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "img_perfil": "https://...",
      "disponible": 3,
      "precio": 15,
      "origen_lat": 40.4168,
      "origen_lng": -3.7038,
      "destino_lat": 39.8628,
      "destino_lng": -4.0273,
      "valorado": false
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false,
    "nextPage": 2,
    "prevPage": null
  }
}
```

**Errores:**

- `400` — Faltan parámetros requeridos o formato inválido.
- `500` — Error en el servidor.

---

### 3. Obtener mis trayectos (como conductor)

```
GET /api/trayecto/mis-trayectos
```

**Autenticación:** Requerida (`authenticate`)

**Descripción:** Devuelve los trayectos en los que el usuario autenticado es el conductor.

**Respuesta 200:**

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "origen": "Madrid",
    "destino": "Toledo",
    "hora": "2025-01-15T10:00:00.000Z",
    "plazas": 4,
    "conductor": "Juan Pérez",
    "conductor_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "img_perfil": "https://...",
    "disponible": 3,
    "precio": 15,
    "valorado": false
  }
]
```

---

### 4. Obtener próximos trayectos (conductor o pasajero)

```
GET /api/trayecto/proximos
```

**Autenticación:** Requerida (`authenticate`)

**Descripción:** Devuelve los trayectos próximos del usuario autenticado (como conductor o pasajero) cuya hora está entre el momento de la petición y las próximas 48 horas. Excluye trayectos finalizados o cancelados. Ordenados por hora ascendente.

**Respuesta 200:**

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "origen": "Madrid",
    "destino": "Toledo",
    "hora": "2025-01-15T10:00:00.000Z",
    "plazas": 4,
    "conductor": "Juan Pérez",
    "conductor_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "img_perfil": "https://...",
    "disponible": 3,
    "precio": 15,
    "valorado": false
  }
]
```

---

### 5. Obtener trayecto por ID

```
GET /api/trayecto/:id
```

**Autenticación:** Opcional (`tryAuthenticate`)

**Descripción:** Devuelve la información detallada de un trayecto, incluyendo nombre e imagen del conductor, preferencias del conductor y si el usuario autenticado ya ha valorado el trayecto.

**Path params:**

| Parámetro | Tipo          | Descripción     |
| --------- | ------------- | --------------- |
| `id`      | string (UUID) | ID del trayecto |

**Respuesta 200:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "origen": "Madrid",
  "destino": "Toledo",
  "hora": "2025-01-15T10:00:00.000Z",
  "plazas": 4,
  "conductor": "Juan Pérez",
  "conductor_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "img_perfil": "https://...",
  "disponible": 3,
  "precio": 15,
  "fecha": "Wed Jan 15 2025",
  "valorado": false,
  "driverPreferences": {
    "music": true,
    "smoking": false
  }
}
```

**Errores:**

- `404` — Trayecto no encontrado.

---

### 6. Crear trayecto

```
POST /api/trayecto
```

**Autenticación:** Requerida (`authenticate`)

**Descripción:** Crea un nuevo trayecto. Geocodifica origen y destino con Google Maps, calcula automáticamente el precio según el precio medio del gasoil de la provincia, e crea un chat asociado al trayecto en el microservicio de mensajes.

**Body (JSON):**

```json
{
  "origen": "Madrid, Calle Gran Vía 1",
  "destino": "Toledo, Plaza Mayor",
  "fecha": "2025-01-15",
  "hora": "10:00",
  "plazas": 4,
  "conductor": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "disponible": 4,
  "precio": 0,
  "routeIndex": 0,
  "evento_id": "f1e2d3c4-b5a6-7890-abcd-ef1234567890"
}
```

| Campo        | Tipo          | Requerido | Validación                                                 |
| ------------ | ------------- | --------- | ---------------------------------------------------------- |
| `origen`     | string        | Sí        | min 2, max 100                                             |
| `destino`    | string        | Sí        | min 2, max 100                                             |
| `fecha`      | string        | Sí        | Formato `YYYY-MM-DD`                                       |
| `hora`       | string        | Sí        | Formato `HH:MM` (24h)                                      |
| `plazas`     | number        | Sí        | 1–7                                                        |
| `conductor`  | string (UUID) | Sí        | UUID del conductor (si no se envía, usa `req.user.userId`) |
| `disponible` | number        | No        | 0–7 (por defecto = `plazas`)                               |
| `precio`     | number        | Sí        | >= 0 (se sobrescribe con cálculo automático)               |
| `routeIndex` | number        | No        | Int                                                        |
| `evento_id`  | string (UUID) | No        | UUID del evento asociado (para búsqueda rápida por evento) |

**Respuesta 201:**

```json
{
  "status": "Success",
  "message": "Trayecto creado correctamente",
  "trayecto": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "origen": "Madrid, Calle Gran Vía 1",
    "destino": "Toledo, Plaza Mayor",
    "fecha": "2025-01-15",
    "hora": "10:00",
    "plazas": 4,
    "conductor": "Juan Pérez",
    "conductor_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "precio": 15
  }
}
```

**Errores:**

- `400` — Fecha inválida, conductor no existe, o ya existe un trayecto con la misma fecha y hora.
- `404` — No se pudo determinar la provincia para calcular el precio.
- `502` — No se pudo calcular el precio del gasoil o error al crear el chat.

---

### 7. Actualizar coordenadas de un trayecto por ID

```
PUT /api/trayecto/update/id/:id
```

**Autenticación:** No requerida

**Descripción:** Recalcula las coordenadas (lat/lng) de origen y destino del trayecto usando Google Maps Geocoding.

**Path params:**

| Parámetro | Tipo          | Descripción     |
| --------- | ------------- | --------------- |
| `id`      | string (UUID) | ID del trayecto |

**Respuesta 204:** Sin contenido.

---

### 8. Actualizar coordenadas de todos los trayectos

```
PUT /api/trayecto/update
```

**Autenticación:** No requerida

**Descripción:** Recalcula las coordenadas (lat/lng) de origen y destino de todos los trayectos usando Google Maps Geocoding.

**Respuesta 204:** Sin contenido.

---

### 9. Actualizar trayecto (PUT)

```
PUT /api/trayecto/:id
```

**Autenticación:** No requerida (no tiene middleware de autenticación)

**Descripción:** Actualiza parcialmente un trayecto. Si se envían `fecha` y `hora` juntos, se combinan en UTC. No se puede enviar solo uno de los dos.

**Path params:**

| Parámetro | Tipo          | Descripción     |
| --------- | ------------- | --------------- |
| `id`      | string (UUID) | ID del trayecto |

**Body (JSON):** Cualquier subconjunto de los campos del trayecto:

```json
{
  "origen": "Madrid, Nueva dirección",
  "plazas": 3,
  "precio": 20
}
```

| Campo        | Tipo          | Validación                        |
| ------------ | ------------- | --------------------------------- |
| `origen`     | string        | min 2, max 100                    |
| `destino`    | string        | min 2, max 100                    |
| `fecha`      | string        | `YYYY-MM-DD` (debe ir con `hora`) |
| `hora`       | string        | `HH:MM` (debe ir con `fecha`)     |
| `plazas`     | number        | 1–7                               |
| `conductor`  | string (UUID) | UUID del conductor                |
| `disponible` | number        | 0–7                               |
| `precio`     | number        | >= 0                              |
| `routeIndex` | number        | Int                               |

**Respuesta 204:** Sin contenido.

**Errores:**

- `400` — Validación fallida o se envió solo `fecha` o `hora`.
- `404` — Trayecto no encontrado.

---

### 10. Actualizar trayecto (PATCH)

```
PATCH /api/trayecto/:id
```

**Autenticación:** No requerida (no tiene middleware de autenticación)

**Descripción:** Reemplaza los campos del trayecto. A diferencia del PUT, requiere todos los campos del esquema (excepto `id`, `disponible` y `routeIndex` que son opcionales). Si el origen o destino cambian, se recalculan sus coordenadas. Ajusta automáticamente `disponible` si cambian las plazas.

**Path params:**

| Parámetro | Tipo          | Descripción     |
| --------- | ------------- | --------------- |
| `id`      | string (UUID) | ID del trayecto |

**Body (JSON):**

```json
{
  "origen": "Madrid, Calle Nueva",
  "destino": "Toledo, Plaza Mayor",
  "fecha": "2025-01-16",
  "hora": "11:00",
  "plazas": 5,
  "conductor": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "precio": 18,
  "routeIndex": 1
}
```

**Respuesta 204:**

```json
{
  "status": "Success",
  "message": "Trayecto actualizado correctamente"
}
```

**Errores:**

- `400` — Validación fallida.
- `404` — Trayecto no encontrado.

---

### 11. Iniciar trayecto

```
POST /api/trayecto/:id/iniciar
```

**Autenticación:** Requerida (`authenticate`)

**Descripción:** Marca un trayecto con estado `programado` como `en curso`. Solo el conductor del trayecto puede iniciarlo. Envía un email a los pasajeros y al conductor notificando que el trayecto ha comenzado.

**Path params:**

| Parámetro | Tipo          | Descripción     |
| --------- | ------------- | --------------- |
| `id`      | string (UUID) | ID del trayecto |

**Respuesta 200:**

```json
{
  "status": "Success",
  "message": "Trayecto iniciado y notificado correctamente"
}
```

**Errores:**

- `400` — ID inválido.
- `401` — No autenticado o no eres el conductor.
- `404` — Trayecto no encontrado.
- `409` — El trayecto no está programado.

---

### 12. Guardar ubicación del recorrido

```
POST /api/trayecto/:id/recorrido
```

**Autenticación:** Requerida (`authenticate`)

**Descripción:** Registra un punto de ubicación (latitud, longitud y dirección) del usuario autenticado durante un trayecto en curso. El usuario debe ser el conductor o un pasajero con reserva activa. Permite trackear el recorrido en tiempo real.

**Path params:**

| Parámetro | Tipo          | Descripción     |
| --------- | ------------- | --------------- |
| `id`      | string (UUID) | ID del trayecto |

**Body (JSON):**

```json
{
  "lat": 40.4168,
  "lng": -3.7038,
  "address": "Calle Gran Vía 1, Madrid"
}
```

| Campo     | Tipo   | Requerido | Validación        |
| --------- | ------ | --------- | ----------------- |
| `lat`     | number | Sí        | -90 a 90          |
| `lng`     | number | Sí        | -180 a 180        |
| `address` | string | Sí        | Dirección legible |

**Respuesta 201:**

```json
{
  "status": "Success",
  "message": "Ubicación guardada correctamente",
  "recorrido": {
    "id": "d4e5f6a7-b890-1234-cdef-567890abcdef",
    "id_trayecto": "550e8400-e29b-41d4-a716-446655440000",
    "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "lat": 40.4168,
    "lng": -3.7038,
    "address": "Calle Gran Vía 1, Madrid"
  }
}
```

**Errores:**

- `400` — ID inválido, o `lat`/`lng`/`address` faltantes o inválidos.
- `401` — No autenticado.
- `403` — No formas parte de este trayecto.
- `404` — Trayecto no encontrado.
- `409` — El trayecto no está en curso.

---

### 13. Obtener recorrido del trayecto

```
GET /api/trayecto/:id/recorrido
```

**Autenticación:** Requerida (`authenticate`)

**Descripción:** Devuelve todos los puntos de ubicación registrados durante un trayecto, ordenados cronológicamente. El usuario debe ser el conductor o un pasajero con reserva activa.

**Path params:**

| Parámetro | Tipo          | Descripción     |
| --------- | ------------- | --------------- |
| `id`      | string (UUID) | ID del trayecto |

**Respuesta 200:**

```json
{
  "status": "Success",
  "recorridos": [
    {
      "id": "d4e5f6a7-b890-1234-cdef-567890abcdef",
      "id_trayecto": "550e8400-e29b-41d4-a716-446655440000",
      "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "lat": 40.4168,
      "lng": -3.7038,
      "address": "Calle Gran Vía 1, Madrid",
      "created_at": "2025-01-15T10:05:00.000Z"
    },
    {
      "id": "e5f6a7b8-9012-3456-cdef-7890abcdef12",
      "id_trayecto": "550e8400-e29b-41d4-a716-446655440000",
      "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "lat": 40.4200,
      "lng": -3.7100,
      "address": "Plaza de España, Madrid",
      "created_at": "2025-01-15T10:10:00.000Z"
    }
  ]
}
```

**Errores:**

- `400` — ID inválido.
- `401` — No autenticado.
- `403` — No formas parte de este trayecto.
- `404` — Trayecto no encontrado.

---

### 14. Finalizar trayecto

```
POST /api/trayecto/:id/finalizar
```

**Autenticación:** Requerida (`authenticate`)

**Descripción:** Marca un trayecto con estado `en curso` como `finalizado`. Solo el conductor del trayecto puede finalizarlo. Notifica a los pasajeros.

**Path params:**

| Parámetro | Tipo          | Descripción     |
| --------- | ------------- | --------------- |
| `id`      | string (UUID) | ID del trayecto |

**Respuesta 200:**

```json
{
  "status": "Success",
  "message": "Trayecto finalizado y notificado correctamente"
}
```

**Errores:**

- `400` — ID inválido.
- `401` — No autenticado o no eres el conductor.
- `404` — Trayecto no encontrado.
- `409` — El trayecto no está en curso.

---

### 15. Obtener trayectos por conductor

```
GET /api/trayecto/conductor/:id
```

**Autenticación:** Opcional (`tryAuthenticate`)

**Descripción:** Devuelve todos los trayectos de un conductor específico, incluyendo nombre, imagen y si el usuario autenticado ha valorado cada trayecto.

**Path params:**

| Parámetro | Tipo          | Descripción      |
| --------- | ------------- | ---------------- |
| `id`      | string (UUID) | ID del conductor |

**Respuesta 200:**

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "origen": "Madrid",
    "destino": "Toledo",
    "hora": "2025-01-15T10:00:00.000Z",
    "plazas": 4,
    "conductor": "Juan Pérez",
    "conductor_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "img_perfil": "https://...",
    "valorado": false
  }
]
```

---

### 16. Eliminar trayecto

```
DELETE /api/trayecto/:id
```

**Autenticación:** No requerida (no tiene middleware de autenticación)

**Descripción:** Elimina permanentemente un trayecto de la base de datos.

**Path params:**

| Parámetro | Tipo          | Descripción     |
| --------- | ------------- | --------------- |
| `id`      | string (UUID) | ID del trayecto |

**Respuesta 204:** Sin contenido.

**Errores:**

- `404` — Trayecto no encontrado.

---

### 17. Crear trayecto hacia un evento

```
POST /api/trayecto/evento
```

**Autenticación:** Requerida (`authenticate`)

**Descripción:** Crea un nuevo trayecto cuyo destino es la ubicación de un evento. Realiza una petición al microservicio de usuarios (`GET /api/eventos/:evento_id`) para obtener la ubicación del evento y la usa como `destino` del trayecto. El resto del proceso es idéntico al de crear un trayecto normal: geocodificación con Google Maps, cálculo automático del precio según la provincia y creación del chat asociado.

**Body (JSON):**

```json
{
  "evento_id": "f1e2d3c4-b5a6-7890-abcd-ef1234567890",
  "origen": "Madrid, Calle Gran Vía 1",
  "fecha": "2025-01-15",
  "hora": "10:00",
  "plazas": 4,
  "conductor": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "disponible": 4,
  "precio": 0,
  "routeIndex": 0
}
```

| Campo        | Tipo          | Requerido | Validación                                                 |
| ------------ | ------------- | --------- | ---------------------------------------------------------- |
| `evento_id`  | string (UUID) | Sí        | UUID del evento hacia el que se dirige el trayecto         |
| `origen`     | string        | Sí        | min 2, max 100                                             |
| `fecha`      | string        | Sí        | Formato `YYYY-MM-DD`                                       |
| `hora`       | string        | Sí        | Formato `HH:MM` (24h)                                      |
| `plazas`     | number        | Sí        | 1–7                                                        |
| `conductor`  | string (UUID) | Sí        | UUID del conductor (si no se envía, usa `req.user.userId`) |
| `disponible` | number        | No        | 0–7 (por defecto = `plazas`)                               |
| `precio`     | number        | Sí        | >= 0 (se sobrescribe con cálculo automático)               |
| `routeIndex` | number        | No        | Int                                                        |

> **Nota:** No es necesario enviar `destino`; se obtiene automáticamente desde la información del evento en el microservicio de usuarios. El campo `evento_id` se almacena en el trayecto para permitir búsquedas rápidas.

**Respuesta 201:**

```json
{
  "status": "Success",
  "message": "Trayecto creado correctamente",
  "trayecto": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "origen": "Madrid, Calle Gran Vía 1",
    "destino": "Ubicación del evento",
    "fecha": "2025-01-15",
    "hora": "10:00",
    "plazas": 4,
    "conductor": "Juan Pérez",
    "conductor_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "precio": 15
  }
}
```

**Errores:**

- `400` — `evento_id` faltante, fecha inválida, conductor no existe, o el evento no tiene una ubicación válida.
- `404` — No se pudo obtener la información del evento desde el microservicio de usuarios.
- `502` — No se pudo calcular el precio del gasoil o error al crear el chat.

---

### 18. Obtener trayectos por evento

```
GET /api/trayecto/evento/:eventoId
```

**Autenticación:** Opcional (`tryAuthenticate`)

**Descripción:** Devuelve todos los trayectos asociados a un evento específico (mediante el campo `evento_id`), excluyendo los cancelados. Ordenados por hora ascendente. Incluye nombre e imagen del conductor obtenidos del microservicio de usuarios, y si el usuario autenticado ha valorado cada trayecto.

**Path params:**

| Parámetro  | Tipo          | Descripción   |
| ---------- | ------------- | ------------- |
| `eventoId` | string (UUID) | ID del evento |

**Respuesta 200:**

```json
{
  "status": "Success",
  "evento_id": "f1e2d3c4-b5a6-7890-abcd-ef1234567890",
  "trayectos": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "origen": "Madrid",
      "destino": "Ubicación del evento",
      "hora": "2025-01-15T10:00:00.000Z",
      "plazas": 4,
      "conductor": "Juan Pérez",
      "conductor_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "img_perfil": "https://...",
      "disponible": 3,
      "precio": 15,
      "evento_id": "f1e2d3c4-b5a6-7890-abcd-ef1234567890",
      "valorado": false
    }
  ]
}
```

**Errores:**

- `400` — `eventoId` faltante.
- `500` — Error en el servidor.

---

## Estado de un trayecto (perspectiva del pasajero)

### Obtener estado del trayecto del pasajero

```
GET /api/trayecto/:id/estado
```

**Autenticación:** Requerida (`authenticate`)

**Descripción:** Devuelve el estado completo de un trayecto desde la perspectiva del pasajero autenticado. Incluye el estado general del trayecto, el estado de la reserva del pasajero, y si el pasajero ha sido recogido y/o ha llegado a destino. **Requiere que el usuario tenga una reserva activa (no cancelada)** en el trayecto.

**Path params:**

| Parámetro | Tipo          | Descripción     |
| --------- | ------------- | --------------- |
| `id`      | string (UUID) | ID del trayecto |

**Respuesta 200:**

```json
{
  "status": "Success",
  "trayecto": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "origen": "Madrid",
    "destino": "Toledo",
    "hora": "2025-01-15T10:00:00.000Z",
    "status": "en curso",
    "fase": "en_curso",
    "conductor": "Juan Pérez",
    "conductor_id": "b2c3d4e5-f678-90ab-cdef-123456789012",
    "img_perfil": "https://..."
  },
  "reserva": {
    "id_reserva": "r1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "status": "completed",
    "trip_outcome": "pending"
  },
  "pasajero": {
    "recogido": true,
    "en_destino": false,
    "fase": "en_ruta",
    "evento_recogida": {
      "id": "e1f2a3b4-c5d6-7890-abcd-ef1234567890",
      "lat": 40.4168,
      "lng": -3.7038,
      "created_at": "2025-01-15T10:05:00.000Z"
    },
    "evento_llegada": null
  },
  "eventos_trayecto": {
    "iniciado": true,
    "finalizado": false,
    "hay_recogidas": true,
    "hay_llegadas": false
  },
  "eventos": [
    {
      "id": "e0f1a2b3-c4d5-7890-abcd-ef1234567890",
      "id_trayecto": "550e8400-e29b-41d4-a716-446655440000",
      "id_reserva": null,
      "user_id": "b2c3d4e5-f678-90ab-cdef-123456789012",
      "tipo_evento": { "id": 2, "nombre": "comienzo" },
      "lat": 40.4168,
      "lng": -3.7038,
      "created_at": "2025-01-15T10:00:00.000Z"
    },
    {
      "id": "e1f2a3b4-c5d6-7890-abcd-ef1234567890",
      "id_trayecto": "550e8400-e29b-41d4-a716-446655440000",
      "id_reserva": "r1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "tipo_evento": { "id": 4, "nombre": "recogida" },
      "lat": 40.4168,
      "lng": -3.7038,
      "created_at": "2025-01-15T10:05:00.000Z"
    }
  ]
}
```

**Campos de la respuesta:**

| Campo                         | Descripción                                                                  |
| ----------------------------- | ---------------------------------------------------------------------------- |
| `trayecto.fase`               | Fase del trayecto: `pendiente`, `en_curso`, `finalizado`, `cancelado`        |
| `pasajero.recogido`           | `true` si existe un evento de `recogida` para la reserva del pasajero        |
| `pasajero.en_destino`         | `true` si existe un evento de `llegada_destino` para la reserva del pasajero |
| `pasajero.fase`               | Fase del pasajero: `esperando_recogida`, `en_ruta`, `en_destino`             |
| `pasajero.evento_recogida`    | Datos del evento de recogida (lat, lng, created_at) o `null`                 |
| `pasajero.evento_llegada`     | Datos del evento de llegada (lat, lng, created_at) o `null`                  |
| `eventos_trayecto.iniciado`   | `true` si existe un evento de `comienzo` en el trayecto                      |
| `eventos_trayecto.finalizado` | `true` si existe un evento de `finalizacion` en el trayecto                  |
| `eventos`                     | Lista completa de eventos del trayecto ordenados cronológicamente            |

**Errores:**

- `400` — ID de trayecto inválido.
- `401` — No autenticado.
- `403` — No tienes una reserva activa en este trayecto.
- `404` — Trayecto no encontrado.

---

## Eventos de trayecto (Recogidas)

Gestión de eventos del ciclo de vida de un trayecto: solicitud, comienzo, finalización, recogida, reserva_creada, reserva_cancelada y llegada_destino.

### 1. Crear evento de trayecto

```
POST /api/trayecto/:id/recoger
```

**Autenticación:** Requerida (`authenticate`)

**Descripción:** Registra un evento de trayecto (recogida, comienzo, finalización, solicitud, etc.). El trayecto debe estar en estado `en curso`. Si el usuario no es el conductor, debe tener una reserva activa. Para eventos de tipo `recogida`, el `id_reserva` es obligatorio.

**Path params:**

| Parámetro | Tipo          | Descripción     |
| --------- | ------------- | --------------- |
| `id`      | string (UUID) | ID del trayecto |

**Body (JSON):**

```json
{
  "lat": 40.4168,
  "lng": -3.7038,
  "tipo_evento": "recogida",
  "id_reserva": "r1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

| Campo         | Tipo          | Requerido   | Validación                                                                   |
| ------------- | ------------- | ----------- | ---------------------------------------------------------------------------- |
| `lat`         | number        | Sí          | Entre -90 y 90                                                               |
| `lng`         | number        | Sí          | Entre -180 y 180                                                             |
| `tipo_evento` | string        | Sí          | Enum: `solicitud`, `comienzo`, `finalizacion`, `recogida`, `llegada_destino` |
| `id_reserva`  | string (UUID) | Condicional | Requerido si `tipo_evento` es `recogida`                                     |

**Respuesta 201:**

```json
{
  "status": "Success",
  "message": "Evento de trayecto guardado correctamente",
  "evento": {
    "id": "e1f2a3b4-c5d6-7890-abcd-ef1234567890",
    "id_trayecto": "550e8400-e29b-41d4-a716-446655440000",
    "id_reserva": "r1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "id_tipo_evento": 4,
    "tipo_evento": { "id": 4, "nombre": "recogida" },
    "lat": 40.4168,
    "lng": -3.7038,
    "created_at": "2025-01-15T10:05:00.000Z"
  }
}
```

**Errores:**

- `400` — ID inválido, validación fallida, o `id_reserva` faltante para evento `recogida`.
- `401` — No autenticado.
- `403` — No formas parte de este trayecto.
- `404` — Trayecto o tipo de evento no encontrado.
- `409` — El trayecto no está en curso.

---

### 2. Obtener eventos de un trayecto

```
GET /api/trayecto/:id/recoger
```

**Autenticación:** Requerida (`authenticate`)

**Descripción:** Devuelve todos los eventos de un trayecto ordenados cronológicamente. El conductor o cualquier pasajero con reserva activa pueden consultar. Los administradores tienen acceso sin restricciones.

**Path params:**

| Parámetro | Tipo          | Descripción     |
| --------- | ------------- | --------------- |
| `id`      | string (UUID) | ID del trayecto |

**Respuesta 200:**

```json
{
  "status": "Success",
  "eventos": [
    {
      "id": "e1f2a3b4-c5d6-7890-abcd-ef1234567890",
      "id_trayecto": "550e8400-e29b-41d4-a716-446655440000",
      "id_reserva": "r1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "id_tipo_evento": 4,
      "tipo_evento": { "id": 4, "nombre": "recogida" },
      "lat": 40.4168,
      "lng": -3.7038,
      "created_at": "2025-01-15T10:05:00.000Z"
    }
  ]
}
```

**Errores:**

- `400` — ID inválido.
- `401` — No autenticado.
- `403` — No formas parte de este trayecto.
- `404` — Trayecto no encontrado.

---

### 3. Obtener eventos de un usuario en un trayecto

```
GET /api/trayecto/:id/recoger/:idUser
```

**Autenticación:** Requerida (`authenticate`)

**Descripción:** Devuelve los eventos de un usuario específico dentro de un trayecto. El conductor puede ver los eventos de cualquier pasajero. Un pasajero solo puede ver sus propios eventos.

**Path params:**

| Parámetro | Tipo          | Descripción     |
| --------- | ------------- | --------------- |
| `id`      | string (UUID) | ID del trayecto |
| `idUser`  | string (UUID) | ID del usuario  |

**Respuesta 200:**

```json
{
  "status": "Success",
  "eventos": [ ... ]
}
```

**Errores:**

- `400` — ID de trayecto o usuario inválido.
- `401` — No autenticado o sin permiso.
- `404` — Trayecto no encontrado.

---

### 4. Eliminar eventos de un usuario en un trayecto

```
DELETE /api/trayecto/:id/recoger/:idUser
```

**Autenticación:** Requerida (`authenticate`)

**Descripción:** Elimina todos los eventos de un usuario específico dentro de un trayecto. Solo el conductor del trayecto puede eliminar eventos de pasajeros.

**Path params:**

| Parámetro | Tipo          | Descripción     |
| --------- | ------------- | --------------- |
| `id`      | string (UUID) | ID del trayecto |
| `idUser`  | string (UUID) | ID del usuario  |

**Respuesta 204:** Sin contenido.

**Errores:**

- `400` — ID inválido.
- `401` — No tienes permiso para eliminar estos eventos.
- `404` — No se encontraron eventos para eliminar.

---

### 5. Registrar llegada a destino

```
POST /api/trayecto/:id/llegada
```

**Autenticación:** Requerida (`authenticate`)

**Descripción:** Registra que un pasajero ha llegado a su destino. Solo los pasajeros (no el conductor) pueden usar este endpoint. **Debe existir un evento de `recogida` previo** para la reserva del pasajero; de lo contrario se devuelve error 409. No se puede registrar la llegada dos veces para la misma reserva.

**Path params:**

| Parámetro | Tipo          | Descripción     |
| --------- | ------------- | --------------- |
| `id`      | string (UUID) | ID del trayecto |

**Body (JSON):**

```json
{
  "lat": 39.8628,
  "lng": -4.0273
}
```

| Campo | Tipo   | Requerido | Descripción                         |
| ----- | ------ | --------- | ----------------------------------- |
| `lat` | number | Sí        | Latitud de la ubicación de llegada  |
| `lng` | number | Sí        | Longitud de la ubicación de llegada |

**Respuesta 201:**

```json
{
  "status": "Success",
  "message": "Llegada a destino registrada correctamente",
  "evento": {
    "id": "e2f3a4b5-c6d7-7890-abcd-ef1234567890",
    "id_trayecto": "550e8400-e29b-41d4-a716-446655440000",
    "id_reserva": "r1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "tipo_evento": { "id": 7, "nombre": "llegada_destino" },
    "lat": 39.8628,
    "lng": -4.0273,
    "created_at": "2025-01-15T11:30:00.000Z"
  }
}
```

**Errores:**

- `400` — ID inválido, o `lat`/`lng` ausentes.
- `401` — No autenticado.
- `403` — El conductor no puede registrar llegada a destino, o no tienes reserva activa.
- `404` — Trayecto no encontrado.
- `409` — El pasajero no ha sido recogido previamente, o ya se registró la llegada.

---

## Comentarios / Opiniones

### 1. Crear opinión

```
POST /api/comments
```

**Autenticación:** Requerida (`authenticate`)

**Descripción:** Crea una opinión/comentario sobre un trayecto. El usuario debe ser pasajero con reserva completada o el conductor del trayecto. El conductor puede opinar sobre un pasajero; el pasajero opina sobre el conductor.

**Body (JSON):**

```json
{
  "user_id_commentator": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "user_id_trayect": "b2c3d4e5-f678-90ab-cdef-123456789012",
  "trayecto_id": "550e8400-e29b-41d4-a716-446655440000",
  "opinion": "Excelente viaje, muy puntual",
  "rating": 9
}
```

| Campo                 | Tipo          | Requerido | Validación                 |
| --------------------- | ------------- | --------- | -------------------------- |
| `user_id_commentator` | string (UUID) | Sí        | UUID del usuario que opina |
| `user_id_trayect`     | string (UUID) | Sí        | UUID del usuario valorado  |
| `trayecto_id`         | string (UUID) | Sí        | UUID del trayecto          |
| `opinion`             | string        | Sí        | min 1, max 1024            |
| `rating`              | number        | Sí        | Int 1–10                   |

**Respuesta 201:**

```json
{
  "status": "Success",
  "message": "Opinión creada correctamente",
  "opinion": {
    "id_comment": "c3d4e5f6-7890-abcd-ef12-345678901234",
    "user_id_commentator": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "user_id_trayect": "b2c3d4e5-f678-90ab-cdef-123456789012",
    "id_trayecto": "550e8400-e29b-41d4-a716-446655440000",
    "opinion": "Excelente viaje, muy puntual",
    "rating": 9
  }
}
```

**Errores:**

- `400` — Validación fallida, usuario o trayecto no existen, opinión duplicada.
- `401` — No tienes permiso para crear opinión en nombre de otro usuario.
- `403` — Debes haber realizado una reserva (pagada) del trayecto.
- `404` — Trayecto no encontrado.

---

### 2. Obtener opiniones por usuario comentarista

```
GET /api/comments/user_id_commentator/:userId
```

**Autenticación:** No requerida

**Descripción:** Devuelve todas las opiniones que ha escrito un usuario específico.

**Path params:**

| Parámetro | Tipo          | Descripción                 |
| --------- | ------------- | --------------------------- |
| `userId`  | string (UUID) | ID del usuario comentarista |

**Respuesta 200:**

```json
{
  "status": "Success",
  "opinionList": [
    {
      "id_comment": "c3d4e5f6-7890-abcd-ef12-345678901234",
      "user_id_commentator": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "user_id_trayect": "b2c3d4e5-f678-90ab-cdef-123456789012",
      "id_trayecto": "550e8400-e29b-41d4-a716-446655440000",
      "opinion": "Excelente viaje",
      "rating": 9
    }
  ]
}
```

**Errores:**

- `404` — El usuario no existe.

---

### 3. Obtener opiniones por usuario valorado

```
GET /api/comments/user_id_trayect/:userId
```

**Autenticación:** No requerida

**Descripción:** Devuelve todas las opiniones recibidas por un usuario específico (como usuario valorado).

**Path params:**

| Parámetro | Tipo          | Descripción             |
| --------- | ------------- | ----------------------- |
| `userId`  | string (UUID) | ID del usuario valorado |

**Respuesta 200:**

```json
{
  "status": "Success",
  "opinionList": [
    {
      "id_comment": "c3d4e5f6-7890-abcd-ef12-345678901234",
      "user_id_commentator": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "user_id_trayect": "b2c3d4e5-f678-90ab-cdef-123456789012",
      "id_trayecto": "550e8400-e29b-41d4-a716-446655440000",
      "opinion": "Excelente viaje",
      "rating": 9
    }
  ]
}
```

---

### 4. Obtener opiniones por trayecto

```
GET /api/comments/travelId/:travelId
```

**Autenticación:** No requerida

**Descripción:** Devuelve todas las opiniones asociadas a un trayecto específico.

**Path params:**

| Parámetro  | Tipo          | Descripción     |
| ---------- | ------------- | --------------- |
| `travelId` | string (UUID) | ID del trayecto |

**Respuesta 200:**

```json
{
  "status": "Success",
  "opinionsList": [
    {
      "id_comment": "c3d4e5f6-7890-abcd-ef12-345678901234",
      "user_id_commentator": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "user_id_trayect": "b2c3d4e5-f678-90ab-cdef-123456789012",
      "id_trayecto": "550e8400-e29b-41d4-a716-446655440000",
      "opinion": "Excelente viaje",
      "rating": 9
    }
  ]
}
```

**Errores:**

- `404` — No se han encontrado opiniones para este trayecto.

---

### 5. Actualizar opinión

```
PATCH /api/comments/:id
```

**Autenticación:** No requerida (no tiene middleware de autenticación)

**Descripción:** Actualiza el texto y la puntuación de una opinión existente.

**Path params:**

| Parámetro | Tipo          | Descripción                      |
| --------- | ------------- | -------------------------------- |
| `id`      | string (UUID) | ID del comentario (`id_comment`) |

**Body (JSON):**

```json
{
  "id_comment": "c3d4e5f6-7890-abcd-ef12-345678901234",
  "opinion": "Buen viaje, pero llegó tarde",
  "rating": 7
}
```

| Campo        | Tipo          | Requerido | Validación                                     |
| ------------ | ------------- | --------- | ---------------------------------------------- |
| `id_comment` | string (UUID) | Sí        | UUID del comentario (debe coincidir con `:id`) |
| `opinion`    | string        | Sí        | min 1, max 1024                                |
| `rating`     | number        | Sí        | Int 1–10                                       |

**Respuesta 200:**

```json
{
  "status": "Success",
  "message": "Opinión actualizada correctamente",
  "updatedOpinion": {
    "id_comment": "c3d4e5f6-7890-abcd-ef12-345678901234",
    "user_id_commentator": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "user_id_trayect": "b2c3d4e5-f678-90ab-cdef-123456789012",
    "id_trayecto": "550e8400-e29b-41d4-a716-446655440000",
    "opinion": "Buen viaje, pero llegó tarde",
    "rating": 7
  }
}
```

**Errores:**

- `400` — Validación fallida o el ID no coincide.
- `404` — Opinión no encontrada.

---

### 6. Eliminar opinión

```
DELETE /api/comments/:id
```

**Autenticación:** No requerida (no tiene middleware de autenticación)

**Descripción:** Elimina permanentemente una opinión.

**Path params:**

| Parámetro | Tipo          | Descripción                      |
| --------- | ------------- | -------------------------------- |
| `id`      | string (UUID) | ID del comentario (`id_comment`) |

**Respuesta 200:**

```json
{
  "status": "Success",
  "message": "Opinión eliminada correctamente"
}
```

**Errores:**

- `404` — Opinión no encontrada.
