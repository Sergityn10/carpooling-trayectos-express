# Autenticación de Empresas (`/api/enterprise/auth`)

Endpoints para registro, login, logout y validación de sesión para cuentas de empresa (enterprise).

---

## 1. Registro de Empresa

**URL:** `POST /api/enterprise/auth/register`

**Autenticación:** No requerida.

**Descripción:** Registra una nueva empresa en la BD. Hashea la contraseña con bcrypt. Genera un JWT y lo guarda en una cookie `enterprise_access_token`.

**Entrada (body JSON):**
```json
{
  "name": "string (requerido)",
  "email": "string (email válido, único)",
  "password": "string (requerido)",
  "phone": "string (opcional)",
  "cif": "string (opcional, único)",
  "website": "string (opcional)",
  "address_line1": "string (opcional)",
  "address_line2": "string (opcional)",
  "city": "string (opcional)",
  "province": "string (opcional)",
  "postal_code": "string (opcional)",
  "country": "string (default: ES)"
}
```

**Salida (201):**
```json
{
  "status": "Success",
  "message": "Enterprise registered successfully",
  "token": "<JWT>",
  "enterprise": {
    "id": 1,
    "name": "Mi Empresa",
    "email": "info@empresa.com",
    "phone": null,
    "cif": null,
    "website": null,
    "address_line1": null,
    "address_line2": null,
    "city": null,
    "province": null,
    "postal_code": null,
    "country": "ES",
    "verified": 0,
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

**Errores:**
- `400` — Validación fallida o empresa ya existe.
- `500` — Error al registrar.

**Cookies establecidas:** `enterprise_access_token` (JWT, expira en `JWT_COOKIES_EXPIRATION_TIME` días).

---

## 2. Login de Empresa

**URL:** `POST /api/enterprise/auth/login`

**Autenticación:** No requerida.

**Descripción:** Autentica una empresa con email y contraseña. Si es válida, genera un JWT y lo guarda en cookie.

**Entrada (body JSON):**
```json
{
  "email": "string (email válido)",
  "password": "string"
}
```

**Salida (200):**
```json
{
  "status": "Success",
  "message": "Login successful",
  "token": "<JWT>",
  "enterprise": {
    "id": 1,
    "name": "Mi Empresa",
    "email": "info@empresa.com",
    "verified": 0
  }
}
```

**Errores:**
- `400` — Validación fallida.
- `404` — Login fallido (empresa no encontrada o password incorrecto).

**Cookies establecidas:** `enterprise_access_token`.

---

## 3. Logout de Empresa

**URL:** `GET /api/enterprise/auth/logout`

**Autenticación:** No requerida.

**Descripción:** Cierra la sesión de la empresa eliminando la cookie `enterprise_access_token`.

**Salida (200):**
```json
{
  "status": "Success",
  "message": "Logout successful"
}
```

---

## 4. Validar Token de Empresa

**URL:** `GET /api/enterprise/auth/validate`

**Autenticación:** Cookie `enterprise_access_token` requerida.

**Descripción:** Valida el token JWT de la empresa. Devuelve los datos completos de la empresa si el token es válido.

**Salida (200):**
```json
{
  "status": "Success",
  "message": "Token is valid",
  "token": "<JWT>",
  "data": {
    "id": 1,
    "name": "Mi Empresa",
    "email": "info@empresa.com",
    "phone": null,
    "cif": null,
    "website": null,
    "address_line1": null,
    "address_line2": null,
    "city": null,
    "province": null,
    "postal_code": null,
    "country": "ES",
    "verified": 0,
    "type": "enterprise"
  }
}
```

**Errores:**
- `401` — No se proporcionó token o token inválido.

---

## Notas generales

- **Cookie:** `enterprise_access_token` — `httpOnly`, `secure` en producción, `sameSite: lax`.
- **Expiración:** `process.env.JWT_COOKIES_EXPIRATION_TIME` días.
- **JWT Payload:** `{ email, type: "enterprise", enterprise_id }`.
- **Middleware de protección:** `enterpriseAuthorization.isEnterpriseLoged` para endpoints que requieren sesión de empresa.
