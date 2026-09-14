# Eventos del microservicio `carpooling-user`

Todos los eventos se publican en el exchange **`carpooling_events`** (tipo `topic`) de RabbitMQ.

## Estructura del mensaje

Todos los mensajes siguen el mismo formato:

```json
{
  "event": "user.registered",
  "source": "carpooling-user",
  "timestamp": "2026-08-09T07:21:00.000Z",
  "data": { ... }
}
```

| Campo       | Tipo     | Descripción                                      |
| ----------- | -------- | ------------------------------------------------ |
| `event`     | `string` | Routing key del evento (ej. `user.registered`)   |
| `source`    | `string` | Microservicio emisor (siempre `carpooling-user`) |
| `timestamp` | `string` | ISO 8601 del momento de publicación              |
| `data`      | `object` | Payload específico del evento                    |

---

## Usuario

### `user.registered`

Se emite cuando un usuario se registra (email/password o Google OAuth).

| Campo         | Tipo     | Descripción                                     |
| ------------- | -------- | ----------------------------------------------- |
| `user_id`     | `string` | ID del usuario creado                           |
| `email`       | `string` | Email del usuario                               |
| `auth_method` | `string` | Método de autenticación (`password` o `google`) |
| `role`        | `string` | Rol asignado (ej. `user`, `admin`)              |

**Controladores que lo emiten:** `authentication.js` (`register`, `oauthGoogleAndroid`)

---

### `user.login`

Se emite cuando un usuario inicia sesión correctamente.

| Campo     | Tipo     | Descripción       |
| --------- | -------- | ----------------- |
| `user_id` | `string` | ID del usuario    |
| `email`   | `string` | Email del usuario |
| `role`    | `string` | Rol del usuario   |

**Controladores que lo emiten:** `authentication.js` (`login`, `oauthGoogleAndroid`)

---

### `user.updated`

Se emite cuando un usuario actualiza su perfil (propio o por admin).

| Campo       | Tipo     | Descripción                                                   |
| ----------- | -------- | ------------------------------------------------------------- |
| `user_id`   | `string` | ID del usuario actualizado                                    |
| `...fields` | `object` | Campos actualizados (name, surname, phone, dni, ciudad, etc.) |

**Controladores que lo emiten:** `user.js` (`updateUserPatch`, `updateMyUserPatch`)

---

### `user.deleted`

Se emite cuando se elimina un usuario.

| Campo        | Tipo     | Descripción                                                 |
| ------------ | -------- | ----------------------------------------------------------- |
| `user_id`    | `string` | ID del usuario eliminado                                    |
| `deleted_by` | `string` | `self` si se borró a sí mismo, `admin` si lo borró un admin |

**Controladores que lo emiten:** `user.js` (`removeUser`)

---

## Coches

### `car.created`

Se emite cuando un usuario registra un nuevo coche.

| Campo     | Tipo     | Descripción               |
| --------- | -------- | ------------------------- |
| `car_id`  | `string` | ID del coche (`id_coche`) |
| `user_id` | `string` | ID del propietario        |

**Controladores que lo emiten:** `cars.js` (`createCar`)

---

### `car.updated`

Se emite cuando se actualiza un coche.

| Campo       | Tipo     | Descripción                                      |
| ----------- | -------- | ------------------------------------------------ |
| `car_id`    | `string` | ID del coche (`id_coche`)                        |
| `...fields` | `object` | Campos actualizados (marca, modelo, color, etc.) |

**Controladores que lo emiten:** `cars.js` (`updateCar`)

---

### `car.deleted`

Se emite cuando se elimina un coche.

| Campo    | Tipo     | Descripción            |
| -------- | -------- | ---------------------- |
| `car_id` | `string` | ID del coche eliminado |

**Controladores que lo emiten:** `cars.js` (`removeCar`)

---

## Eventos de plataforma

### `platform_event.created`

Se emite cuando se crea un evento de plataforma.

| Campo         | Tipo             | Descripción                          |
| ------------- | ---------------- | ------------------------------------ |
| `event_id`    | `string`         | ID del evento creado                 |
| `name`        | `string`         | Nombre del evento                    |
| `company_id`  | `string \| null` | ID de la empresa asociada (si tiene) |
| `unique_code` | `string`         | Código único de acceso al evento     |

**Controladores que lo emiten:** `events.js` (`createEvent`)

---

### `platform_event.updated`

Se emite cuando se actualiza un evento de plataforma.

| Campo       | Tipo     | Descripción                                                      |
| ----------- | -------- | ---------------------------------------------------------------- |
| `event_id`  | `string` | ID del evento                                                    |
| `...fields` | `object` | Campos actualizados (name, description, image, start_date, etc.) |

**Controladores que lo emiten:** `events.js` (`updateEvent`)

---

### `platform_event.deleted`

Se emite cuando se elimina un evento de plataforma.

| Campo      | Tipo     | Descripción             |
| ---------- | -------- | ----------------------- |
| `event_id` | `string` | ID del evento eliminado |

**Controladores que lo emiten:** `events.js` (`deleteEvent`)

---

### `platform_event.joined`

Se emite cuando un usuario se une a un evento.

| Campo      | Tipo     | Descripción               |
| ---------- | -------- | ------------------------- |
| `event_id` | `string` | ID del evento             |
| `user_id`  | `string` | ID del usuario que se une |

**Controladores que lo emiten:** `events.js` (`joinEvent`)

---

### `platform_event.left`

Se emite cuando un usuario abandona un evento.

| Campo      | Tipo     | Descripción                 |
| ---------- | -------- | --------------------------- |
| `event_id` | `string` | ID del evento               |
| `user_id`  | `string` | ID del usuario que abandona |

**Controladores que lo emiten:** `events.js` (`leaveEvent`)

---

## Pagos (Stripe)

### `payment_intent.created`

Se emite cuando se crea un Payment Intent de Stripe.

| Campo               | Tipo             | Descripción                                                                        |
| ------------------- | ---------------- | ---------------------------------------------------------------------------------- |
| `payment_intent_id` | `string`         | ID del Stripe Payment Intent                                                       |
| `amount`            | `number`         | Importe en céntimos                                                                |
| `currency`          | `string`         | Moneda (ej. `eur`)                                                                 |
| `state`             | `string`         | Estado inicial (`requires_payment_method`, etc.)                                   |
| `mapped_status`     | `string \| null` | Estado mapeado para la reserva (`completed` o `pending`, solo si hay `id_reserva`) |
| `id_reserva`        | `string \| null` | ID de la reserva asociada (si aplica)                                              |

**Controladores que lo emiten:** `webhook.js` (`handleCheckoutSessionCompleted`, `handlePaymentIntentCreated`)

---

### `payment_intent.succeeded`

Se emite cuando un Payment Intent se completa con éxito.

| Campo               | Tipo             | Descripción                    |
| ------------------- | ---------------- | ------------------------------ |
| `payment_intent_id` | `string`         | ID del Stripe Payment Intent   |
| `amount`            | `number`         | Importe en euros (no céntimos) |
| `currency`          | `string`         | Moneda                         |
| `payer_user_id`     | `string`         | ID del usuario que paga        |
| `receiver_user_id`  | `string`         | ID del usuario que recibe      |
| `id_reserva`        | `string \| null` | ID de la reserva asociada      |

**Controladores que lo emiten:** `webhook.js` (`handlePaymentIntentSucceeded`)

---

### `payment_intent.captured`

Se emite cuando un Payment Intent se captura con éxito y hay una reserva asociada. El microservicio de trayectos debe consumir este evento para marcar la reserva como `completed`.

| Campo                     | Tipo             | Descripción                                |
| ------------------------- | ---------------- | ------------------------------------------ |
| `payment_intent_id`       | `string`         | ID del Stripe Payment Intent               |
| `id_reserva`              | `string \| null` | ID de la reserva asociada                  |
| `gross_amount_cents`      | `number`         | Importe bruto en céntimos                  |
| `net_amount_cents`        | `number`         | Importe neto para el conductor en céntimos |
| `commission_amount_cents` | `number`         | Comisión de la plataforma en céntimos      |
| `currency`                | `string`         | Moneda (ej. `eur`)                         |
| `payer_user_id`           | `string`         | ID del usuario que paga                    |
| `receiver_user_id`        | `string`         | ID del usuario que recibe (conductor)      |

**Controladores que lo emiten:** `webhook.js` (`handlePaymentIntentSucceeded`)

---

### `payment_intent.failed`

Se emite cuando un Payment Intent falla.

| Campo               | Tipo             | Descripción                                 |
| ------------------- | ---------------- | ------------------------------------------- |
| `payment_intent_id` | `string`         | ID del Stripe Payment Intent                |
| `id_reserva`        | `string \| null` | ID de la reserva asociada                   |
| `mapped_status`     | `string \| null` | Estado mapeado para la reserva (`canceled`) |

**Controladores que lo emiten:** `webhook.js` (`handlePaymentIntentFailed`)

---

### `payment_intent.canceled`

Se emite cuando un Payment Intent se cancela.

| Campo               | Tipo             | Descripción                                 |
| ------------------- | ---------------- | ------------------------------------------- |
| `payment_intent_id` | `string`         | ID del Stripe Payment Intent                |
| `id_reserva`        | `string \| null` | ID de la reserva asociada                   |
| `mapped_status`     | `string \| null` | Estado mapeado para la reserva (`canceled`) |

**Controladores que lo emiten:** `webhook.js` (`handlePaymentIntentCanceled`)

---

### `stripe.account.updated`

Se emite cuando Stripe actualiza el estado de una cuenta Connect.

| Campo                 | Tipo      | Descripción                               |
| --------------------- | --------- | ----------------------------------------- |
| `user_id`             | `string`  | ID del usuario propietario de la cuenta   |
| `stripe_account_id`   | `string`  | ID de la cuenta Stripe Connect            |
| `charges_enabled`     | `boolean` | Si la cuenta puede recibir cobros         |
| `transfers_enabled`   | `boolean` | Si la cuenta puede recibir transferencias |
| `details_submitted`   | `boolean` | Si el onboarding está completo            |
| `onboarding_complete` | `boolean` | Si el onboarding ha finalizado            |

**Controladores que lo emiten:** `webhook.js` (`handleAccountUpdated`)

---

### `checkout_session.expired`

Se emite cuando una Checkout Session de Stripe expira sin completarse. El microservicio de trayectos debe consumir este evento para marcar la reserva como `canceled`.

| Campo           | Tipo             | Descripción                                 |
| --------------- | ---------------- | ------------------------------------------- |
| `id_reserva`    | `string \| null` | ID de la reserva asociada                   |
| `mapped_status` | `string`         | Estado mapeado para la reserva (`canceled`) |

**Controladores que lo emiten:** `webhook.js` (`handleCheckoutSessionExpired`)

---

## Eventos de empresa (Enterprise Service Events)

### `enterprise_service_event.created`

Se emite cuando una empresa crea un evento de servicio.

| Campo              | Tipo     | Descripción                      |
| ------------------ | -------- | -------------------------------- |
| `service_event_id` | `number` | ID del evento de servicio creado |
| `enterprise_id`    | `number` | ID de la empresa                 |
| `title`            | `string` | Título del evento                |

**Controladores que lo emiten:** `enterprise_service_events.js` (`create`)

---

### `enterprise_service_event.updated`

Se emite cuando se actualiza un evento de servicio.

| Campo              | Tipo     | Descripción               |
| ------------------ | -------- | ------------------------- |
| `service_event_id` | `number` | ID del evento de servicio |
| `...fields`        | `object` | Campos actualizados       |

**Controladores que lo emiten:** `enterprise_service_events.js` (`patch`)

---

### `enterprise_service_event.deleted`

Se emite cuando se elimina un evento de servicio.

| Campo              | Tipo     | Descripción                         |
| ------------------ | -------- | ----------------------------------- |
| `service_event_id` | `number` | ID del evento de servicio eliminado |

**Controladores que lo emiten:** `enterprise_service_events.js` (`remove`)

---

## Sugerencias de promotoras

### `suggestion.created`

Se emite cuando un usuario sugiere una empresa promotora.

| Campo           | Tipo             | Descripción                    |
| --------------- | ---------------- | ------------------------------ |
| `suggestion_id` | `number`         | ID de la sugerencia            |
| `company_name`  | `string`         | Nombre de la empresa sugerida  |
| `company_email` | `string`         | Email de la empresa            |
| `website`       | `string \| null` | Web de la empresa (si tiene)   |
| `user_name`     | `string \| null` | Nombre del usuario que sugiere |
| `user_email`    | `string \| null` | Email del usuario que sugiere  |

**Controladores que lo emiten:** `suggestions.js` (`createSuggestion`)

---

### `suggestion.accepted`

Se emite cuando un admin acepta una sugerencia y se crea la empresa.

| Campo           | Tipo     | Descripción                  |
| --------------- | -------- | ---------------------------- |
| `suggestion_id` | `number` | ID de la sugerencia aceptada |
| `company_id`    | `number` | ID de la empresa creada      |

**Controladores que lo emiten:** `suggestions.js` (`acceptSuggestion`)

---

## Checkout de pagos (respuesta a trayectos)

### `payment.checkout.created`

Se emite cuando el microservicio de pagos crea una Stripe Checkout Session para una reserva. El microservicio de trayectos debe consumir este evento para almacenar la URL del checkout y el ID del payment intent asociados a la reserva.

| Campo                 | Tipo             | Descripción                        |
| --------------------- | ---------------- | ---------------------------------- |
| `id_reserva`          | `string \| null` | ID de la reserva asociada          |
| `checkout_session_id` | `string`         | ID de la Stripe Checkout Session   |
| `checkout_url`        | `string`         | URL de la página de pago de Stripe |
| `payment_intent_id`   | `string`         | ID del Stripe Payment Intent       |
| `amount`              | `number`         | Importe total en céntimos          |
| `currency`            | `string`         | Moneda (ej. `eur`)                 |
| `status`              | `string`         | Estado inicial (`pending`)         |

**Controladores que lo emiten:** `paymentEventHandler.js` (`handleReservaPaymentRequired`, `handleReservaPaymentResume`)

---

## Eventos consumidos desde `carpooling-trayectos`

El microservicio `carpooling-user` escucha los siguientes eventos emitidos por `carpooling-trayectos`:

### `reserva.created.payment_required`

Cuando se recibe este evento, se crea una Stripe Checkout Session con el Payment Intent y se persiste en BD. Se emite `payment.checkout.created` como respuesta.

### `reserva.payment.resume`

Cuando se recibe este evento, se crea una nueva Checkout Session para retomar el pago de una reserva pendiente. Se emite `payment.checkout.created` como respuesta.

---

## Patrones de suscripción

Para consumir eventos desde otro microservicio, usar routing key patterns del exchange `topic`:

| Pattern                      | Eventos recibidos                                                           |
| ---------------------------- | --------------------------------------------------------------------------- |
| `user.*`                     | `user.registered`, `user.login`, `user.updated`, `user.deleted`             |
| `car.*`                      | `car.created`, `car.updated`, `car.deleted`                                 |
| `platform_event.*`           | Todos los eventos de plataforma                                             |
| `payment_intent.*`           | `payment_intent.created`, `.captured`, `.succeeded`, `.failed`, `.canceled` |
| `payment.checkout.created`   | Solo creación de checkout de pago                                           |
| `checkout_session.expired`   | Solo expiración de checkout                                                 |
| `stripe.account.updated`     | Solo actualizaciones de cuenta Stripe                                       |
| `enterprise_service_event.*` | Todos los eventos de empresa                                                |
| `suggestion.*`               | `suggestion.created`, `suggestion.accepted`                                 |
| `#`                          | **Todos los eventos**                                                       |

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
