# Información de Telegram (`/api/telegram-info`)

Endpoints CRUD para gestionar la información de Telegram asociada a los usuarios. Todos requieren autenticación.

---

## 1. Listar información de Telegram

**URL:** `GET /api/telegram-info`

**Autenticación:** Requerida (`isLoged`).

**Descripción:** Devuelve todos los registros de información de Telegram. Opcionalmente se puede filtrar por usuario.

**Query params (opcionales):**
- `user_id` o `userId` — Filtra por ID de usuario.

**Salida (200):**
```json
{
  "status": "Success",
  "data": [
    {
      "user_id": 1,
      "id": 123456789,
      "telegram_username": "juan_telegram",
      "first_name": "Juan",
      "last_name": "Pérez",
      "chat_id": 987654321
    }
  ]
}
```

**Errores:**
- `500` — Error al obtener.

---

## 2. Obtener por ID

**URL:** `GET /api/telegram-info/:id`

**Autenticación:** Requerida (`isLoged`).

**Descripción:** Devuelve un registro de información de Telegram por su ID (ID de Telegram, no de usuario).

**Parámetros de URL:**
- `id` — ID de Telegram.

**Salida (200):**
```json
{
  "status": "Success",
  "data": {
    "user_id": 1,
    "id": 123456789,
    "telegram_username": "juan_telegram",
    "first_name": "Juan",
    "last_name": "Pérez",
    "chat_id": 987654321
  }
}
```

**Errores:**
- `404` — No encontrado.
- `500` — Error al obtener.

---

## 3. Crear registro

**URL:** `POST /api/telegram-info`

**Autenticación:** Requerida (`isLoged`).

**Descripción:** Crea un nuevo registro de información de Telegram. Verifica que el usuario exista y que el ID de Telegram no esté ya registrado.

**Entrada (body JSON):**
```json
{
  "user_id": "number (requerido)",
  "id": "number (requerido, ID de Telegram, único)",
  "telegram_username": "string (opcional)",
  "first_name": "string (requerido)",
  "last_name": "string (opcional)",
  "chat_id": "number (opcional)"
}
```

**Salida (201):**
```json
{
  "status": "Success",
  "message": "Telegram info created"
}
```

**Errores:**
- `400` — Validación fallida.
- `404` — Usuario no encontrado.
- `409` — Ya existe un registro con ese ID de Telegram.
- `500` — Error al crear.

---

## 4. Actualizar registro (PUT)

**URL:** `PUT /api/telegram-info/:id`

**Autenticación:** Requerida (`isLoged`).

**Descripción:** Reemplaza completamente un registro de información de Telegram. El ID del body debe coincidir con el ID de la URL.

**Parámetros de URL:**
- `id` — ID de Telegram.

**Entrada (body JSON):** Mismos campos que en la creación (todos requeridos).

**Salida (200):**
```json
{
  "status": "Success",
  "message": "Telegram info updated"
}
```

**Errores:**
- `400` — Validación fallida o ID del body no coincide con URL.
- `404` — Registro o usuario no encontrado.
- `500` — Error al actualizar.

---

## 5. Actualizar registro (PATCH)

**URL:** `PATCH /api/telegram-info/:id`

**Autenticación:** Requerida (`isLoged`).

**Descripción:** Actualiza parcialmente un registro de información de Telegram.

**Parámetros de URL:**
- `id` — ID de Telegram.

**Entrada (body JSON, campos opcionales):**
```json
{
  "user_id": "number",
  "telegram_username": "string",
  "first_name": "string",
  "last_name": "string",
  "chat_id": "number"
}
```

**Salida (200):**
```json
{
  "status": "Success",
  "message": "Telegram info updated"
}
```

**Errores:**
- `400` — Validación fallida o no hay campos.
- `404` — Registro o usuario no encontrado.
- `500` — Error al actualizar.

---

## 6. Eliminar registro

**URL:** `DELETE /api/telegram-info/:id`

**Autenticación:** Requerida (`isLoged`).

**Descripción:** Elimina un registro de información de Telegram por su ID.

**Parámetros de URL:**
- `id` — ID de Telegram.

**Salida (200):**
```json
{
  "status": "Success",
  "message": "Telegram info deleted"
}
```

**Errores:**
- `404` — Registro no encontrado.
- `500` — Error al eliminar.

---

## 7. Creación masiva (Bulk)

**URL:** `POST /api/telegram-info/bulk`

**Autenticación:** Requerida (`isLoged`).

**Descripción:** Crea múltiples registros de información de Telegram en una sola petición. Los items con IDs ya existentes se omiten. Los items inválidos se reportan individualmente.

**Entrada (body JSON):**
```json
[
  { "user_id": 1, "id": 111, "first_name": "Juan", ... },
  { "user_id": 2, "id": 222, "first_name": "Ana", ... }
]
```

O alternativamente:
```json
{
  "items": [
    { "user_id": 1, "id": 111, "first_name": "Juan", ... }
  ]
}
```

**Salida (207 Multi-Status):**
```json
{
  "status": "Multi-Status",
  "results": {
    "inserted": 5,
    "skippedExisting": 2,
    "invalid": 1,
    "invalidItems": [
      { "index": 3, "reason": "User not found" }
    ],
    "errors": 0
  }
}
```

**Errores:**
- `400` — Formato de entrada inválido (no es array ni tiene `items`).
- `500` — Error general.
