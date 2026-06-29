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

**Descripción:** Devuelve todas las reservas del usuario autenticado, incluyendo los datos del trayecto asociado y la información del conductor. El `userIdParam` debe coincidir con el ID del usuario autenticado.

**Path params:**

| Parámetro     | Tipo          | Descripción                                                |
| ------------- | ------------- | ---------------------------------------------------------- |
| `userIdParam` | string (UUID) | ID del usuario (debe coincidir con el usuario autenticado) |

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
  ]
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
