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
      "id": 1,
      "origen": "Madrid",
      "destino": "Toledo",
      "hora": "2025-01-15 10:00:00",
      "plazas": 4,
      "conductor": 5,
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

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `origin` | string | Sí | Dirección de origen |
| `destination` | string | Sí | Dirección de destino |
| `date` | string | Sí | Fecha en formato `YYYY-MM-DD` |
| `passengers` | int | Sí | Número de pasajeros (>= 1) |
| `page` | int | No | Página (por defecto 1) |
| `limit` | int | No | Elementos por página (por defecto 10, máx 100) |

**Respuesta 200:**

```json
{
  "data": [
    {
      "id": 1,
      "origen": "Madrid, Centro",
      "destino": "Toledo, Casco",
      "hora": "2025-01-15 10:00:00",
      "plazas": 4,
      "conductor": "Juan Pérez",
      "conductor_id": 5,
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
    "id": 1,
    "origen": "Madrid",
    "destino": "Toledo",
    "hora": "2025-01-15 10:00:00",
    "plazas": 4,
    "conductor": "Juan Pérez",
    "conductor_id": 5,
    "img_perfil": "https://...",
    "disponible": 3,
    "precio": 15,
    "valorado": false
  }
]
```

---

### 4. Obtener trayecto por ID

```
GET /api/trayecto/:id
```

**Autenticación:** Opcional (`tryAuthenticate`)

**Descripción:** Devuelve la información detallada de un trayecto, incluyendo nombre e imagen del conductor, preferencias del conductor y si el usuario autenticado ya ha valorado el trayecto.

**Path params:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `id` | int | ID del trayecto |

**Respuesta 200:**

```json
{
  "id": 1,
  "origen": "Madrid",
  "destino": "Toledo",
  "hora": "2025-01-15T10:00:00.000Z",
  "plazas": 4,
  "conductor": "Juan Pérez",
  "conductor_id": 5,
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

### 5. Crear trayecto

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
  "conductor": 5,
  "disponible": 4,
  "precio": 0,
  "routeIndex": 0
}
```

| Campo | Tipo | Requerido | Validación |
|-------|------|-----------|------------|
| `origen` | string | Sí | min 2, max 100 |
| `destino` | string | Sí | min 2, max 100 |
| `fecha` | string | Sí | Formato `YYYY-MM-DD` |
| `hora` | string | Sí | Formato `HH:MM` (24h) |
| `plazas` | number | Sí | 1–7 |
| `conductor` | number | Sí | Int positivo (si no se envía, usa `req.user.id`) |
| `disponible` | number | No | 0–7 (por defecto = `plazas`) |
| `precio` | number | Sí | >= 0 (se sobrescribe con cálculo automático) |
| `routeIndex` | number | No | Int |

**Respuesta 201:**

```json
{
  "status": "Success",
  "message": "Trayecto creado correctamente",
  "trayecto": {
    "id": 10,
    "origen": "Madrid, Calle Gran Vía 1",
    "destino": "Toledo, Plaza Mayor",
    "fecha": "2025-01-15",
    "hora": "10:00",
    "plazas": 4,
    "conductor": "Juan Pérez",
    "conductor_id": 5,
    "precio": 15
  }
}
```

**Errores:**

- `400` — Fecha inválida, conductor no existe, o ya existe un trayecto con la misma fecha y hora.
- `404` — No se pudo determinar la provincia para calcular el precio.
- `502` — No se pudo calcular el precio del gasoil o error al crear el chat.

---

### 6. Actualizar coordenadas de un trayecto por ID

```
PUT /api/trayecto/update/id/:id
```

**Autenticación:** No requerida

**Descripción:** Recalcula las coordenadas (lat/lng) de origen y destino del trayecto usando Google Maps Geocoding.

**Path params:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `id` | int | ID del trayecto |

**Respuesta 204:** Sin contenido.

---

### 7. Actualizar coordenadas de todos los trayectos

```
PUT /api/trayecto/update
```

**Autenticación:** No requerida

**Descripción:** Recalcula las coordenadas (lat/lng) de origen y destino de todos los trayectos usando Google Maps Geocoding.

**Respuesta 204:** Sin contenido.

---

### 8. Actualizar trayecto (PUT)

```
PUT /api/trayecto/:id
```

**Autenticación:** No requerida (no tiene middleware de autenticación)

**Descripción:** Actualiza parcialmente un trayecto. Si se envían `fecha` y `hora` juntos, se combinan en UTC. No se puede enviar solo uno de los dos.

**Path params:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `id` | int | ID del trayecto |

**Body (JSON):** Cualquier subconjunto de los campos del trayecto:

```json
{
  "origen": "Madrid, Nueva dirección",
  "plazas": 3,
  "precio": 20
}
```

| Campo | Tipo | Validación |
|-------|------|------------|
| `origen` | string | min 2, max 100 |
| `destino` | string | min 2, max 100 |
| `fecha` | string | `YYYY-MM-DD` (debe ir con `hora`) |
| `hora` | string | `HH:MM` (debe ir con `fecha`) |
| `plazas` | number | 1–7 |
| `conductor` | number | Int positivo |
| `disponible` | number | 0–7 |
| `precio` | number | >= 0 |
| `routeIndex` | number | Int |

**Respuesta 204:** Sin contenido.

**Errores:**

- `400` — Validación fallida o se envió solo `fecha` o `hora`.
- `404` — Trayecto no encontrado.

---

### 9. Actualizar trayecto (PATCH)

```
PATCH /api/trayecto/:id
```

**Autenticación:** No requerida (no tiene middleware de autenticación)

**Descripción:** Reemplaza los campos del trayecto. A diferencia del PUT, requiere todos los campos del esquema (excepto `id`, `disponible` y `routeIndex` que son opcionales). Si el origen o destino cambian, se recalculan sus coordenadas. Ajusta automáticamente `disponible` si cambian las plazas.

**Path params:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `id` | int | ID del trayecto |

**Body (JSON):**

```json
{
  "origen": "Madrid, Calle Nueva",
  "destino": "Toledo, Plaza Mayor",
  "fecha": "2025-01-16",
  "hora": "11:00",
  "plazas": 5,
  "conductor": 5,
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

### 10. Finalizar trayecto

```
POST /api/trayecto/:id/finalizar
```

**Autenticación:** Requerida (`authenticate`)

**Descripción:** Marca un trayecto con estado `en curso` como `finalizado`. Solo el conductor del trayecto puede finalizarlo. Notifica a los pasajeros.

**Path params:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `id` | int | ID del trayecto |

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

### 11. Obtener trayectos por conductor

```
GET /api/trayecto/conductor/:id
```

**Autenticación:** Opcional (`tryAuthenticate`)

**Descripción:** Devuelve todos los trayectos de un conductor específico, incluyendo nombre, imagen y si el usuario autenticado ha valorado cada trayecto.

**Path params:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `id` | int | ID del conductor |

**Respuesta 200:**

```json
[
  {
    "id": 1,
    "origen": "Madrid",
    "destino": "Toledo",
    "hora": "2025-01-15 10:00:00",
    "plazas": 4,
    "conductor": "Juan Pérez",
    "conductor_id": 5,
    "img_perfil": "https://...",
    "valorado": false
  }
]
```

---

### 12. Eliminar trayecto

```
DELETE /api/trayecto/:id
```

**Autenticación:** No requerida (no tiene middleware de autenticación)

**Descripción:** Elimina permanentemente un trayecto de la base de datos.

**Path params:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `id` | int | ID del trayecto |

**Respuesta 204:** Sin contenido.

**Errores:**

- `404` — Trayecto no encontrado.

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
  "user_id_commentator": 5,
  "user_id_trayect": 8,
  "trayecto_id": 1,
  "opinion": "Excelente viaje, muy puntual",
  "rating": 9
}
```

| Campo | Tipo | Requerido | Validación |
|-------|------|-----------|------------|
| `user_id_commentator` | number | Sí | Int positivo |
| `user_id_trayect` | number | Sí | Int positivo |
| `trayecto_id` | number | Sí | Int positivo |
| `opinion` | string | Sí | min 1, max 1024 |
| `rating` | number | Sí | Int 1–10 |

**Respuesta 201:**

```json
{
  "status": "Success",
  "message": "Opinión creada correctamente",
  "opinion": {
    "id": 15,
    "user_id_commentator": 5,
    "user_id_trayect": 8,
    "trayecto_id": 1,
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

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `userId` | int | ID del usuario comentarista |

**Respuesta 200:**

```json
{
  "status": "Success",
  "opinionList": [
    {
      "id_comment": 15,
      "user_id_commentator": 5,
      "user_id_trayect": 8,
      "id_trayecto": 1,
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

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `userId` | int | ID del usuario valorado |

**Respuesta 200:**

```json
{
  "status": "Success",
  "opinionList": [
    {
      "id_comment": 15,
      "user_id_commentator": 5,
      "user_id_trayect": 8,
      "id_trayecto": 1,
      "opinion": "Excelente viaje",
      "rating": 9
    }
  ]
}
```

**Errores:**

- `404` — El usuario no existe.

---

### 4. Obtener opiniones por trayecto

```
GET /api/comments/travelId/:travelId
```

**Autenticación:** No requerida

**Descripción:** Devuelve todas las opiniones asociadas a un trayecto específico.

**Path params:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `travelId` | int | ID del trayecto |

**Respuesta 200:**

```json
{
  "status": "Success",
  "opinionsList": [
    {
      "id_comment": 15,
      "user_id_commentator": 5,
      "user_id_trayect": 8,
      "id_trayecto": 1,
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

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `id` | int | ID del comentario (`id_comment`) |

**Body (JSON):**

```json
{
  "id_comment": 15,
  "opinion": "Buen viaje, pero llegó tarde",
  "rating": 7
}
```

| Campo | Tipo | Requerido | Validación |
|-------|------|-----------|------------|
| `id_comment` | number | Sí | Int positivo (debe coincidir con `:id`) |
| `opinion` | string | Sí | min 1, max 1024 |
| `rating` | number | Sí | Int 1–10 |

**Respuesta 200:**

```json
{
  "status": "Success",
  "message": "Opinión actualizada correctamente",
  "updatedOpinion": {
    "id_comment": 15,
    "user_id_commentator": 5,
    "user_id_trayect": 8,
    "id_trayecto": 1,
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

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `id` | int | ID del comentario (`id_comment`) |

**Respuesta 200:**

```json
{
  "status": "Success",
  "message": "Opinión eliminada correctamente"
}
```

**Errores:**

- `404` — Opinión no encontrada.
