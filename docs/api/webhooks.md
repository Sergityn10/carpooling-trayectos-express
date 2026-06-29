# Webhooks (`/api/webhook`)

Endpoint para recibir y procesar eventos webhook de Stripe y otras fuentes externas.

---

## 1. Recibir evento de Webhook

**URL:** `POST /api/webhook/:source`

**Autenticación:** No requerida (verificación via firma de Stripe).

**Descripción:** Recibe un evento webhook de una fuente externa (principalmente Stripe). Para Stripe, el body se recibe como raw (sin parsear JSON) y se verifica la firma usando `STRIPE_WEBHOOK_SECRET`. El evento se almacena en la tabla `events` con idempotencia (upsert por `event_id`). Si es de Stripe, se procesa según el tipo de evento.

**Parámetros de URL:**
- `source` — Identificador de la fuente (ej: `stripe`).

**Headers (para Stripe):**
- `stripe-signature` — Firma del evento para verificación.

**Body:**
- Para Stripe: raw body (Buffer) con el payload del evento.
- Para otras fuentes: JSON parseado normalmente.

**Procesamiento de eventos de Stripe:**

El controlador maneja automáticamente los siguientes tipos de eventos:

| Tipo de evento | Descripción |
|---|---|
| `account.created` / `account.updated` | Actualiza el estado de la cuenta Connect en BD |
| `checkout.session.completed` | Procesa recargas de monedero y reservas completadas |
| `checkout.session.expired` | Marca sesiones expiradas |
| `checkout.session.updated` | Actualiza sesiones modificadas |
| `payment_intent.created` | Registra el payment intent en BD |
| `payment_intent.updated` | Actualiza estado en reservas, recargas y transacciones |
| `payment_intent.succeeded` | **Importante:** Reparte el pago entre pagador, receptor y plataforma (comisión 15%). Crea transacciones de wallet para los 3 actores. |
| `payment_intent.failed` | Marca reserva/recarga/transacción como fallida |
| `payment_intent.canceled` | Marca payment intent y reserva como cancelados |
| `customer.created` / `customer.updated` | Sincroniza el `stripe_customer_account` en BD |
| `customer.deleted` | (No implementado) |
| `charge.succeeded` | (No implementado) |
| `payout.*` | Sincroniza el estado de payouts del monedero (succeeded/failed/canceled). Reembolsa el saldo si falla. |

**Salida (200):**
```json
{
  "status": "Success",
  "message": "Event created successfully"
}
```

**Salida (500, solo Stripe):**
```json
{
  "status": "Error",
  "message": "Stripe event received but processing failed"
}
```

> **Importante:** Para eventos de Stripe que fallan, se devuelve HTTP 500 para que Stripe reintente. La idempotencia está garantizada por la tabla `events` (upsert por `event_id`).

---

## Flujo de `payment_intent.succeeded`

Este es el evento más importante. Cuando un payment intent de reserva se completa:

1. Identifica al pagador y receptor via `stripe_account` en BD.
2. Calcula comisión (15% del monto bruto) y monto neto.
3. En una transacción:
   - Descuenta el monto bruto del monedero del pagador (`reservation_payment`).
   - Acredita el monto neto al monedero del receptor (`reservation_revenue`).
   - Acredita la comisión al monedero de la plataforma (`commision`).
4. Marca la reserva como `completed`.

---

## Flujo de `payout.*`

Cuando se recibe un evento de payout de Stripe:

1. Busca el payout en BD por `stripe_payout_id` o por `metadata.wallet_payout_id`.
2. Si ya está en estado final (`succeeded`, `failed`, `canceled`), ignora.
3. Actualiza el estado en `wallet_payouts` y `wallet_transactions`.
4. Si el payout falla o se cancela, reembolsa el saldo al monedero del usuario.

---

## Notas generales

- **Verificación de firma:** Usa `STRIPE_WEBHOOK_SECRET` o `STRIPE_WEBHOOK_SECRET_KEY`.
- **Tabla `events`:** Registra todos los eventos con `event_id`, `event_type`, `data` (JSON), `source`, `status` y `processing_error`.
- **Estados de eventos:** `pending` (1), `succeeded` (2), `failed` (3), `canceled` (4), `abandoned` (5), `updated` (6), `expired` (7), `completed` (8).
- **Middleware especial:** El body del webhook de Stripe se procesa como raw (sin `express.json()`) para poder verificar la firma.
