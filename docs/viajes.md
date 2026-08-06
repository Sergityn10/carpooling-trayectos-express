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
      "precio_conductor": 11.00,
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

**Descripción:** Busca trayectos por origen, destino, fecha y número de pasajeros. Geocodifica las direcciones de origen y destino del usuario y busca trayectos cuyas coordenadas estén dentro de un radio de 200 metros. También busca trayectos cuyos **tramos intermedios** (pasos de ruta generados con Google Maps Directions) pasen cerca del origen o destino del usuario. Devuelve resultados paginados.

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
      "precio_conductor": 11.00,
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
    "precio_conductor": 11.00,
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
    "precio_conductor": 11.00,
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
  "precio_conductor": 11.00,
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

**Descripción:** Crea un nuevo trayecto. Geocodifica origen y destino con Google Maps, **verifica** que el precio establecido por el conductor esté dentro del rango aceptable según la distancia (fórmula haversine × €/km), añade comisión de plataforma (15%) y tarifas de Stripe usando la fórmula `T = (P + S_f) / (1 - S_% - comisión)`, genera los **tramos** (pasos de la ruta) mediante Google Maps Directions y los guarda en la tabla `tramos`, y crea un chat asociado al trayecto en el microservicio de mensajes.

**Modelo de precios:**

- `precio_conductor`: Precio neto del conductor = el precio enviado por el conductor (verificado contra el rango aceptable)
- `precio`: Precio total al pasajero = `(precio_conductor + STRIPE_FIXED_FEE) / (1 - STRIPE_PERCENT - PLATFORM_COMMISSION_PERCENT)`
- **Verificación de precio**: El precio del conductor debe estar entre `distancia_km × EUR_PER_KM_MIN` y `distancia_km × EUR_PER_KM_MAX`. Si está fuera del rango, se devuelve error 400.
- Variables configurables en `.env`: `EUR_PER_KM_TRAYECTO` (0.06), `EUR_PER_KM_MIN` (0.06), `EUR_PER_KM_MAX` (0.08), `STRIPE_PERCENT`, `STRIPE_FIXED_FEE`, `PLATFORM_COMMISSION_PERCENT`
- Si `precio === 0`, el conductor ofrece el viaje gratis (sin verificación)

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

| Campo              | Tipo          | Requerido | Validación                                                 |
| ------------------ | ------------- | --------- | ---------------------------------------------------------- |
| `origen`           | string        | Sí        | min 2, max 100                                             |
| `destino`          | string        | Sí        | min 2, max 100                                             |
| `fecha`            | string        | Sí        | Formato `YYYY-MM-DD`                                       |
| `hora`             | string        | Sí        | Formato `HH:MM` (24h)                                      |
| `plazas`           | number        | Sí        | 1–7                                                        |
| `conductor`        | string (UUID) | Sí        | UUID del conductor (si no se envía, usa `req.user.userId`) |
| `disponible`       | number        | No        | 0–7 (por defecto = `plazas`)                               |
| `precio`           | number        | Sí        | >= 0 (verificado contra rango distancia × €/km)            |
| `precio_conductor` | number        | No        | Guardado automáticamente (= `precio` del conductor)        |
| `routeIndex`       | number        | No        | Int                                                        |
| `evento_id`        | string (UUID) | No        | UUID del evento asociado (para búsqueda rápida por evento) |

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
    "precio_conductor": 11.00,
    "precio": 15
  }
}
```

**Errores:**

- `400` — Fecha inválida, conductor no existe, o ya existe un trayecto con la misma fecha y hora.
- `404` — No se pudo determinar la provincia para calcular el precio.
- `502` — No se pudo calcular el precio o error al crear el chat.

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

### 17. Crear trayecto hacia/desde un evento

```
POST /api/trayecto/evento
```

**Autenticación:** Requerida (`authenticate`)

**Descripción:** Crea un nuevo trayecto asociado a un evento. Realiza una petición al microservicio de usuarios (`GET /api/events/:evento_id`) para obtener las coordenadas del evento. Soporta dos modos:

- **Trayecto de ida:** El conductor envía `origen` (su punto de partida). El destino se establece automáticamente como la ubicación del evento.
- **Trayecto de vuelta:** El conductor envía `destino` (su punto de llegada). El origen se establece automáticamente como la ubicación del evento.

Es obligatorio enviar **uno de los dos** (`origen` o `destino`), pero no ambos. Las coordenadas del evento se pasan directamente al trayecto sin geocodificación redundante. El resto del proceso es idéntico al de crear un trayecto normal: geocodificación del punto del usuario, verificación del precio según la distancia y creación del chat asociado.

**Body (JSON) — Trayecto de ida:**

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

**Body (JSON) — Trayecto de vuelta:**

```json
{
  "evento_id": "f1e2d3c4-b5a6-7890-abcd-ef1234567890",
  "destino": "Madrid, Calle Gran Vía 1",
  "fecha": "2025-01-15",
  "hora": "18:00",
  "plazas": 4,
  "conductor": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "disponible": 4,
  "precio": 0,
  "routeIndex": 0
}
```

| Campo        | Tipo          | Requerido   | Validación                                                 |
| ------------ | ------------- | ----------- | ---------------------------------------------------------- |
| `evento_id`  | string (UUID) | Sí          | UUID del evento asociado                                   |
| `origen`     | string        | Condicional | min 2, max 100. Enviar `origen` O `destino` (no ambos)     |
| `destino`    | string        | Condicional | min 2, max 100. Enviar `origen` O `destino` (no ambos)     |
| `fecha`      | string        | Sí          | Formato `YYYY-MM-DD`                                       |
| `hora`       | string        | Sí          | Formato `HH:MM` (24h)                                      |
| `plazas`     | number        | Sí          | 1–7                                                        |
| `conductor`  | string (UUID) | Sí          | UUID del conductor (si no se envía, usa `req.user.userId`) |
| `disponible` | number        | No          | 0–7 (por defecto = `plazas`)                               |
| `precio`     | number        | Sí          | >= 0 (verificado contra rango distancia × €/km)            |
| `routeIndex` | number        | No          | Int                                                        |

> **Nota:** El punto no enviado (`origen` o `destino`) se obtiene automáticamente desde las coordenadas del evento en el microservicio de usuarios. El campo `evento_id` se almacena en el trayecto para permitir búsquedas rápidas.

**Respuesta 201:**

```json
{
  "status": "Success",
  "message": "Trayecto creado correctamente",
  "trayecto": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "origen": "Madrid, Calle Gran Vía 1",
    "destino": "Nombre del evento",
    "fecha": "2025-01-15",
    "hora": "10:00",
    "plazas": 4,
    "conductor": "Juan Pérez",
    "conductor_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "precio_conductor": 11.00,
    "precio": 15
  }
}
```

**Errores:**

- `400` — `evento_id` faltante, ni `origen` ni `destino` enviados, fecha inválida, conductor no existe, o el evento no tiene una ubicación válida.
- `404` — No se pudo obtener la información del evento desde el microservicio de usuarios.
- `502` — No se pudo calcular el precio o error al crear el chat.

---

### 18. Obtener trayectos por evento

```
GET /api/trayecto/evento/:eventoId
```

**Autenticación:** Opcional (`tryAuthenticate`)

**Descripción:** Devuelve todos los trayectos asociados a un evento específico (mediante el campo `evento_id`), excluyendo los finalizados, en curso y cancelados. Ordenados por hora ascendente. Incluye nombre e imagen del conductor obtenidos del microservicio de usuarios, y si el usuario autenticado ha valorado cada trayecto.

**Path params:**

| Parámetro  | Tipo          | Descripción   |
| ---------- | ------------- | ------------- |
| `eventoId` | string (UUID) | ID del evento |

**Query params:**

| Parámetro   | Tipo   | Descripción                                                                                                              |
| ----------- | ------ | ------------------------------------------------------------------------------------------------------------------------ |
| `direccion` | string | Filtra por tipo de trayecto: `ida` (destino = evento) o `vuelta` (origen = evento). Si no se especifica, devuelve todos. |

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
      "precio_conductor": 11.00,
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

## Informes CAE (Certificados de Ahorro de Energía)

Cuando un trayecto finaliza, se genera automáticamente y de forma asíncrona un informe CAE que calcula los kilómetros recorridos y la energía (kWh) generada por el carpooling.

### Modelo de datos

#### InfoCAEs (`info_caes`)

| Campo             | Tipo     | Descripción                                       |
| ----------------- | -------- | ------------------------------------------------- |
| `id`              | UUID     | Identificador único del informe                   |
| `id_trayecto`     | UUID     | ID del trayecto asociado                          |
| `km_recorridos`   | Float    | Kilómetros totales recorridos por el conductor    |
| `km_with_company` | Float    | Kilómetros recorridos con pasajeros a bordo       |
| `kwh_generated`   | Float    | kWh generados (km acompañado × pasajeros × ratio) |
| `eur_generated`   | Float    | EUR generados (km acompañado × pasajeros × ratio) |
| `status_id`       | Int (FK) | Estado del informe (ver `StatusInfoCAEs`)         |
| `created_at`      | DateTime | Fecha de creación                                 |
| `updated_at`      | DateTime | Fecha de actualización                            |

#### StatusInfoCAEs (`status_info_caes`)

| Campo         | Tipo   | Descripción                         |
| ------------- | ------ | ----------------------------------- |
| `id`          | Int    | Identificador único (autoincrement) |
| `name`        | String | Nombre del estado                   |
| `description` | String | Descripción del estado              |

**Estados disponibles:**

| Estado      | Descripción                  |
| ----------- | ---------------------------- |
| `pending`   | Informe pendiente de cálculo |
| `in_review` | Informe en revisión          |
| `canceled`  | Informe cancelado            |
| `completed` | Informe completado           |

### Cálculo de kWh

La fórmula de generación de kWh es:

```
kwh = km_with_company × num_pasajeros_en_segmento × KWH_PER_PASSENGER_KM
```

Donde `KWH_PER_PASSENGER_KM` se configura en el archivo `.env` (por defecto `0.7`) y `EUR_PER_PASSENGER_KM` (por defecto `0.04`).

- Los kWh **solo** se generan cuando el conductor va acompañado.
- Si lleva 1 pasajero: `0.7 kWh/km`.
- Si lleva 2 pasajeros: `0.7 × 2 = 1.4 kWh/km`.
- Si va solo: `0 kWh` y `0€` (no genera energía ni dinero).

### Cálculo de EUR

La fórmula de generación de EUR es análoga:

```
eur = km_with_company × num_pasajeros_en_segmento × EUR_PER_PASSENGER_KM
```

- 1 pasajero: `0.04€/km`.
- 2 pasajeros: `0.04 × 2 = 0.08€/km`.
- Si va solo: `0€`.

### Proceso

1. Al finalizar un trayecto (`POST /api/trayecto/:id/finalizar`), se crea un registro `InfoCAEs` con estado `pending`.
2. Asíncronamente (sin bloquear la respuesta al cliente), se calculan:
   - **km_recorridos:** distancia total desde los puntos de `Recorrido` del conductor (Haversine entre puntos consecutivos). Si no hay puntos suficientes, se usa la distancia directa origen-destino.
   - **km_with_company:** suma de los segmentos donde había al menos un pasajero a bordo (determinado por eventos de `recogida` y `llegada_destino`).
   - **kwh_generated:** suma por segmento de `km_segmento × pasajeros_en_segmento × KWH_PER_PASSENGER_KM`.
   - **eur_generated:** suma por segmento de `km_segmento × pasajeros_en_segmento × EUR_PER_PASSENGER_KM`.
3. Se detectan y registran en log todos los eventos del trayecto (`comienzo`, `recogida`, `llegada_destino`, `finalizacion`) con sus coordenadas y timestamps reales.
4. Al completar el cálculo, el estado pasa a `in_review` (en revisión).
5. Un administrador revisa el informe y lo aprueba mediante `PATCH /api/cae/:id/approve`, cambiando el estado a `completed`.

> **Nota:** El cálculo es asíncrono y no bloquea la finalización del trayecto. Si hay un error, el informe queda en estado `pending`.

> **Eventos del trayecto en el CAE:** El informe CAE incluye todos los eventos del ciclo de vida del trayecto: `comienzo` (inicio real), `recogida` (confirmación de pasajero), `llegada_destino` (fin de pasajero) y `finalizacion` (fin del trayecto). Cada evento se registra con coordenadas GPS y timestamp, permitiendo verificar el recorrido completo.

### Endpoint de balance CAE

#### Obtener balance del conductor

```
GET /api/cae/balance
```

**Auth:** Requerida

**Descripción:** Devuelve el dinero generado por el conductor agrupado por estado de los informes CAE.

**Respuesta 200:**

```json
{
  "status": "Success",
  "en_revision": 12.50,
  "disponible": 45.30,
  "cancelado": 2.00,
  "total": 57.80,
  "detalles": [
    {
      "id": "uuid",
      "id_trayecto": "uuid",
      "km_recorridos": 120.5,
      "km_with_company": 85.2,
      "kwh_generated": 59.64,
      "eur_generated": 3.41,
      "status": "completed",
      "created_at": "2026-07-18T10:00:00Z",
      "updated_at": "2026-07-18T10:05:00Z"
    }
  ]
}
```

**Campos:**

| Campo         | Tipo  | Descripción                                              |
| ------------- | ----- | -------------------------------------------------------- |
| `en_revision` | Float | EUR en informes `pending` o `in_review` (no disponibles) |
| `disponible`  | Float | EUR en informes `completed` (listos para retirar)        |
| `cancelado`   | Float | EUR en informes `canceled`                               |
| `total`       | Float | Suma de `en_revision` + `disponible`                     |
| `detalles`    | Array | Listado de informes CAE individuales del conductor       |

**Errores:**

- `401` — No autenticado.
- `500` — Error al obtener balance CAE.

#### Aprobar CAE (admin)

```
PATCH /api/cae/:id/approve
```

**Auth:** Requerida (solo admin)

**Descripción:** Cambia el estado de un informe CAE de `in_review` a `completed`. Solo un administrador puede ejecutar este endpoint. Una vez aprobado, el dinero del informe pasa a estar disponible para el conductor.

**Parámetros de URL:**

- `id` — UUID del informe CAE

**Respuesta 200:**

```json
{
  "status": "Success",
  "message": "CAE aprobado correctamente"
}
```

**Errores:**

- `401` — No autenticado.
- `403` — El usuario no es admin.
- `404` — Informe CAE no encontrado.
- `409` — El informe no está en estado `in_review`.

#### Listar todos los CAEs (admin)

```
GET /api/cae
```

**Auth:** Requerida (solo admin)

**Query params:**

| Param    | Tipo   | Descripción                                                         |
| -------- | ------ | ------------------------------------------------------------------- |
| `status` | String | Filtrar por estado: `pending`, `in_review`, `completed`, `canceled` |
| `page`   | Int    | Página (default 1)                                                  |
| `limit`  | Int    | Elementos por página (default 50)                                   |

**Respuesta 200:**

```json
{
  "status": "Success",
  "items": [
    {
      "id": "uuid",
      "id_trayecto": "uuid",
      "conductor": "uuid-del-conductor",
      "origen": "Madrid",
      "destino": "Toledo",
      "hora": "2026-07-18T10:00:00.000Z",
      "km_recorridos": 120.5,
      "km_with_company": 85.2,
      "kwh_generated": 59.64,
      "eur_generated": 3.41,
      "status": "in_review",
      "created_at": "2026-07-18T10:00:00Z",
      "updated_at": "2026-07-18T10:05:00Z"
    }
  ],
  "total": 150,
  "page": 1,
  "limit": 50
}
```

**Errores:**

- `401` — No autenticado.
- `403` — El usuario no es admin.
- `500` — Error al listar CAEs.

---

#### Listar CAEs de un usuario (admin)

```
GET /api/cae/user/:userId
```

**Auth:** Requerida (solo admin)

**Parámetros de URL:**

- `userId` — UUID del conductor

**Respuesta 200:**

```json
{
  "status": "Success",
  "items": [
    {
      "id": "uuid",
      "id_trayecto": "uuid",
      "origen": "Madrid",
      "destino": "Toledo",
      "hora": "2026-07-18T10:00:00.000Z",
      "km_recorridos": 120.5,
      "km_with_company": 85.2,
      "kwh_generated": 59.64,
      "eur_generated": 3.41,
      "status": "completed",
      "created_at": "2026-07-18T10:00:00Z",
      "updated_at": "2026-07-18T10:05:00Z"
    }
  ],
  "total": 5
}
```

**Errores:**

- `401` — No autenticado.
- `403` — El usuario no es admin.
- `500` — Error al listar CAEs del usuario.

---

## Reportes CAE

Los CAEs (Certificados de Ahorro de Emisiones) se generan automáticamente al finalizar un trayecto. Permanecen en estado `pending` hasta que se calculan los km y kWh, pasando a `in_review`. Cuando la energía acumulada supera el umbral (30 MWh por defecto), se pueden agrupar en un **reporte CAE** para enviar al microservicio de usuarios, que generará el Excel para revisión.

### Modelo de datos

#### CAEReport (`cae_reports`)

| Campo        | Tipo     | Descripción                               |
| ------------ | -------- | ----------------------------------------- |
| `id`         | UUID     | Identificador único del reporte           |
| `name`       | String   | Nombre del reporte                        |
| `status`     | String   | Estado: `draft`, `sent`, `reviewed`       |
| `total_kwh`  | Float    | Suma de kWh de todos los CAEs del reporte |
| `total_eur`  | Float    | Suma de euros generados                   |
| `total_caes` | Int      | Número de CAEs incluidos                  |
| `file_url`   | String?  | URL del Excel generado (opcional)         |
| `created_at` | DateTime | Fecha de creación                         |
| `updated_at` | DateTime | Fecha de actualización                    |

#### InfoCAEs — campo nuevo

| Campo       | Tipo  | Descripción                                         |
| ----------- | ----- | --------------------------------------------------- |
| `report_id` | UUID? | ID del reporte al que pertenece (null = no enviado) |

### Endpoints

#### 1. Resumen de reportes CAE

```
GET /api/cae/reports/summary
```

**Auth:** Admin requerido

**Descripción:** Devuelve un resumen del estado de todos los CAEs y reportes.

**Respuesta 200:**

```json
{
  "status": "Success",
  "caes": {
    "pendientes_envio": 15,
    "enviados_sin_aprobar": 8,
    "completados": 30,
    "cancelados": 2
  },
  "kwh_acumulado_pendiente": 12500.5,
  "kwh_umbral_envio": 30000,
  "reportes_creados": 3
}
```

#### 2. Listar reportes CAE

```
GET /api/cae/reports
```

**Auth:** Admin requerido

**Query params:**

| Parámetro | Tipo   | Descripción                                      |
| --------- | ------ | ------------------------------------------------ |
| `status`  | string | Filtrar por estado (`draft`, `sent`, `reviewed`) |
| `page`    | int    | Página (por defecto 1)                           |
| `limit`   | int    | Elementos por página (por defecto 50)            |

**Respuesta 200:**

```json
{
  "status": "Success",
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Reporte CAE 2026-07",
      "status": "draft",
      "total_kwh": 32000,
      "total_eur": 1280,
      "total_caes": 45,
      "file_url": null,
      "created_at": "2026-07-20T10:00:00.000Z",
      "updated_at": "2026-07-20T10:00:00.000Z"
    }
  ],
  "total": 3,
  "page": 1,
  "limit": 50
}
```

#### 3. Crear reporte CAE

```
POST /api/cae/reports
```

**Auth:** Admin requerido

**Descripción:** Agrupa todos los CAEs en estado `in_review` sin reporte asignado en un nuevo reporte. Calcula los totales de kWh y euros.

**Body:**

```json
{
  "name": "Reporte CAE Julio 2026"
}
```

| Campo  | Tipo   | Requerido | Descripción                                             |
| ------ | ------ | --------- | ------------------------------------------------------- |
| `name` | string | No        | Nombre del reporte (auto-generado si no se proporciona) |

**Respuesta 201:**

```json
{
  "status": "Success",
  "report": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Reporte CAE Julio 2026",
    "status": "draft",
    "total_kwh": 32000,
    "total_eur": 1280,
    "total_caes": 45,
    "created_at": "2026-07-20T10:00:00.000Z"
  }
}
```

**Errores:**

- `400` — No hay CAEs pendientes de reporte.
- `403` — El usuario no es admin.
- `500` — Error en el servidor.

#### 4. Obtener datos completos de un reporte (Anexo III)

```
GET /api/cae/reports/:id
```

**Auth:** Admin requerido

**Descripción:** Devuelve todos los datos del reporte y de cada CAE incluido, con la información del Anexo III: viajeros, vehículo, trazado GPS, confirmaciones de inicio/fin y verificación de vehículo único. Los datos de conductor, pasajeros y vehículo se obtienen del microservicio de usuarios.

**Respuesta 200:**

```json
{
  "status": "Success",
  "reporte": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Reporte CAE Julio 2026",
    "status": "draft",
    "total_kwh": 32000,
    "total_eur": 1280,
    "total_caes": 45,
    "file_url": null,
    "created_at": "2026-07-20T10:00:00.000Z",
    "updated_at": "2026-07-20T10:00:00.000Z"
  },
  "items": [
    {
      "cae_id": "660e8400-e29b-41d4-a716-446655440000",
      "trayecto_id": "770e8400-e29b-41d4-a716-446655440000",
      "estado": "in_review",
      "km_recorridos": 120.5,
      "km_with_company": 118.3,
      "kwh_generated": 82.81,
      "eur_generated": 3.31,
      "viaje": {
        "origen": "Madrid, Centro",
        "destino": "Toledo, Casco",
        "hora_programada": "2026-07-15T10:00:00.000Z",
        "hora_inicio_real": "2026-07-15T10:00:00.000Z",
        "hora_fin_real": "2026-07-15T11:35:00.000Z",
        "inicio_coords": { "lat": 40.4168, "lng": -3.7038 },
        "fin_coords": { "lat": 39.8628, "lng": -4.0273 },
        "origen_coords": { "lat": 40.4168, "lng": -3.7038 },
        "destino_coords": { "lat": 39.8628, "lng": -4.0273 },
        "trazado": [
          { "lat": 40.4168, "lng": -3.7038, "address": "Calle Gran Vía 1", "timestamp": "2026-07-15T10:00:00.000Z" },
          { "lat": 40.4150, "lng": -3.7100, "address": "Calle Princesa", "timestamp": "2026-07-15T10:05:00.000Z" }
        ]
      },
      "conductor": {
        "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "nombre": "Juan Pérez",
        "email": "juan@example.com"
      },
      "vehiculo": {
        "id": "v1e2d3c4-b5a6-7890-abcd-ef1234567890",
        "matricula": "1234ABC",
        "marca": "Toyota",
        "modelo": "Corolla"
      },
      "pasajeros": [
        {
          "user_id": "b2c3d4e5-f6a7-8901-abcd-ef1234567890",
          "nombre": "Ana García",
          "email": "ana@example.com",
          "confirmacion_inicio": "2026-07-15T10:03:00.000Z",
          "confirmacion_fin": "2026-07-15T11:30:00.000Z",
          "inicio_lat": 40.4150,
          "inicio_lng": -3.7100,
          "fin_lat": 39.8628,
          "fin_lng": -4.0273
        }
      ],
      "eventos_trayecto": [
        {
          "tipo": "comienzo",
          "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
          "id_reserva": null,
          "lat": 40.4168,
          "lng": -3.7038,
          "timestamp": "2026-07-15T10:00:00.000Z"
        },
        {
          "tipo": "recogida",
          "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
          "id_reserva": "r1e2d3c4-b5a6-7890-abcd-ef1234567890",
          "lat": 40.4150,
          "lng": -3.7100,
          "timestamp": "2026-07-15T10:03:00.000Z"
        },
        {
          "tipo": "llegada_destino",
          "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
          "id_reserva": "r1e2d3c4-b5a6-7890-abcd-ef1234567890",
          "lat": 39.8628,
          "lng": -4.0273,
          "timestamp": "2026-07-15T11:30:00.000Z"
        },
        {
          "tipo": "finalizar",
          "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
          "id_reserva": null,
          "lat": 39.8628,
          "lng": -4.0273,
          "timestamp": "2026-07-15T11:35:00.000Z"
        }
      ],
      "verificacion_unico_vehiculo": true
    }
  ]
}
```

**Datos incluidos del Anexo III:**

- ✅ Listado de viajeros (conductor y pasajeros) con nombre y email
- ✅ Matrícula, marca y modelo del vehículo
- ✅ Geolocalización de inicio, trazado y fin del trayecto
- ✅ Hora programada del trayecto + hora real de inicio y fin (eventos `comienzo` y `finalizacion`)
- ✅ Coordenadas reales de inicio y fin (desde eventos `comienzo` y `finalizacion`)
- ✅ Confirmación activa de inicio y fin por cada pasajero (eventos de recogida y llegada_destino)
- ✅ Eventos completos del trayecto (comienzo, recogida, llegada_destino, finalizacion) con geolocalización y timestamps
- ✅ Verificación de vehículo único (todos los viajeros en el mismo `vehiculo_id`)
- ❌ DNI/NIE y teléfono — pendientes del microservicio de usuarios

**Errores:**

- `403` — El usuario no es admin.
- `404` — Reporte no encontrado.
- `500` — Error en el servidor.

#### 5. Cambiar estado de un reporte

```
PATCH /api/cae/reports/:id/status
```

**Auth:** Admin requerido

**Descripción:** Cambia el estado de un reporte CAE. Los estados válidos son: `draft`, `sent`, `reviewed`.

**Body:**

```json
{
  "status": "sent"
}
```

| Campo    | Tipo   | Requerido | Descripción                                |
| -------- | ------ | --------- | ------------------------------------------ |
| `status` | string | Sí        | Nuevo estado: `draft`, `sent` o `reviewed` |

**Respuesta 200:**

```json
{
  "status": "Success",
  "report": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Reporte CAE Julio 2026",
    "status": "sent",
    "total_kwh": 32000,
    "total_eur": 1280,
    "total_caes": 45,
    "file_url": null,
    "created_at": "2026-07-20T10:00:00.000Z",
    "updated_at": "2026-07-21T08:00:00.000Z"
  }
}
```

**Errores:**

- `400` — Estado inválido o campo `status` faltante.
- `403` — El usuario no es admin.
- `404` — Reporte no encontrado.
- `500` — Error en el servidor.

#### 6. Eliminar un reporte

```
DELETE /api/cae/reports/:id
```

**Auth:** Admin requerido

**Descripción:** Elimina un reporte CAE. Al eliminarlo, los CAEs asociados se desvinculan (`report_id` se establece a `null`), por lo que vuelven a estar disponibles para incluirse en un nuevo reporte. **No se eliminan los CAEs**, solo la relación con el reporte.

**Respuesta 200:**

```json
{
  "status": "Success",
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "deleted": true
}
```

**Errores:**

- `403` — El usuario no es admin.
- `404` — Reporte no encontrado.
- `500` — Error en el servidor.

---

## Tramos de ruta

Al crear un trayecto, se generan automáticamente los pasos de la ruta usando **Google Maps Directions API**. Cada paso se guarda en la tabla `tramos` con sus coordenadas y la indicación de la calle/maniobra.

### Modelo de datos

#### Tramo (`tramos`)

| Campo         | Tipo     | Descripción                                                  |
| ------------- | -------- | ------------------------------------------------------------ |
| `id`          | UUID     | Identificador único del tramo                                |
| `id_trayecto` | UUID     | ID del trayecto al que pertenece                             |
| `lat`         | Float    | Latitud del punto final del paso                             |
| `lng`         | Float    | Longitud del punto final del paso                            |
| `address`     | String   | Indicación del paso (ej. "Gira a la derecha en Calle Mayor") |
| `step_order`  | Int      | Orden del paso dentro de la ruta (0 = primer paso)           |
| `created_at`  | DateTime | Fecha de creación                                            |

### Búsqueda por tramos

La búsqueda de trayectos (`GET /api/trayecto/search`) ahora también matches trayectos cuyos tramos intermedios pasan cerca (200m) del origen o destino del usuario. Esto permite encontrar viajes que pasan por zonas intermedias, no solo por el origen y destino exactos.

---

## Administración de trayectos (Admin)

Endpoints exclusivos para administradores. Permiten gestionar todos los trayectos del sistema, incluidos los finalizados y cancelados, con filtros avanzados y paginación.

**Base URL:** `/api/admin/trayectos`

### 1. Listar todos los trayectos (admin)

```
GET /api/admin/trayectos
```

**Autenticación:** Requerida (solo admin)

**Descripción:** Devuelve todos los trayectos del sistema con filtros por estado, conductor, evento, rango de fechas, búsqueda textual, ordenación y paginación. Incluye nombre y email del conductor.

**Query params:**

| Parámetro    | Tipo   | Descripción                                                                     |
| ------------ | ------ | ------------------------------------------------------------------------------- |
| `status`     | String | Filtrar por estado (acepta múltiples separados por coma: `programado,en curso`) |
| `conductor`  | UUID   | Filtrar por ID de conductor                                                     |
| `evento_id`  | UUID   | Filtrar por evento asociado                                                     |
| `fechaDesde` | String | Fecha mínima del campo `hora` (ISO 8601)                                        |
| `fechaHasta` | String | Fecha máxima del campo `hora` (ISO 8601)                                        |
| `search`     | String | Búsqueda textual sobre `origen` y `destino`                                     |
| `orderBy`    | String | Campo de ordenación (por defecto `created_at`)                                  |
| `order`      | String | `asc` o `desc` (por defecto `desc`)                                             |
| `page`       | Int    | Página (por defecto 1)                                                          |
| `limit`      | Int    | Elementos por página (por defecto 10, máximo 100)                               |

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
      "conductor": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "conductor_nombre": "Juan Pérez",
      "conductor_email": "juan@example.com",
      "status": "finalizado",
      "created_at": "2026-07-10T12:00:00.000Z"
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

### 2. Obtener trayecto por ID (admin)

```
GET /api/admin/trayectos/:id
```

**Autenticación:** Requerida (solo admin)

**Descripción:** Devuelve el detalle completo de un trayecto con reservas, tramos de ruta y eventos del ciclo de vida (comienzo, recogida, llegada_destino, finalizacion).

**Respuesta 200:**

```json
{
  "status": "Success",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "origen": "Madrid",
    "destino": "Toledo",
    "hora": "2026-07-15T10:00:00.000Z",
    "status": "finalizado",
    "conductor_nombre": "Juan Pérez",
    "conductor_email": "juan@example.com",
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

---

### 3. Actualizar trayecto (admin)

```
PUT /api/admin/trayectos/:id
```

**Autenticación:** Requerida (solo admin)

**Descripción:** Actualiza campos permitidos de un trayecto. Permite modificar `status` y `conductor` directamente, sin las validaciones de precio del flujo normal.

**Campos actualizables:** `origen`, `destino`, `hora`, `plazas`, `disponible`, `precio`, `precio_conductor`, `conductor`, `vehiculo_id`, `routeIndex`, `status`, `origen_lat`, `origen_lng`, `destino_lat`, `destino_lng`, `evento_id`

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

---

### 4. Eliminar trayecto (admin)

```
DELETE /api/admin/trayectos/:id
```

**Autenticación:** Requerida (solo admin)

**Descripción:** Elimina permanentemente un trayecto y todas sus dependencias (tramos, recorridos, eventos, comentarios, informes CAE, pagos y reservas) en una transacción atómica.

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

**Descripción:** Devuelve todas las opiniones que ha escrito un usuario específico, con paginación.

**Path params:**

| Parámetro | Tipo          | Descripción                 |
| --------- | ------------- | --------------------------- |
| `userId`  | string (UUID) | ID del usuario comentarista |

**Query params:**

| Parámetro | Tipo | Descripción                                    |
| --------- | ---- | ---------------------------------------------- |
| `page`    | Int  | Página (por defecto 1)                         |
| `limit`   | Int  | Elementos por página (por defecto 10, máx 100) |

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

- `404` — El usuario no existe.

---

### 3. Obtener opiniones por usuario valorado

```
GET /api/comments/user_id_trayect/:userId
```

**Autenticación:** No requerida

**Descripción:** Devuelve todas las opiniones recibidas por un usuario específico (como usuario valorado), con paginación.

**Path params:**

| Parámetro | Tipo          | Descripción             |
| --------- | ------------- | ----------------------- |
| `userId`  | string (UUID) | ID del usuario valorado |

**Query params:**

| Parámetro | Tipo | Descripción                                    |
| --------- | ---- | ---------------------------------------------- |
| `page`    | Int  | Página (por defecto 1)                         |
| `limit`   | Int  | Elementos por página (por defecto 10, máx 100) |

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
