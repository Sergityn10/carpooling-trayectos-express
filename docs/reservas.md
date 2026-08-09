# Reservas

Gestión de reservas de plazas en trayectos, pagos con Stripe, confirmación de viajes e incidencias.

---

### 1. Crear reserva

```
POST /api/reserva
```

**Autenticación:** Requerida (`authenticate`)

**Descripción:** Crea una reserva para un trayecto. Verifica disponibilidad, crea una sesión de pago en Stripe (Checkout Session) mediante el microservicio de usuarios, y une al pasajero al chat del trayecto. Si ya existe una reserva pendiente, la reutiliza.

**Body (JSON):**

```json
{
  "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "trayecto_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

| Campo         | Tipo          | Requerido | Validación        |
| ------------- | ------------- | --------- | ----------------- |
| `user_id`     | string (UUID) | Sí        | UUID del usuario  |
| `trayecto_id` | string (UUID) | Sí        | UUID del trayecto |

**Respuesta 201:**

```json
{
  "status": "Success",
  "message": "Reserva creada correctamente",
  "reserva": {
    "id": "r1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "conductorName": "Juan Pérez",
    "trayecto_id": "550e8400-e29b-41d4-a716-446655440000",
    "stripe_checkout_session_id": "cs_test_123"
  },
  "stripe_url": "https://checkout.stripe.com/..."
}
```

**Errores:**

- `400` — Validación fallida, usuario o trayecto no existen, sin asientos libres, error en Stripe.
- `404` — Trayecto, conductor o usuario no encontrado.
- `502` — Error al unirse al chat del trayecto.

---

### 2. Obtener mis reservas

```
GET /api/reserva/userId/:userIdParam
```

**Autenticación:** Requerida (`authenticate`)

**Descripción:** Devuelve todas las reservas del usuario autenticado, incluyendo los datos del trayecto asociado y la información del conductor. El `userIdParam` debe coincidir con el ID del usuario autenticado. Incluye paginación.

**Path params:**

| Parámetro     | Tipo          | Descripción                                                |
| ------------- | ------------- | ---------------------------------------------------------- |
| `userIdParam` | string (UUID) | ID del usuario (debe coincidir con el usuario autenticado) |

**Query params:**

| Parámetro | Tipo | Descripción                                    |
| --------- | ---- | ---------------------------------------------- |
| `page`    | Int  | Página (por defecto 1)                         |
| `limit`   | Int  | Elementos por página (por defecto 10, máx 100) |

**Respuesta 200:**

```json
{
  "status": "Success",
  "pasajerosList": [
    {
      "id_reserva": "r1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "id_trayecto": "550e8400-e29b-41d4-a716-446655440000",
      "status": "completed",
      "stripe_checkout_session_id": "cs_test_123",
      "trip_outcome": "pending",
      "valorado": false,
      "trayecto": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "origen": "Madrid",
        "destino": "Toledo",
        "hora": "2025-01-15T10:00:00.000Z",
        "plazas": 4,
        "conductor": "Juan Pérez",
        "conductor_id": "b2c3d4e5-f678-90ab-cdef-123456789012",
        "img_perfil": "https://...",
        "precio": 15
      }
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

- `401` — No tienes permiso para ver las reservas de este usuario.

---

### 3. Obtener reservas por trayecto

```
GET /api/reserva/trayectoId/:travelId
```

**Autenticación:** Requerida (`authenticate`)

**Descripción:** Devuelve la lista de pasajeros con reserva activa (no cancelada) en un trayecto específico, incluyendo nombre, imagen de perfil, preferencias y si ha sido valorado.

**Path params:**

| Parámetro  | Tipo          | Descripción     |
| ---------- | ------------- | --------------- |
| `travelId` | string (UUID) | ID del trayecto |

**Respuesta 200:**

```json
{
  "status": "Success",
  "pasajerosList": [
    {
      "id_reserva": "r1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "id_trayecto": "550e8400-e29b-41d4-a716-446655440000",
      "status": "completed",
      "img_perfil": "https://...",
      "nombre": "Ana López",
      "preferences": { "music": "1", "smoking": "0" },
      "valorado": false
    }
  ]
}
```

**Errores:**

- `404` — No se ha encontrado el trayecto.

---

### 4. Cancelar reserva

```
DELETE /api/reserva/:id
```

**Autenticación:** Requerida (`authenticate`)

**Descripción:** Cancela una reserva. Solo el usuario que creó la reserva puede cancelarla. Cancela el PaymentIntent en Stripe (si existe), saca al usuario del chat del trayecto, marca la reserva como `canceled` y restaura la disponibilidad del trayecto.

**Path params:**

| Parámetro | Tipo          | Descripción                     |
| --------- | ------------- | ------------------------------- |
| `id`      | string (UUID) | ID de la reserva (`id_reserva`) |

**Respuesta 200:**

```json
{
  "status": "Success",
  "message": "Reserva cancelada correctamente"
}
```

**Errores:**

- `400` — ID inválido.
- `401` — No tienes permiso para eliminar esta reserva.
- `404` — Reserva no encontrada.
- `502` — Error al cancelar el pago en Stripe.

---

### 5. Confirmar viaje exitoso

```
POST /api/reserva/:id/success
```

**Autenticación:** Requerida (`authenticate`)

**Descripción:** Confirma que un viaje ha finalizado correctamente. Solo el pasajero (no el conductor) puede confirmar. La reserva debe estar `completed` y el trayecto `finalizado`. Captura el PaymentIntent en Stripe.

**Path params:**

| Parámetro | Tipo          | Descripción                     |
| --------- | ------------- | ------------------------------- |
| `id`      | string (UUID) | ID de la reserva (`id_reserva`) |

**Respuesta 200:**

```json
{
  "status": "Success",
  "message": "Viaje confirmado y pago capturado correctamente",
  "capture": { ... }
}
```

**Errores:**

- `400` — ID inválido.
- `401` — No tienes permiso (el conductor no puede confirmar).
- `404` — Reserva no encontrada.
- `409` — La reserva no está completada, ya confirmada, tiene incidencia, o el trayecto no está finalizado.

---

### 6. Reclamar incidencia de viaje

```
POST /api/reserva/:id/issue
```

**Autenticación:** Requerida (`authenticate`)

**Descripción:** Registra una incidencia/reclamación sobre un viaje. Solo el conductor del trayecto puede reclamar. Marca la reserva con `trip_outcome = 'issue'`.

**Path params:**

| Parámetro | Tipo          | Descripción                     |
| --------- | ------------- | ------------------------------- |
| `id`      | string (UUID) | ID de la reserva (`id_reserva`) |

**Body (JSON):**

```json
{
  "reason": "El pasajero no se presentó"
}
```

| Campo    | Tipo   | Requerido | Validación |
| -------- | ------ | --------- | ---------- |
| `reason` | string | Sí        | No vacío   |

**Respuesta 200:**

```json
{
  "status": "Success",
  "message": "Reclamación registrada"
}
```

**Errores:**

- `400` — ID inválido o `reason` vacío.
- `401` — No tienes permiso (solo el conductor puede reclamar).
- `404` — Reserva no encontrada.
- `409` — El viaje ya fue confirmado como exitoso.

---

### 8. Reserva mediante QR (unión y recogida inmediata)

```
POST /api/reserva/qr
```

**Autenticación:** Requerida (`authenticate`)

**Descripción:** Crea una reserva mediante código QR, donde el pasajero ya está físicamente con el conductor. El comportamiento depende de si el trayecto es gratuito o de pago:

- **Trayecto gratuito (precio = 0):** La reserva se crea directamente con estado `completed` y se genera el evento de `recogida` inmediatamente.
- **Trayecto de pago:** Se crea una sesión de Stripe Checkout e intenta confirmar el PaymentIntent automáticamente usando el método de pago guardado del pasajero (cargo directo `off_session`):
  - **Si el pago se confirma:** La reserva se crea con estado `completed` y se genera el evento de `recogida`.
  - **Si no hay método de pago guardado o falla el cargo:** La reserva se crea con estado `pending` y se devuelve la URL de Stripe Checkout para que el pasajero complete el pago manualmente. El evento de `recogida` se generará cuando el webhook confirme el pago.

En todos los casos se decrementa la disponibilidad del trayecto y se crea el evento `reserva_creada`. Si el usuario ya tenía una reserva cancelada, la reactiva.

**Body (JSON):**

```json
{
  "trayecto_id": "550e8400-e29b-41d4-a716-446655440000",
  "lat": 40.4168,
  "lng": -3.7038
}
```

| Campo         | Tipo          | Requerido | Descripción                          |
| ------------- | ------------- | --------- | ------------------------------------ |
| `trayecto_id` | string (UUID) | Sí        | ID del trayecto al que se une        |
| `lat`         | number        | Sí        | Latitud de la ubicación de recogida  |
| `lng`         | number        | Sí        | Longitud de la ubicación de recogida |

**Respuesta 201 (pago confirmado o trayecto gratuito):**

```json
{
  "status": "Success",
  "message": "Reserva creada y recogida registrada correctamente",
  "reserva": {
    "id": "r1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "trayecto_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "completed"
  }
}
```

**Respuesta 201 (pago pendiente — sin método de pago guardado):**

```json
{
  "status": "Success",
  "message": "Reserva creada en estado pendiente. Se requiere completar el pago.",
  "requires_payment": true,
  "stripe_url": "https://checkout.stripe.com/c/pay/cs_...",
  "stripe_checkout_session_id": "cs_test_...",
  "reserva": {
    "id": "r1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "trayecto_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "pending"
  }
}
```

**Errores:**

- `400` — `trayecto_id`, `lat` o `lng` ausentes; el conductor no puede reservar su propio trayecto; sin asientos libres.
- `401` — No autenticado.
- `404` — Trayecto no encontrado.
- `500` — Error al procesar la transacción (reserva, evento o disponibilidad).

---

### 10. Estadísticas de usuario

```
GET /api/reserva/stats/:userId
```

**Autenticación:** Requerida (`authenticate`)

**Descripción:** Devuelve un resumen agregado de la actividad del usuario: trayectos como conductor, reservas como pasajero, comentarios realizados y recibidos, ganancias totales, pasajeros transportados y métricas CAE (km, kWh, EUR). Solo el propio usuario o un admin pueden consultar estas estadísticas.

**Path params:**

| Parámetro | Tipo          | Descripción                |
| --------- | ------------- | -------------------------- |
| `userId`  | string (UUID) | ID del usuario a consultar |

**Respuesta 200:**

```json
{
  "status": "Success",
  "data": {
    "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "trayectos": {
      "total_como_conductor": 25,
      "finalizados": 18,
      "activos": 5,
      "plazas_ofrecidas": 100
    },
    "reservas": {
      "total_como_pasajero": 12,
      "completadas": 8,
      "pendientes": 2,
      "canceladas": 2
    },
    "comentarios": {
      "realizados": 7,
      "recibidos": 15,
      "rating_promedio": 8.5
    },
    "economia": {
      "total_ganado": 245.50,
      "pasajeros_transportados": 42,
      "kwh_generados": 580.2,
      "eur_generados_kwh": 120.75
    },
    "cae": {
      "km_recorridos": 3200.5,
      "kwh_generados": 580.2,
      "eur_generados": 120.75
    }
  }
}
```

**Campos de la respuesta:**

| Campo                              | Tipo        | Descripción                                                                  |
| ---------------------------------- | ----------- | ---------------------------------------------------------------------------- |
| `trayectos.total_como_conductor`   | Int         | Total de trayectos creados como conductor (todos los estados)                |
| `trayectos.finalizados`            | Int         | Trayectos finalizados como conductor                                         |
| `trayectos.activos`                | Int         | Trayectos no finalizados ni cancelados como conductor                        |
| `trayectos.plazas_ofrecidas`       | Int         | Suma de plazas ofertadas en todos sus trayectos                              |
| `reservas.total_como_pasajero`     | Int         | Total de reservas como pasajero (todos los estados)                          |
| `reservas.completadas`             | Int         | Reservas con status `completed`                                              |
| `reservas.pendientes`              | Int         | Reservas con status `pending`                                                |
| `reservas.canceladas`              | Int         | Reservas con status `canceled`                                               |
| `comentarios.realizados`           | Int         | Comentarios escritos por el usuario                                          |
| `comentarios.recibidos`            | Int         | Comentarios recibidos sobre el usuario                                       |
| `comentarios.rating_promedio`      | Float\|null | Rating promedio recibido (1-10), `null` si sin valoraciones                  |
| `economia.total_ganado`            | Float       | Suma de `precio_conductor` de trayectos finalizados con reservas completadas |
| `economia.pasajeros_transportados` | Int         | Reservas `completed` en trayectos del usuario como conductor                 |
| `economia.kwh_generados`           | Float       | kWh totales generados (ahorro energético) como conductor                     |
| `economia.eur_generados_kwh`       | Float       | EUR totales generados por ahorro energético (kWh) como conductor             |
| `cae.km_recorridos`                | Float       | km totales recorridos en trayectos como conductor                            |
| `cae.kwh_generados`                | Float       | kWh totales generados (ahorro energético)                                    |
| `cae.eur_generados`                | Float       | EUR totales generados (ahorro económico)                                     |

**Errores:**

- `400` — `userId` no proporcionado.
- `403` — No tienes permiso para ver las estadísticas de otro usuario (salvo admin).
- `500` — Error en el servidor.

---

### 11. Perfil público de usuario

```
GET /api/reserva/profile/:userId
```

**Autenticación:** No requerida

**Descripción:** Devuelve la información pública de un usuario: nombre, imagen de perfil, trayectos como conductor, valoraciones recibidas, pasajeros transportados y métricas CAE (km, kWh, EUR). No incluye datos privados como ganancias o reservas como pasajero.

**Path params:**

| Parámetro | Tipo          | Descripción                |
| --------- | ------------- | -------------------------- |
| `userId`  | string (UUID) | ID del usuario a consultar |

**Respuesta 200:**

```json
{
  "status": "Success",
  "data": {
    "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "nombre": "Juan Pérez",
    "img_perfil": "https://...",
    "trayectos": {
      "total_como_conductor": 25,
      "finalizados": 18
    },
    "comentarios": {
      "recibidos": 15,
      "rating_promedio": 8.5
    },
    "pasajeros_transportados": 42,
    "cae": {
      "km_recorridos": 3200.5,
      "kwh_generados": 580.2,
      "eur_generados": 120.75
    }
  }
}
```

**Campos de la respuesta:**

| Campo                            | Tipo         | Descripción                                                  |
| -------------------------------- | ------------ | ------------------------------------------------------------ |
| `nombre`                         | String       | Nombre público del usuario                                   |
| `img_perfil`                     | String\|null | URL de la imagen de perfil                                   |
| `trayectos.total_como_conductor` | Int          | Total de trayectos como conductor                            |
| `trayectos.finalizados`          | Int          | Trayectos finalizados como conductor                         |
| `comentarios.recibidos`          | Int          | Comentarios recibidos sobre el usuario                       |
| `comentarios.rating_promedio`    | Float\|null  | Rating promedio recibido (1-10), `null` si sin valoraciones  |
| `pasajeros_transportados`        | Int          | Reservas `completed` en trayectos del usuario como conductor |
| `cae.km_recorridos`              | Float        | km totales recorridos como conductor                         |
| `cae.kwh_generados`              | Float        | kWh totales generados (ahorro energético)                    |
| `cae.eur_generados`              | Float        | EUR totales generados (ahorro económico)                     |

**Errores:**

- `400` — `userId` no proporcionado.
- `404` — Usuario no encontrado.
- `500` — Error en el servidor.
