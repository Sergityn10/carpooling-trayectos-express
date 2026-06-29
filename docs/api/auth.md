# Autenticación de Usuarios (`/api/auth`)

Endpoints para registro, login, logout, validación de sesión y OAuth con Google para usuarios normales de la aplicación.

---

## 1. Login

**URL:** `POST /api/auth/login`

**Autenticación:** No requerida.

**Descripción:** Autentica a un usuario con email y contraseña. Si las credenciales son válidas, genera un JWT (`access_token`) que se guarda en una cookie HTTP-only y en la respuesta. También emite un `refresh_token` rotatorio almacenado en BD.

**Entrada (body JSON):**
```json
{
  "email": "string (email válido)",
  "password": "string (mín. 6 caracteres)"
}
```

**Salida (200):**
```json
{
  "status": "Success",
  "message": "Login successful",
  "userId": 1,
  "token": "<JWT>",
  "img_perfil": "url o null",
  "onboarding_ended": 0
}
```

**Errores:**
- `400` — Validación de esquema fallida (email/password inválidos).
- `404` — Login fallido (usuario no encontrado, método de auth no válido, o password incorrecto).

**Cookies establecidas:** `access_token` (JWT), `refresh_token` (token rotatorio).

---

## 2. Registro

**URL:** `POST /api/auth/register`

**Autenticación:** No requerida.

**Descripción:** Registra un nuevo usuario con email y contraseña (método `password`). Hashea la contraseña con bcrypt, inserta el usuario en BD, crea preferencias por defecto, crea automáticamente una cuenta Stripe Connect (tipo `express`, `business_type: individual`, con `card_payments` y `transfers` habilitados, `business_profile` pre-rellenado con MCC `4121`, descripción de producto y URL de la plataforma) y la guarda en la tabla `accounts`, actualiza `stripe_account` en el usuario, y devuelve un JWT. También emite un `refresh_token`.

**Entrada (body JSON):**
```json
{
  "email": "string (email válido, único)",
  "password": "string (mín. 6 caracteres)"
}
```

**Salida (201):**
```json
{
  "status": "Success",
  "message": "User registered successfully",
  "token": "<JWT>",
  "userId": 1
}
```

**Errores:**
- `400` — Validación de esquema fallida o email ya existe.
- `404` — Usuario ya creado.
- `500` — Error al registrar usuario.

**Cookies establecidas:** `access_token`, `refresh_token`.

> **Nota:** Desde la versión actual, el registro (tanto password como Google OAuth) crea automáticamente:
> - Un **Stripe Customer** para pagos como cliente.
> - Una **Stripe Connect Account** (tipo `express`, `business_type: individual`) con `capabilities: card_payments` y `transfers` habilitadas, y `business_profile` pre-rellenado (MCC `4121`, descripción del producto, URL de la plataforma). La cuenta se guarda en la tabla `accounts` y se referencia en `users.stripe_account`.
> - El usuario deberá completar el onboarding de Stripe mediante `POST /api/payment/stripe-connect-link` para poder recibir pagos.

---

## 3. Comprobar si un email existe

**URL:** `GET /api/auth/register/email/:email`

**Autenticación:** No requerida.

**Descripción:** Verifica si un email ya está registrado en la BD. Útil antes de mostrar el formulario de registro.

**Parámetros de URL:**
- `email` — El email a comprobar (pasado como query param `email`).

> **Nota:** Aunque la URL incluye `:email`, el controlador lee `req.query.email`, no `req.params.email`.

**Salida (200):**
```json
{
  "status": "Success",
  "message": "Email not exists"
}
```

**Errores:**
- `404` — El email ya existe.

---

## 4. Logout

**URL:** `GET /api/auth/logout`

**Autenticación:** No requerida (pero se recomienda estar logueado).

**Descripción:** Cierra la sesión del usuario eliminando las cookies `access_token` y `refresh_token`.

**Salida (200):**
```json
{
  "status": "Success",
  "message": "Logout successful"
}
```

---

## 5. Refresh Token

**URL:** `POST /api/auth/refresh`

**Autenticación:** Cookie `refresh_token` requerida.

**Descripción:** Rota el refresh token y emite un nuevo `access_token`. El refresh token anterior se elimina de la BD (rotación). Si el token está revocado, expirado o el usuario no existe, se limpian las cookies.

**Entrada:** No requiere body. Usa la cookie `refresh_token`.

**Salida (200):**
```json
{
  "status": "Success",
  "message": "Token refreshed",
  "token": "<nuevo JWT>",
  "userId": 1
}
```

**Errores:**
- `401` — No se proporcionó refresh token, token inválido, token expirado, o usuario no encontrado.

**Cookies actualizadas:** `access_token` (nuevo JWT), `refresh_token` (nuevo token rotado).

---

## 6. Validar Token

**URL:** `GET /api/auth/validate`

**Autenticación:** Bearer token en header `Authorization: Bearer <token>` o cookie `access_token`.

**Descripción:** Valida el token JWT del usuario (ya sea via Bearer header o cookie). Devuelve los datos básicos del usuario si el token es válido.

**Salida (200):**
```json
{
  "status": "Success",
  "message": "Token is valid",
  "token": "<JWT>",
  "data": {
    "userId": 1,
    "email": "user@example.com",
    "img_perfil": "url o null",
    "ciudad": "Madrid o null",
    "onboarding_ended": 0,
    "role": "user"
  }
}
```

**Errores:**
- `401` — No se proporcionó token, token inválido/expirado, o usuario no encontrado.

---

## 7. OAuth con Google — Iniciar flujo

**URL:** `POST /api/auth/oauth`

**Autenticación:** No requerida.

**Descripción:** Genera la URL de autorización de Google OAuth para iniciar el flujo de login o registro con Google. El cliente debe redirigir al usuario a la URL devuelta.

**Entrada (query param):**
- `method` — `"login"` o `"register"`.

**Salida (200):**
```json
{
  "url": "https://accounts.google.com/o/oauth2/auth?..."
}
```

**Errores:**
- `400` — Método inválido (no es `login` ni `register`).

---

## 8. OAuth con Google — Callback de Registro

**URL:** `GET /api/auth/oauth/register`

**Autenticación:** No requerida.

**Descripción:** Endpoint de callback al que Google redirige tras la autorización. Intercambia el código por tokens, obtiene los datos del usuario de Google, verifica si ya existe, crea el usuario en BD (método `google`), genera un JWT y redirige al frontend con el token y los datos del usuario.

**Query params:**
- `code` — Código de autorización de Google.

**Comportamiento:**
- Si el usuario ya existe → redirige a `{frontend}/register?error=user_exists`.
- Si ocurre un error → redirige a `{frontend}/register?error=auth_failed`.
- Si todo va bien → redirige a `{frontend}/register/personal-info?token=...&userId=...&img_perfil=...`.

**Cookies establecidas:** `access_token`, `refresh_token`.

---

## 9. OAuth con Google — Callback de Login

**URL:** `GET /api/auth/oauth/login`

**Autenticación:** No requerida.

**Descripción:** Endpoint de callback para login con Google. Intercambia el código por tokens, obtiene los datos del usuario, verifica que existe y que su método de autenticación es `google`. Si todo es correcto, genera un JWT y redirige al frontend.

**Query params:**
- `code` — Código de autorización de Google.

**Comportamiento:**
- Si el usuario no existe → redirige a `{frontend}/login?error=user_no_exists`.
- Si el método de auth no es Google → redirige a `{frontend}/login?error=auth_method_not_google`.
- Si todo va bien → redirige a `{frontend}?token=...&userId=...&img_perfil=...`.

**Cookies establecidas:** `access_token`, `refresh_token`.

---

## 10. OAuth con Google — Android (Login / Registro)

**URL:** `POST /api/auth/oauth/android`

**Autenticación:** No requerida.

**Descripción:** Autentica o registra a un usuario usando el `id_token` de Google obtenido desde el SDK de Google Sign-In en Android. A diferencia del flujo web (que usa redirects), este endpoint recibe el `id_token` directamente y devuelve una respuesta JSON con el JWT. El backend verifica el `id_token` usando `google-auth-library` con el client ID de Android (`GOOGLE_CLIENT_ID_ANDROID`). En el registro, también se crea automáticamente una cuenta Stripe Connect (tipo `express`, `business_type: individual`, con `card_payments` y `transfers` habilitados, `business_profile` pre-rellenado) y se guarda en la tabla `accounts`.

**Entrada (body JSON):**
```json
{
  "id_token": "string (Google ID token del SDK de Android)",
  "method": "login | register"
}
```

**Salida — Registro (201):**
```json
{
  "status": "Success",
  "message": "User registered successfully",
  "token": "<JWT>",
  "userId": 1,
  "img_perfil": "https://lh3.googleusercontent.com/...",
  "onboarding_ended": 0
}
```

**Salida — Login (200):**
```json
{
  "status": "Success",
  "message": "Login successful",
  "token": "<JWT>",
  "userId": 1,
  "img_perfil": "https://lh3.googleusercontent.com/...",
  "onboarding_ended": 1
}
```

**Errores:**
- `400` — Falta `id_token`, método inválido, o la cuenta de Google no tiene email.
- `401` — El `id_token` no es válido o no se pudo verificar.
- `404` — (Login) Usuario no encontrado o el método de autenticación no es Google.
- `409` — (Registro) El usuario ya existe.
- `500` — Error al registrar o error interno.

**Cookies establecidas:** `access_token` (JWT), `refresh_token` (token rotatorio). En Android, la app debe usar el `token` devuelto en la respuesta JSON como Bearer token en futuras peticiones.

**Variables de entorno usadas:**
- `GOOGLE_CLIENT_ID_ANDROID` — Client ID de Google OAuth para Android.
- `GOOGLE_CLIENT_ID` — Client ID web (también aceptado como audience).

---

## Notas generales

- **JWT Secret:** `process.env.JWT_SECRET_KEY`
- **Expiración del access token:** `process.env.EXPIRATION_TIME`
- **Expiración de cookies:** `process.env.JWT_COOKIES_EXPIRATION_TIME` (en minutos)
- **Refresh token:** Válido por 30 días, rotatorio (cada uso genera uno nuevo)
- **Cookies:** `httpOnly`, `secure` en producción, `sameSite: none` en producción / `lax` en desarrollo.
