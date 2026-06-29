# Documentación de la API — Carpooling User

Documentación de los endpoints de la API REST del backend de carpooling para usuarios.

## Índice

| Archivo | Módulo | Base URL | Descripción |
|---|---|---|---|
| [auth.md](./auth.md) | Autenticación de usuarios | `/api/auth` | Login, registro, logout, refresh, validación, OAuth con Google |
| [users.md](./users.md) | Gestión de usuarios | `/api/users` | Listar, obtener, actualizar, eliminar usuarios, búsqueda por ubicación |
| [enterprise_auth.md](./enterprise_auth.md) | Autenticación de empresas | `/api/enterprise/auth` | Registro, login, logout, validación de empresas |
| [enterprise.md](./enterprise.md) | Gestión de empresas | `/api/enterprise` | Perfil de empresa (ver y actualizar) |
| [enterprise_service_events.md](./enterprise_service_events.md) | Eventos de servicio | `/api/enterprise/service-events` | CRUD de eventos de servicio empresariales |
| [cars.md](./cars.md) | Coches | `/api/cars` | CRUD de coches de usuarios |
| [telegram_info.md](./telegram_info.md) | Info de Telegram | `/api/telegram-info` | CRUD de información de Telegram, creación masiva |
| [payment.md](./payment.md) | Pagos y Stripe | `/api/payment` | Stripe Connect, clientes, monedero, payment intents, payouts, recargas |
| [webhooks.md](./webhooks.md) | Webhooks | `/api/webhook` | Recepción y procesamiento de eventos de Stripe |
| [routines.md](./routines.md) | Disponibilidad semanal | `/api/routines` | CRUD de rutinas/disponibilidad semanal de transporte |

## Autenticación

La API utiliza JWT para autenticación. Los tokens se transmiten de dos formas:

1. **Cookie:** `access_token` (HTTP-only, secure en producción).
2. **Bearer header:** `Authorization: Bearer <token>`.

Para empresas, se usa la cookie `enterprise_access_token`.

El middleware `isLoged` acepta cualquiera de los dos métodos. El middleware `isEnterpriseLoged` verifica la cookie de empresa.

## Refresh Token

Los refresh tokens son rotatorios (cada uso genera uno nuevo) y válidos por 30 días. Se almacenan hasheados (SHA-256) en la tabla `refresh_tokens`.

## Formato de respuestas

Todas las respuestas siguen el formato:

```json
{
  "status": "Success | Error",
  "message": "Descripción del resultado",
  ...datos adicionales
}
```

## CORS

Los orígenes permitidos incluyen:
- `http://localhost:5173`, `http://localhost:4001`, `http://localhost:3000`
- `https://www.youconnext.es`, `https://app.youconnext.es`
- Variables de entorno: `ORIGIN`, `TRAYECTOS_ORIGIN`, `MESSSAGES_ORIGIN`

Métodos permitidos: `GET, POST, PUT, DELETE, OPTIONS, PATCH`.
