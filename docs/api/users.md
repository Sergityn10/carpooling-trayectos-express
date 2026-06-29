# Gestión de Usuarios (`/api/users`)

Endpoints para consultar, actualizar y eliminar usuarios. La mayoría requieren autenticación.

---

## 1. Test de API

**URL:** `GET /api/test`

**Autenticación:** Requerida (`isLoged`).

**Descripción:** Endpoint de prueba para verificar que la API funciona y el middleware de autenticación está activo.

**Salida (200):**
```json
{
  "status": "Success",
  "message": "API is working correctly"
}
```

---

## 2. Listar todos los usuarios

**URL:** `GET /api/users`

**Autenticación:** Requerida (`isLoged`).

**Descripción:** Devuelve todos los usuarios de la BD con los campos sensibles desencriptados (email, phone, dni, etc.).

**Salida (200):** Array de objetos usuario:
```json
[
  {
    "id": 1,
    "email": "user@example.com",
    "name": "Juan",
    "phone": "600123456",
    "img_perfil": "url",
    "ciudad": "Madrid",
    "onboarding_ended": 1,
    "auth_method": "password",
    ...
  }
]
```

**Errores:**
- `500` — Error al obtener usuarios.

---

## 3. Obtener mi información de usuario

**URL:** `GET /api/users/info`

**Autenticación:** Requerida (`isLoged`).

**Descripción:** Devuelve la información completa del usuario autenticado, incluyendo valoración media, número de opiniones, número de viajes y preferencias.

**Salida (200):**
```json
{
  "status": "Success",
  "message": "User found successfully",
  "data": {
    "name": "Juan",
    "surname": null,
    "phone": "600123456",
    "email": "user@example.com",
    "img_perfil": "url",
    "role": "user",
    "fecha_nacimiento": "1990-01-15",
    "genero": "Masculino",
    "averageRating": 8.5,
    "numOpinions": 10,
    "myNumOpinions": 5,
    "about_me": "Texto descriptivo",
    "viajes": 15,
    "preferences": {
      "smoking_allowed": "0",
      "pets_allowed": "0",
      "music": "1",
      "talk_level": "normal",
      "temperature": "templado",
      "luggage_size": "medio",
      "stops_allowed": "0",
      "max_detour_km": "0"
    }
  }
}
```

---

## 4. Obtener usuario por ID

**URL:** `GET /api/users/:id`

**Autenticación:** Requerida (`isLoged`).

**Descripción:** Devuelve los datos de un usuario específico por su ID, con campos sensibles desencriptados.

**Parámetros de URL:**
- `id` — ID numérico del usuario.

**Salida (200):** Objeto usuario completo (mismo formato que listado pero un solo objeto).

**Errores:**
- `404` — Usuario no encontrado.
- `500` — Error al obtener usuario.

---

## 5. Obtener información pública de usuario por ID

**URL:** `GET /api/users/:id/info`

**Autenticación:** No requerida.

**Descripción:** Devuelve información de perfil pública de un usuario: nombre, email, imagen, valoración media, número de opiniones, número de viajes, sobre mí y preferencias.

**Parámetros de URL:**
- `id` — ID numérico del usuario.

**Salida (200):**
```json
{
  "status": "Success",
  "message": "User found successfully",
  "data": {
    "userId": 1,
    "name": "Juan",
    "surname": null,
    "phone": "600123456",
    "email": "user@example.com",
    "img_perfil": "url",
    "role": "user",
    "averageRating": 8.5,
    "numOpinions": 10,
    "myNumOpinions": 5,
    "about_me": "Texto",
    "viajes": 15,
    "preferences": { ... }
  }
}
```

**Errores:**
- `404` — Usuario no encontrado.

---

## 6. Actualizar usuario por ID (PATCH)

**URL:** `PATCH /api/users/:id`

**Autenticación:** Requerida (`isLoged`). El usuario autenticado debe ser el mismo que el `:id`.

**Descripción:** Actualiza parcialmente los datos de un usuario. La contraseña se hashea antes de guardar. El DNI se encripta y se verifica que no exista ya en otro usuario. Los campos sensibles se encriptan antes de persistir. Adicionalmente, sincroniza los datos del perfil con la cuenta Stripe Connect del usuario (nombre, email, teléfono, dirección, fecha de nacimiento) mediante `updateStripeAccountFromProfile`, de forma no bloqueante.

**Parámetros de URL:**
- `id` — ID numérico del usuario.

**Entrada (body JSON, campos opcionales):**
```json
{
  "name": "string",
  "phone": "string",
  "password": "string (mín. 6)",
  "img_perfil": "url",
  "fecha_nacimiento": "YYYY-MM-DD",
  "dni": "string",
  "genero": "Masculino | Femenino | Otro",
  "ciudad": "string",
  "provincia": "string",
  "codigo_postal": "string",
  "direccion": "string",
  "pais": "string",
  "about_me": "string"
}
```

**Salida (200):**
```json
{
  "status": "Success",
  "message": "User updated successfully"
}
```

**Errores:**
- `400` — Validación fallida o no hay campos para actualizar.
- `401` — No autorizado (el usuario logueado no coincide con el ID).
- `404` — Usuario no encontrado.
- `409` — DNI ya existe en otro usuario.
- `500` — Error al actualizar.

---

## 7. Actualizar mi usuario (PATCH)

**URL:** `PATCH /api/users`

**Autenticación:** Requerida (`isLoged`).

**Descripción:** Similar al endpoint anterior pero actualiza al usuario autenticado sin necesidad de especificar ID. Usa el email del token para identificar al usuario. También sincroniza los datos con Stripe Connect.

**Entrada:** Igual que `PATCH /api/users/:id`.

**Salida (200):**
```json
{
  "status": "Success",
  "message": "User updated successfully"
}
```

**Errores:** Igual que el anterior excepto `401` por ID mismatch.

---

## 8. Eliminar usuario

**URL:** `DELETE /api/users/:id`

**Autenticación:** Requerida (`isLoged`). El usuario autenticado debe ser el mismo que el `:id`.

**Descripción:** Elimina un usuario y todos sus datos relacionados en cascada (coches, trayectos, reservas, comentarios, cuentas Stripe, wallet, telegram_info, disponibilidad_semanal, etc.). Usa una transacción con borrado best-effort de FKs. Limpia la cookie `access_token` al finalizar.

**Parámetros de URL:**
- `id` — ID numérico del usuario.

**Salida (200):**
```json
{
  "status": "Success",
  "message": "User deleted successfully"
}
```

**Errores:**
- `401` — No autorizado.
- `404` — Usuario no encontrado.
- `409` — Eliminación bloqueada por registros relacionados.
- `500` — Error al eliminar.

---

## 9. Buscar usuarios únicos por ubicación

**URL:** `GET /api/users/unique-by-location`

**Autenticación:** No requerida.

**Descripción:** Geocodifica una ubicación usando Google Maps, extrae la ciudad y devuelve los usuarios únicos que tienen esa ciudad asignada. Útil para mostrar usuarios disponibles en una zona.

**Query params:**
- `location` — Texto de ubicación (mín. 2 caracteres).

**Salida (200):**
```json
{
  "status": "Success",
  "location": {
    "query": "Madrid",
    "normalized_city": "Madrid",
    "formatted_address": "Madrid, Spain",
    "place_id": "ChIJ8TwowIWMQg0RvGgYzS",
    "lat": 40.4168,
    "lng": -3.7038,
    "country": "ES"
  },
  "count": 5,
  "users": [
    {
      "id": 1,
      "name": "Juan",
      "img_perfil": "url",
      "ciudad": "Madrid"
    }
  ]
}
```

**Errores:**
- `400` — Ubicación no válida o no se pudo geocodificar.
- `500` — Error al obtener usuarios.

---

## Notas generales

- **Campos sensibles encriptados:** `dni`, `name`, `phone`, `direccion`, `provincia`, `codigo_postal`, `fecha_nacimiento` (definidos en `USER_SENSITIVE_FIELDS`). Los valores encriptados se almacenan como strings en la BD (formato `iv_hex:encrypted_hex`).
- **Sincronización con Stripe:** Al actualizar el perfil, se sincronizan automáticamente los datos con la cuenta Stripe Connect del usuario (`individual.first_name`, `individual.last_name`, `individual.email`, `individual.phone`, `individual.address`, `individual.dob`, `business_profile`).
- **Preferencias:** Se almacenan en la tabla `user_preferences` con claves definidas en `preference_definitions`.
- **Valoración media:** Calculada desde la tabla `comments` donde `user_id_trayect` = ID del usuario.
