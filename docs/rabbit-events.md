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

### `reserva.created.payment_required`

Se emite cuando se crea una reserva para un trayecto de pago. La reserva queda en estado `pending` hasta que el microservicio de pagos confirme el pago.

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

### `reserva.payment.resume`

Se emite cuando un usuario quiere retomar el pago de una reserva pendiente. El microservicio de pagos debe generar una nueva sesión de checkout o reanudar la existente.

| Campo                       | Tipo             | Descripción                              |
| --------------------------- | ---------------- | ---------------------------------------- |
| `id_reserva`                | `string`         | ID de la reserva                         |
| `user_id`                   | `string`         | ID del usuario que retoma el pago        |
| `trayecto_id`               | `string`         | ID del trayecto                          |
| `conductor_id`              | `string`         | ID del conductor del trayecto            |
| `return_url`                | `string \| null` | URL de retorno opcional                  |
| `payment`                   | `object`         | Información del pago necesario           |
| `payment.amount`            | `number`         | Importe total en céntimos (con comisión) |
| `payment.currency`          | `string`         | Moneda (ej. `"eur"`)                     |
| `payment.recipient_user_id` | `string`         | ID del conductor (receptor del pago)     |
| `payment.description`       | `string`         | Descripción del pago                     |
| `payment.success_url`       | `string`         | URL de redirección tras pago exitoso     |
| `payment.cancel_url`        | `string`         | URL de redirección tras cancelación      |

**Controladores que lo emiten:** `reserva.js` (`retomarPagoReserva`)

---

## Patrones de suscripción

Para consumir eventos desde otro microservicio, usar routing key patterns del exchange `topic`:

| Pattern                            | Eventos recibidos                                |
| ---------------------------------- | ------------------------------------------------ |
| `reserva.created.free`             | Solo reservas gratuitas                          |
| `reserva.created.payment_required` | Solo reservas que requieren pago                 |
| `reserva.created.*`                | Todas las reservas creadas (gratuitas y de pago) |
| `reserva.payment.resume`           | Solo retomar pago                                |
| `reserva.*`                        | Todos los eventos de reservas                    |

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
