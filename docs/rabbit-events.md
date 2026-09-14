# Eventos del microservicio `carpooling-trayectos`

Todos los eventos se publican en el exchange **`carpooling_events`** (tipo `topic`) de RabbitMQ.

## Estructura del mensaje

Todos los mensajes siguen el mismo formato:

```json
{
  "event": "reserva.created.free",
  "source": "carpooling-trayectos",
  "timestamp": "2026-08-09T10:30:00.000Z",
  "data": { ... }
}
```

| Campo       | Tipo     | Descripción                                           |
| ----------- | -------- | ----------------------------------------------------- |
| `event`     | `string` | Routing key del evento (ej. `reserva.created.free`)   |
| `source`    | `string` | Microservicio emisor (siempre `carpooling-trayectos`) |
| `timestamp` | `string` | ISO 8601 del momento de publicación                   |
| `data`      | `object` | Payload específico del evento                         |

---

## Reservas

### `reserva.created.free`

Se emite cuando se crea una reserva para un trayecto gratuito (precio_conductor = 0). La reserva se crea directamente en estado `completed`.

| Campo          | Tipo      | Descripción                   |
| -------------- | --------- | ----------------------------- |
| `id_reserva`   | `string`  | ID de la reserva creada       |
| `user_id`      | `string`  | ID del usuario que reserva    |
| `trayecto_id`  | `string`  | ID del trayecto               |
| `conductor_id` | `string`  | ID del conductor del trayecto |
| `status`       | `string`  | Siempre `"completed"`         |
| `is_free`      | `boolean` | Siempre `true`                |

**Controladores que lo emiten:** `reserva.js` (`addReserva`, `reservaQR`)

---

### `reserva.created.payment_required` (DEPRECATED)

> **Deprecado:** La creación de sesiones de pago ahora se realiza con una llamada HTTP síncrona a `POST /api/payment/payment-intent/checkout` en la API de pagos. El `stripe_url` se devuelve directamente en la respuesta de `POST /api/reserva`.

| Campo                       | Tipo      | Descripción                              |
| --------------------------- | --------- | ---------------------------------------- |
| `id_reserva`                | `string`  | ID de la reserva creada                  |
| `user_id`                   | `string`  | ID del usuario que reserva               |
| `trayecto_id`               | `string`  | ID del trayecto                          |
| `conductor_id`              | `string`  | ID del conductor del trayecto            |
| `status`                    | `string`  | Siempre `"pending"`                      |
| `is_free`                   | `boolean` | Siempre `false`                          |
| `payment`                   | `object`  | Información del pago necesario           |
| `payment.amount`            | `number`  | Importe total en céntimos (con comisión) |
| `payment.currency`          | `string`  | Moneda (ej. `"eur"`)                     |
| `payment.recipient_user_id` | `string`  | ID del conductor (receptor del pago)     |
| `payment.description`       | `string`  | Descripción del pago                     |
| `payment.success_url`       | `string`  | URL de redirección tras pago exitoso     |
| `payment.cancel_url`        | `string`  | URL de redirección tras cancelación      |

**Controladores que lo emiten:** `reserva.js` (`addReserva`, `reservaQR`)

---

### `reserva.chat.join`

Se emite cuando se crea una reserva (gratuita o de pago) para que el microservicio de mensajes añada al usuario al chat del trayecto. Sustituye a las llamadas HTTP síncronas `GET /api/chats/trip/{trayecto_id}` + `POST /api/chats/{chatId}/join`.

| Campo          | Tipo     | Descripción                                |
| -------------- | -------- | ------------------------------------------ |
| `id_reserva`   | `string` | ID de la reserva creada                    |
| `user_id`      | `string` | ID del usuario que se une al chat          |
| `trayecto_id`  | `string` | ID del trayecto (para identificar el chat) |
| `conductor_id` | `string` | ID del conductor del trayecto              |

**Controladores que lo emiten:** `reserva.js` (`addReserva`)

**Microservicio consumidor esperado:** `carpooling-mensajes`

**Acción esperada:** El microservicio de mensajes debe buscar el chat asociado al `trayecto_id` y añadir al `user_id` como participante.

---

### `reserva.chat.leave`

Se emite cuando un usuario cancela/elimina su reserva para que el microservicio de mensajes lo elimine del chat del trayecto. Sustituye a las llamadas HTTP síncronas `GET /api/chats/trip/{trayecto_id}` + `POST /api/chats/{chatId}/leave`.

| Campo         | Tipo     | Descripción                                |
| ------------- | -------- | ------------------------------------------ |
| `id_reserva`  | `string` | ID de la reserva cancelada                 |
| `user_id`     | `string` | ID del usuario que sale del chat           |
| `trayecto_id` | `string` | ID del trayecto (para identificar el chat) |

**Controladores que lo emiten:** `reserva.js` (`deleteReserva`)

**Microservicio consumidor esperado:** `carpooling-mensajes`

**Acción esperada:** El microservicio de mensajes debe buscar el chat asociado al `trayecto_id` y eliminar al `user_id` como participante.

---

### `reserva.payment.resume` (DEPRECATED)

> **Deprecado:** El pago ahora se gestiona con una llamada HTTP síncrona a `POST /api/payment/payment-intent/resume` en la API de pagos. El `stripe_url` se devuelve directamente en la respuesta.

---

## Eventos consumidos (recibidos de otros microservicios)

### `user.deleted`

Se recibe del microservicio de usuarios cuando se elimina un usuario.

**Handler:** `consumer.js` (`handleUserDeleted`)

**Acción:** Cancela todas las reservas `pending` del usuario, libera plazas y cancela sus trayectos como conductor.

---

### `user.updated`

Se recibe del microservicio de usuarios cuando se actualiza un perfil.

**Handler:** `consumer.js` (`handleUserUpdated`)

**Acción:** Sin acción requerida (solo log).

---

### `car.deleted`

Se recibe del microservicio de usuarios cuando se elimina un coche.

**Handler:** `consumer.js` (`handleCarDeleted`)

**Acción:** Cancela los trayectos activos asociados al coche, cancela sus reservas `pending` y resetea `disponible`.

---

### `payment_intent.captured`

Se recibe del microservicio de pagos cuando se captura un payment intent con éxito.

**Handler:** `consumer.js` (`handlePaymentIntentCaptured`)

**Acción:** Marca la reserva como `completed` y guarda el `stripe_payment_intent_id`.

---

### `payment_intent.succeeded`

Se recibe del microservicio de pagos cuando un payment intent se completa con éxito.

**Handler:** `consumer.js` (`handlePaymentIntentSucceeded`)

**Acción:** Marca la reserva como `completed` y guarda el `stripe_payment_intent_id`.

---

### `payment_intent.failed`

Se recibe del microservicio de pagos cuando un payment intent falla.

**Handler:** `consumer.js` (`handlePaymentIntentFailed`)

**Acción:** Cancela la reserva y libera la plaza del trayecto.

---

### `payment_intent.canceled`

Se recibe del microservicio de pagos cuando un payment intent se cancela.

**Handler:** `consumer.js` (`handlePaymentIntentCanceled`)

**Acción:** Cancela la reserva y libera la plaza del trayecto.

---

### `checkout_session.expired`

Se recibe del microservicio de pagos cuando una Checkout Session de Stripe expira sin completarse.

**Handler:** `consumer.js` (`handleCheckoutSessionExpired`)

**Acción:** Cancela la reserva `pending` y libera la plaza del trayecto.

---

### `platform_event.deleted`

Se recibe del microservicio de usuarios cuando se elimina un evento de plataforma.

**Handler:** `consumer.js` (`handlePlatformEventDeleted`)

**Acción:** Cancela los trayectos activos asociados al evento, cancela sus reservas `pending` y resetea `disponible`.

---

## Patrones de suscripción

Para consumir eventos desde otro microservicio, usar routing key patterns del exchange `topic`:

| Pattern                | Eventos recibidos                       |
| ---------------------- | --------------------------------------- |
| `reserva.created.free` | Solo reservas gratuitas                 |
| `reserva.created.*`    | Todas las reservas creadas (gratuitas)  |
| `reserva.chat.join`    | Unión de usuario al chat del trayecto   |
| `reserva.chat.leave`   | Salida de usuario del chat del trayecto |
| `payment_intent.*`     | Todos los eventos de estado de pago     |
| `reserva.*`            | Todos los eventos de reservas           |

## Configuración de conexión

| Variable            | Valor por defecto                                | Descripción          |
| ------------------- | ------------------------------------------------ | -------------------- |
| `RABBITMQ_URL`      | `amqp://carpooling:carpooling123@localhost:5672` | URL de conexión AMQP |
| `RABBITMQ_EXCHANGE` | `carpooling_events`                              | Nombre del exchange  |

### URLs según contexto

| Contexto                        | URL                                              |
| ------------------------------- | ------------------------------------------------ |
| Local (Node.js fuera de Docker) | `amqp://carpooling:carpooling123@localhost:5672` |
| Docker Compose (mismo network)  | `amqp://carpooling:carpooling123@rabbitmq:5672`  |
| Panel de gestión web            | `http://localhost:15672`                         |
