# Pagos y Stripe (`/api/payment`)

Endpoints para gestión de pagos, cuentas Stripe Connect, clientes Stripe, monedero virtual (wallet), payment intents, payouts y recargas. La mayoría requieren autenticación.

---

## 1. Crear sesión de checkout

**URL:** `POST /api/payment/session`

**Autenticación:** No requerida.

**Descripción:** Crea una sesión de Stripe Checkout genérica para un pago simple.

**Entrada (body JSON):**
```json
{
  "amount": "number (en céntimos)",
  "description": "string",
  "success_url": "string (URL de éxito)",
  "cancel_url": "string (URL de cancelación)"
}
```

**Salida (200):** Objeto sesión de Stripe Checkout.

---

## 2. Crear cuenta Stripe Connect

**URL:** `POST /api/payment/stripe-connect`

**Autenticación:** Requerida (`isLoged`).

**Descripción:** Crea una cuenta Stripe Connect tipo "express" para el usuario. Si ya tiene una y no ha completado el onboarding, genera un link de onboarding. Si ya completó el onboarding, devuelve error.

**Entrada (body JSON):**
```json
{
  "email": "string (email)",
  "country": "string (ej: ES)",
  "name": "string (nombre completo)"
}
```

**Salida (200):**
```json
{
  "status": "Success",
  "message": "Stripe account created successfully",
  "accountLink": {
    "url": "https://connect.stripe.com/...",
    "expires_at": 1234567890
  }
}
```

**Errores:**
- `400` — Ya tiene cuenta y onboarding completado.
- `500` — Error de configuración o de Stripe.

---

## 3. Obtener link de onboarding (Account Link)

**URL:** `GET /api/payment/stripe-connect-link`

**Autenticación:** Requerida (`isLoged`).

**Descripción:** Genera un link de onboarding para la cuenta Stripe Connect del usuario autenticado. Útil para reanudar el onboarding si no se completó. Acepta `return_url` y `refresh_url` opcionales como query params; si no se proporcionan, se usa `process.env.ORIGIN`.

**Query params (opcionales):**
- `return_url` — URL de retorno tras completar el onboarding (default: `process.env.ORIGIN`).
- `refresh_url` — URL de refresco si el link expira (default: `process.env.ORIGIN`).

**Salida (200):**
```json
{
  "status": "Success",
  "message": "Stripe onboarding link created successfully",
  "accountLink": {
    "url": "https://connect.stripe.com/...",
    "expires_at": 1234567890
  }
}
```

**Errores:**
- `404` — No tiene cuenta Stripe.
- `500` — Error.

---

## 4. Obtener mi cuenta Stripe Connect

**URL:** `GET /api/payment/stripe-connect`

**Autenticación:** Requerida (`isLoged`).

**Descripción:** Recupera los datos de la cuenta Stripe Connect del usuario autenticado desde Stripe.

**Salida (200):**
```json
{
  "status": "Success",
  "message": "Stripe account created successfully",
  "account": { ... }
}
```

**Errores:**
- `404` — No tiene cuenta Stripe.

---

## 5. Crear cliente Stripe

**URL:** `POST /api/payment/stripe-customer`

**Autenticación:** Requerida (`isLoged`).

**Descripción:** Crea un cliente en Stripe y lo asocia al usuario en BD.

**Entrada (body JSON):**
```json
{
  "email": "string",
  "name": "string"
}
```

**Salida (200):**
```json
{
  "status": "Success",
  "message": "Stripe customer created successfully",
  "customer": { ... }
}
```

**Errores:**
- `400` — Ya tiene cliente Stripe.
- `500` — Error al crear.

---

## 6. Obtener mi cliente Stripe

**URL:** `GET /api/payment/stripe-customer`

**Autenticación:** Requerida (`isLoged`).

**Descripción:** Recupera los datos del cliente Stripe del usuario autenticado.

**Salida (200):**
```json
{
  "status": "Success",
  "message": "Stripe customer created successfully",
  "customer": { ... }
}
```

**Errores:**
- `404` — No tiene cliente Stripe.

---

## 7. Crear link de cuenta Stripe

**URL:** `POST /api/payment/stripe-link`

**Autenticación:** Requerida (`isLoged`).

**Descripción:** Genera un link de onboarding para la cuenta Stripe Connect del usuario. Acepta `return_url` y `refresh_url` opcionales; si no se proporcionan, se usa `process.env.ORIGIN`.

**Entrada (body JSON):**
```json
{
  "return_url": "string",
  "refresh_url": "string"
}
```

**Salida (200):**
```json
{
  "status": "Success",
  "message": "Stripe account created successfully",
  "accountLink": { ... }
}
```

---

## 8. Crear transferencia Stripe

**URL:** `POST /api/payment/stripe-transfer`

**Autenticación:** Requerida (`isLoged`).

**Descripción:** Crea una transferencia de Stripe a otra cuenta.

**Entrada (body JSON):**
```json
{
  "amount": "number (céntimos)",
  "currency": "string (ej: eur)",
  "destination": "string (account ID)"
}
```

**Salida (200):**
```json
{
  "status": "Success",
  "message": "Stripe transfer created successfully",
  "transfer": { ... }
}
```

---

## 9. Crear login link de Stripe

**URL:** `POST /api/payment/stripe-login-link`

**Autenticación:** Requerida (`isLoged`).

**Descripción:** Genera un link de login al dashboard de Stripe para la cuenta Connect del usuario. **Requiere que el onboarding esté completado** (`onboarding_ended: true`). Si no se ha completado, devuelve error indicando que debe usar `POST /api/payment/stripe-connect-link` primero.

**Entrada (body JSON, opcional):**
```json
{
  "return_url": "string",
  "refresh_url": "string"
}
```

**Salida (200):**
```json
{
  "status": "Success",
  "message": "Stripe login link created successfully",
  "loginLink": { ... }
}
```

**Errores:**
- `400` — Onboarding no completado o error de Stripe.
- `404` — No tiene cuenta Stripe.

---

## 10. Crear sesión del Billing Portal

**URL:** `GET /api/payment/stripe-billing-portal`

**Autenticación:** Requerida (`isLoged`).

**Descripción:** Crea una sesión del Stripe Billing Portal para que el cliente gestione sus métodos de pago.

**Salida (200):**
```json
{
  "status": "Success",
  "message": "Stripe billing portal created successfully",
  "billingPortal": { ... }
}
```

---

## 11. Obtener balance de efectivo (Stripe)

**URL:** `GET /api/payment/cash-balance`

**Autenticación:** Requerida (`isLoged`).

**Descripción:** Obtiene el balance disponible y pendiente de la cuenta Stripe Connect del usuario (en EUR).

**Salida (200):**
```json
{
  "status": "Success",
  "message": "Cash balance retrieved successfully",
  "cashBalance": { ... },
  "availableAmount": "150.00",
  "pendingAmount": "50.00"
}
```

**Errores:**
- `404` — No tiene cuenta Stripe.

---

## 12. Obtener balance del monedero (Wallet)

**URL:** `GET /api/payment/wallet-balance`

**Autenticación:** Requerida (`isLoged`).

**Descripción:** Devuelve el balance del monedero virtual del usuario desde la tabla local `wallet_accounts`. Si no existe, hace fallback a `wallet_recharges` con status `succeeded`. Adicionalmente, consulta el microservicio de trayectos para obtener el balance de informes CAE (Certificados de Ahorro de Energía) del conductor.

**Salida (200):**
```json
{
  "status": "Success",
  "balances": [
    { "currency": "eur", "balance_cents": 15000 }
  ],
  "cae": {
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
}
```

> **Nota:** El campo `cae` puede ser `null` si el microservicio de trayectos no está disponible o el usuario no tiene informes CAE. Los importes de CAE (`en_revision`, `disponible`, `cancelado`, `total`) están en euros (no en céntimos), a diferencia del balance del monedero que está en céntimos.

---

## 13. Obtener transacciones del monedero

**URL:** `GET /api/payment/wallet-transactions`

**Autenticación:** Requerida (`isLoged`).

**Descripción:** Devuelve el historial de transacciones del monedero del usuario, ordenadas por fecha descendente.

**Query params:**
- `limit` — Número de resultados (default: 50, máx: 200).
- `offset` — Desplazamiento (default: 0).

**Salida (200):**
```json
{
  "status": "Success",
  "transactions": [
    {
      "id": 1,
      "wallet_account_id": 1,
      "user_id": 1,
      "currency": "eur",
      "type": "deposit",
      "amount": 5000,
      "balance_before": 0,
      "balance_after": 5000,
      "description": "Recarga",
      "stripe_payment_intent_id": "pi_...",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "limit": 50,
  "offset": 0
}
```

---

## 14. Crear Payout del monedero

**URL:** `POST /api/payment/wallet-payout`

**Autenticación:** Requerida (`isLoged`).

**Descripción:** Retira fondos del monedero virtual a la cuenta Stripe Connect del usuario. Descuenta el saldo en BD, crea un payout en Stripe y sincroniza el estado. Soporta idempotencia via `idempotency_key`. Si el payout de Stripe falla, se reembolsa el saldo en BD.

**Entrada (body JSON):**
```json
{
  "amount": "number (céntimos, > 0)",
  "currency": "string (default: eur)",
  "method": "standard | instant (default: standard)",
  "idempotency_key": "string (opcional, se genera si no se proporciona)"
}
```

**Salida (200):**
```json
{
  "status": "Success",
  "payout": {
    "id": 1,
    "wallet_transaction_id": 5,
    "status": "pending",
    "stripe_payout_id": "po_...",
    "amount": 5000,
    "currency": "eur",
    "created_at": "2024-01-01T00:00:00Z"
  },
  "idempotency_key": "uuid",
  "stripe_payout": { ... }
}
```

**Errores:**
- `400` — Monto inválido o saldo insuficiente.
- `403` — Monedero bloqueado.
- `404` — No tiene cuenta Stripe.
- `409` — El balance cambió durante la operación.
- `502` — El payout de Stripe falló (se reembolsa el saldo).
- `500` — Error interno.

---

## 15. Listar Payouts del monedero

**URL:** `GET /api/payment/wallet-payouts`

**Autenticación:** Requerida (`isLoged`).

**Descripción:** Devuelve el historial de payouts del monedero del usuario.

**Query params:**
- `limit` — Número de resultados (default: 50, máx: 200).
- `offset` — Desplazamiento (default: 0).

**Salida (200):**
```json
{
  "status": "Success",
  "payouts": [
    {
      "id": 1,
      "wallet_account_id": 1,
      "wallet_transaction_id": 5,
      "user_id": 1,
      "currency": "eur",
      "amount": 5000,
      "status": "succeeded",
      "method": "standard",
      "idempotency_key": "uuid",
      "stripe_payout_id": "po_...",
      "stripe_payout_status": "paid",
      "failure_reason": null,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "limit": 50,
  "offset": 0
}
```

---

## 16. Crear Payment Intent

**URL:** `POST /api/payment/payment-intent`

**Autenticación:** Requerida (`isLoged`).

**Descripción:** Crea un Payment Intent en Stripe con retención manual (`capture_method: manual`). El `amount` recibido se interpreta como el **precio neto del conductor** (en céntimos). El sistema calcula automáticamente el precio total del pasajero aplicando la fórmula de fees (ver sección [Cálculo de precios](#cálculo-de-precios)), y usa el margen de la plataforma como `application_fee_amount`.

**Entrada (body JSON):**
```json
{
  "amount": "number (precio neto del conductor en céntimos)",
  "currency": "string (ej: eur)",
  "destination": "string (Stripe account ID destino)"
}
```

**Salida (200):**
```json
{
  "status": "Success",
  "message": "Stripe payment intent created successfully",
  "paymentIntent": { ... },
  "pricing": {
    "total_cents": 2360,
    "driver_price_cents": 2000,
    "platform_fee_cents": 335,
    "stripe_fee_cents": 25,
    "total_eur": 23.60,
    "driver_price_eur": 20.00,
    "platform_fee_eur": 3.35,
    "stripe_fee_eur": 0.25
  }
}
```

---

## 17. Crear Payment Intent via Checkout

**URL:** `POST /api/payment/payment-intent/checkout`

**Autenticación:** Requerida (`isLoged`).

**Descripción:** Crea una sesión de Stripe Checkout para una reserva de trayecto. Usa retención manual (`capture_method: manual`) y **Destination Charges**: cobra al pasajero el precio total calculado y transfiere automáticamente el precio neto del conductor a su cuenta Stripe Connect. El margen de la plataforma se retiene como `application_fee_amount`.

El `amount` recibido se interpreta como el **precio neto del conductor** (en céntimos). El sistema calcula el precio total del pasajero usando la fórmula de fees (ver sección [Cálculo de precios](#cálculo-de-precios)).

**Entrada (body JSON):**
```json
{
  "amount": "number (precio neto del conductor en céntimos)",
  "id_reserva": "string (ID de la reserva)",
  "description": "string",
  "recipient_user_id": "string (ID del usuario conductor)",
  "id_trayecto": "number (ID del trayecto)",
  "success_url": "string",
  "cancel_url": "string"
}
```

**Salida (200):**
```json
{
  ...checkout_session,
  "pricing": {
    "total_cents": 2360,
    "driver_price_cents": 2000,
    "platform_fee_cents": 335,
    "stripe_fee_cents": 25,
    "total_eur": 23.60,
    "driver_price_eur": 20.00,
    "platform_fee_eur": 3.35,
    "stripe_fee_eur": 0.25
  }
}
```

**Errores:**
- `400` — Falta `id_trayecto`, `recipient_user_id`, `amount` inválido, o el conductor no tiene la capability `transfers` activa (onboarding no completado).
- `404` — Usuario remitente o destinatario no encontrado.

---

## 18. Capturar Payment Intent

**URL:** `POST /api/payment/payment-intent/capture`

**Autenticación:** Requerida (`isLoged`).

**Descripción:** Captura un Payment Intent que estaba en retención manual, cobrando el pago al cliente.

**Entrada (body JSON):**
```json
{
  "paymentIntentId": "string (ID del Payment Intent)"
}
```

**Salida (200):**
```json
{
  "status": "Success",
  "message": "Payment intent captured successfully",
  "paymentIntent": { ... }
}
```

**Errores:**
- `400` — Falta `paymentIntentId` o la captura falló.

---

## 19. Cancelar Payment Intent

**URL:** `POST /api/payment/payment-intent/cancel`

**Autenticación:** Requerida (`isLoged`).

**Descripción:** Cancela un Payment Intent. Verifica el estado actual: si ya está cancelado, lo confirma en BD; si ya fue capturado, devuelve error. Actualiza el estado en BD.

**Entrada (body JSON):**
```json
{
  "paymentIntentId": "string (ID del Payment Intent)",
  "cancellation_reason": "string (opcional)"
}
```

**Salida (200):**
```json
{
  "status": "Success",
  "message": "Payment intent canceled successfully",
  "paymentIntent": { ... },
  "note": "Webhook payment_intent.canceled will confirm the final state in DB"
}
```

**Errores:**
- `400` — Falta `paymentIntentId` o no se pudo cancelar.
- `404` — Payment Intent no encontrado.
- `409` — El pago ya fue realizado y no se puede cancelar.

---

## 20. Crear Payout directo (Stripe)

**URL:** `POST /api/payment/payout`

**Autenticación:** Requerida (`isLoged`).

**Descripción:** Crea un payout directo desde el balance de Stripe de la cuenta Connect del usuario.

**Entrada (body JSON):**
```json
{
  "amount": "number (céntimos)",
  "currency": "string (ej: eur)"
}
```

**Salida (200):**
```json
{
  "status": "Success",
  "message": "Payout created successfully",
  "payout": { ... }
}
```

**Errores:**
- `400` — Balance insuficiente o error de Stripe.

---

## 21. Recargar monedero de usuario

**URL:** `POST /api/payment/recharge`

**Autenticación:** Requerida (`isLoged`).

**Descripción:** Crea una sesión de Stripe Checkout para recargar el monedero virtual del usuario. La transferencia va a la cuenta Stripe Connect del usuario.

**Entrada (body JSON):**
```json
{
  "amount": "number (céntimos)",
  "description": "string",
  "success_url": "string",
  "cancel_url": "string"
}
```

**Salida (200):** Objeto sesión de Stripe Checkout.

---

## 22. Crear cuenta bancaria

**URL:** `POST /api/payment/bank_account`

**Autenticación:** Requerida (`isLoged`).

**Descripción:** Asocia una cuenta bancaria (source) al cliente Stripe del usuario.

**Entrada (body JSON):**
```json
{
  "bankAccount": "string (token de Stripe)"
}
```

**Salida (200):**
```json
{
  "status": "Success",
  "message": "Bank account created successfully",
  "bankAccountRes": { ... }
}
```

---

## 23. Obtener cuentas vinculadas (tarjetas y bancos)

**URL:** `GET /api/monedero/cuenta-vinculada`

**Autenticación:** Requerida (`isLoged`).

**Descripción:** Devuelve las cuentas externas vinculadas a la cuenta Stripe Connect del usuario (tarjetas y cuentas bancarias). Útil para mostrar al usuario sus métodos de cobro disponibles en el frontend.

**Parámetros:** Ninguno.

**Salida (200):**
```json
{
  "status": "Success",
  "cuentas": [
    {
      "tipo": "tarjeta",
      "marca": "Visa",
      "ultimos4": "4242",
      "caducidad": "12/2027"
    },
    {
      "tipo": "banco",
      "banco": "BBVA",
      "ultimos4": "1234",
      "moneda": "eur",
      "estado": "validated"
    }
  ]
}
```

**Errores:**
- `404` — El usuario no tiene cuenta de Stripe.
- `500` — No se pudo obtener la información de cobro.

**Notas:**
- Se devuelven hasta 3 cuentas externas.
- Las tarjetas incluyen `marca`, `ultimos4` y `caducidad`.
- Las cuentas bancarias incluyen `banco`, `ultimos4`, `moneda` y `estado` (`new`, `validated`, `errored`).
- Si el usuario no tiene ninguna cuenta vinculada, se devuelve `cuentas: []`.

---

## 24. Calcular precio de un trayecto

**URL:** `POST /api/payment/calculate-price`

**Autenticación:** Requerida (`isLoged`).

**Descripción:** Calcula el precio total que debe pagar el pasajero a partir del precio neto del conductor, aplicando la fórmula de fees de Stripe y el margen de plataforma. Útil para mostrar el precio final en la lista de búsqueda de trayectos antes de que el usuario llegue al checkout.

**Entrada (body JSON):**
```json
{
  "driver_price_cents": "number (precio neto del conductor en céntimos)"
}
```

**Salida (200):**
```json
{
  "status": "Success",
  "pricing": {
    "total_cents": 2360,
    "driver_price_cents": 2000,
    "platform_fee_cents": 335,
    "stripe_fee_cents": 25,
    "total_eur": 23.60,
    "driver_price_eur": 20.00,
    "platform_fee_eur": 3.35,
    "stripe_fee_eur": 0.25
  }
}
```

**Errores:**
- `400` — Falta `driver_price_cents` o es inválido.

---

## 25. Cotizar precio (solo comisiones de Stripe)

**URL:** `GET /api/payment/cotizar?neto=XX`

**Autenticación:** No requerida.

**Descripción:** Calcula el precio total que debe pagar el pasajero a partir del precio neto del conductor, añadiendo **únicamente las comisiones de Stripe** (sin margen de plataforma). Pensado para ser usado desde el frontend en la lista de búsqueda de trayectos, para mostrar al pasajero el precio final antes de ir al checkout.

**Query params:**
- `neto` — Precio neto del conductor en céntimos (entero positivo).

**Ejemplo:** `GET /api/payment/cotizar?neto=2000`

**Salida (200):**
```json
{
  "status": "Success",
  "neto_cents": 2000,
  "total_cents": 2061,
  "stripe_fee_cents": 61,
  "neto_eur": 20.00,
  "total_eur": 20.61,
  "stripe_fee_eur": 0.61
}
```

**Fórmula usada:**
```
T = (P + Sf) / (1 - S%)
```
Donde `P` = precio neto, `Sf` = 25 céntimos (tarifa fija Stripe), `S%` = 1.5% (porcentaje Stripe).

**Errores:**
- `400` — Falta `neto` o es inválido (debe ser un entero positivo).

---

## Cálculo de precios

El sistema usa una fórmula matemática para calcular el precio exacto que debe pagar el pasajero, asegurando que el conductor reciba su precio neto, la plataforma reciba su margen, y Stripe cobre su comisión sin comerse el margen de beneficio.

### Variables

| Variable | Descripción                                             | Valor por defecto                              |
| -------- | ------------------------------------------------------- | ---------------------------------------------- |
| `P`      | Precio neto del conductor (céntimos)                    | Input del cliente                              |
| `M`      | Margen de la plataforma = `P × PLATFORM_MARGIN_PERCENT` | 15% del precio del conductor                   |
| `S%`     | Porcentaje que cobra Stripe                             | 1.5% (`STRIPE_FEE_PERCENT`)                    |
| `Sf`     | Tarifa fija de Stripe                                   | 0.25€ = 25 céntimos (`STRIPE_FEE_FIXED_CENTS`) |
| `T`      | Precio total que paga el pasajero                       | Calculado                                      |

### Fórmula

```
T = (P + M + Sf) / (1 - S%)
```

### Ejemplo práctico

Conductor quiere 20€ (2000 céntimos):

```
M = 2000 × 0.15 = 300 céntimos
T = (2000 + 300 + 25) / (1 - 0.015) = 2325 / 0.985 = 2360 céntimos = 23.60€
```

Desglose del pago:

| Concepto            | Importe |
| ------------------- | ------- |
| Paga el pasajero    | 23.60€  |
| Recibe el conductor | 20.00€  |
| Margen plataforma   | 3.35€   |
| Comisión Stripe     | 0.25€   |

### Configuración (`.env`)

| Variable                  | Descripción                       | Default |
| ------------------------- | --------------------------------- | ------- |
| `STRIPE_FEE_PERCENT`      | Porcentaje de comisión de Stripe  | `0.015` |
| `STRIPE_FEE_FIXED_CENTS`  | Tarifa fija de Stripe en céntimos | `25`    |
| `PLATFORM_MARGIN_PERCENT` | Margen de la plataforma           | `0.15`  |

### Arquitectura: Destination Charges

Se usa el modelo **Destination Charges** de Stripe Connect:

1. La plataforma cobra los `T` céntimos al pasajero vía Stripe Checkout.
2. En la misma llamada, Stripe transfiere automáticamente `P` céntimos a la cuenta Connect del conductor.
3. La plataforma retiene `application_fee_amount = T - P` (margen + comisión Stripe) como `application_fee_amount`.
4. Stripe descuenta su comisión (`S% × T + Sf`) del lado de la plataforma.

### Metadatos del Payment Intent

Los Payment Intents incluyen los siguientes metadatos para trazabilidad:

| Campo                 | Descripción                         |
| --------------------- | ----------------------------------- |
| `driver_price_cents`  | Precio neto del conductor           |
| `total_cents`         | Precio total pagado por el pasajero |
| `platform_fee_cents`  | Margen retenido por la plataforma   |
| `stripe_fee_cents`    | Comisión estimada de Stripe         |
| `id_reserva`          | ID de la reserva asociada           |
| `id_trayecto`         | ID del trayecto                     |
| `recipient_user_id`   | ID del usuario conductor            |
| `sender_account`      | Stripe account ID del pasajero      |
| `destination_account` | Stripe account ID del conductor     |

---

## Notas generales

- **Stripe Connect:** Los usuarios tienen cuentas tipo "express" con `business_type: individual`. Se crean automáticamente al registrarse (tanto password como Google OAuth) con `capabilities: card_payments` y `transfers` habilitadas, y `business_profile` pre-rellenado (MCC `4121`, descripción del producto, URL de la plataforma). El usuario debe completar el onboarding mediante `POST /api/payment/stripe-connect-link` o `GET /api/payment/stripe-connect-link`.
- **Sincronización de perfil:** Al actualizar el perfil de usuario (`PATCH /api/users` o `PATCH /api/users/:id`), se sincronizan automáticamente los datos con la cuenta Stripe Connect (`individual.first_name`, `individual.last_name`, `individual.email`, `individual.phone`, `individual.address`, `individual.dob`, `business_profile`).
- **Comisión de plataforma:** 15% del precio del conductor, calculado automáticamente con la fórmula `T = (P + P×0.15 + 25) / 0.985`. Ver sección [Cálculo de precios](#cálculo-de-precios).
- **Monedero virtual:** Tablas `wallet_accounts`, `wallet_transactions`, `wallet_recharges`, `wallet_payouts`.
- **Idempotencia:** Los payouts del monedero soportan idempotencia via `idempotency_key` (header o body).
- **Sincronización:** Los webhooks de Stripe actualizan automáticamente los estados en BD (ver [webhooks.md](./webhooks.md)).
