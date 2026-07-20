# Autenticación JWT

El microservicio de notificaciones verifica tokens JWT firmados con **RS256** usando una clave pública. No emite tokens: solo los verifica.

## Alcance

| Endpoint | Requiere JWT |
|----------|-------------|
| `POST /api/device-tokens` | Sí* |
| `GET /api/device-tokens/me` | Sí |
| `DELETE /api/device-tokens` | Sí |
| `/api/emails/*` | No |
| `/api/push/*` | No |
| `/health` | No |

> *El endpoint `POST /api/device-tokens` no tiene el middleware `requireAuth` aplicado a nivel de ruta, pero el controlador usa `req.user` para extraer `userId`, `email` y `role`. En la práctica, requiere un JWT válido para funcionar correctamente.

## Configuración

### Variables de entorno

```env
JWT_ALGORITHM=RS256
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\nMIIB...\n-----END PUBLIC KEY-----\n"
```

| Variable | Descripción |
|----------|-------------|
| `JWT_ALGORITHM` | Algoritmo de firma. Por defecto: `RS256` |
| `JWT_PUBLIC_KEY` | Clave pública PEM correspondiente a la clave privada del servicio que emite los tokens |

> La clave pública debe corresponder a la clave privada usada por el microservicio de autenticación para firmar los JWT.

### Formato de la clave pública

La clave se almacena en `.env` con los saltos de línea escapados como `\n`:

```env
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----\n"
```

El middleware reemplaza `\n` por saltos de línea reales al cargarla:

```javascript
const PUBLIC_KEY = (process.env.JWT_PUBLIC_KEY || "").replace(/\\n/g, "\n");
```

## Formato del token

### Header HTTP

El token se envía como Bearer token en la cabecera `Authorization`:

```
Authorization: Bearer <JWT>
```

El middleware también acepta la cabecera `Authentication` como alternativa:

```
Authentication: Bearer <JWT>
```

### Payload esperado

El JWT debe contener al menos estos tres campos en el payload:

```json
{
  "userId": "user-uuid",
  "email": "user@example.com",
  "role": "user"
}
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `userId` | `string` | ID único del usuario |
| `email` | `string` | Email del usuario |
| `role` | `string` | Rol del usuario (ej. `user`, `admin`) |

> Si el payload no contiene estos tres campos, el middleware devuelve `401` con el mensaje: `"Token inválido: faltan userId, email o role"`.

## Flujo de verificación

```
Petición entrante
       │
       ▼
┌──────────────────┐
│ Extraer Bearer   │
│ de Authorization │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐     No      ┌──────────────────────┐
│  ¿Hay token?     │────────────>│ 401: "Token Bearer   │
└────────┬─────────┘             │       requerido"     │
         │ Sí                    └──────────────────────┘
         ▼
┌──────────────────┐     No      ┌──────────────────────┐
│ ¿PUBLIC_KEY      │────────────>│ 500: "JWT_PUBLIC_KEY │
│  configurada?    │             │  no está configurada"│
└────────┬─────────┘             └──────────────────────┘
         │ Sí
         ▼
┌──────────────────┐     Error   ┌──────────────────────┐
│ jwt.verify()     │────────────>│ 401: "Token inválido"│
│ con RS256        │             │  o "Token expirado"  │
└────────┬─────────┘             └──────────────────────┘
         │ OK
         ▼
┌──────────────────┐     No      ┌─────────────────────────────┐
│ ¿Payload tiene   │────────────>│ 401: "Token inválido:       │
│ userId, email,   │             │  faltan userId, email o     │
│ role?            │             │  role"                      │
└────────┬─────────┘             └─────────────────────────────┘
         │ Sí
         ▼
┌──────────────────┐
│ req.user = {     │
│   userId,        │
│   email,         │
│   role           │
│ }                │
│ next()           │
└──────────────────┘
```

## Respuestas de error

| Status | Error | Cuándo |
|--------|-------|--------|
| `500` | `"JWT_PUBLIC_KEY no está configurada"` | La variable `JWT_PUBLIC_KEY` está vacía |
| `401` | `"Token Bearer requerido"` | No se envió la cabecera `Authorization` |
| `401` | `"Token expirado"` | El JWT ha expirado (`TokenExpiredError`) |
| `401` | `"Token inválido"`, `detail: ...` | La firma no es válida o el formato es incorrecto |
| `401` | `"Token inválido: faltan userId, email o role"` | El payload no contiene los campos requeridos |

## Integración con el servicio de autenticación

El microservicio de notificaciones **no emite tokens**. Depende del microservicio de autenticación de Carpooling para:

1. **Firmar los JWT** con la clave privada RS256.
2. **Incluir el payload** `{ userId, email, role }`.
3. **Compartir la clave pública** con este servicio (configurada en `JWT_PUBLIC_KEY`).

### Rotación de claves

Si el servicio de autenticación rota sus claves RS256:

1. Generar nuevo par de claves.
2. Actualizar `JWT_PUBLIC_KEY` en el `.env` de este microservicio.
3. Reiniciar el servicio.
4. Los tokens firmados con la clave anterior dejarán de ser válidos inmediatamente.

> Para una rotación sin downtime, considera mantener ambas claves públicas durante un periodo de transición. Esto requeriría modificar el middleware para aceptar múltiples claves.

## Notas de seguridad

- La clave **privada** nunca debe estar en este microservicio. Solo la clave pública.
- El algoritmo está restringido a `[JWT_ALGORITHM]` (por defecto `RS256`) para prevenir ataques de degradación de algoritmo.
- El middleware usa `jwt.verify()` de la librería `jsonwebtoken`, que valida firma, expiración y formato automáticamente.
- `userId` se convierte a `String` al almacenarse en `req.user` para evitar problemas de tipo.
