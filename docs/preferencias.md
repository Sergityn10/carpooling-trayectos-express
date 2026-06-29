# Preferencias

Gestión de preferencias de usuario para viajes (catálogo de definiciones, consulta y actualización).

---

### 1. Obtener definiciones de preferencias

```
GET /api/preferences/definitions
```

**Autenticación:** Requerida (`authenticate`)

**Descripción:** Devuelve el catálogo de definiciones de preferencias activas (claves, tipos de valor, valores por defecto, valores enum permitidos y descripción).

**Respuesta 200:**

```json
{
  "status": "Success",
  "definitions": [
    {
      "pref_key": "music",
      "value_type": "boolean",
      "default_value": true,
      "enum_values": null,
      "description": "¿Permite música en el coche?",
      "is_active": true
    },
    {
      "pref_key": "smoking",
      "value_type": "boolean",
      "default_value": false,
      "enum_values": null,
      "description": "¿Permite fumar?",
      "is_active": true
    }
  ]
}
```

---

### 2. Insertar preferencias por defecto

```
POST /api/users/:userId/preferences/default
```

**Autenticación:** Requerida (`authenticate` — usa `req.user.userId`)

**Descripción:** Inserta todas las preferencias activas con sus valores por defecto para el usuario. No sobrescribe preferencias ya existentes (usa `ON CONFLICT DO NOTHING`).

**Path params:**

| Parámetro | Tipo          | Descripción    |
| --------- | ------------- | -------------- |
| `userId`  | string (UUID) | ID del usuario |

**Respuesta 201:**

```json
{
  "status": "Success",
  "message": "Preferencias por defecto insertadas correctamente"
}
```

---

### 3. Obtener mis preferencias

```
GET /api/preferences/me
```

**Autenticación:** Requerida (`authenticate`)

**Descripción:** Devuelve las preferencias del usuario autenticado, usando los valores personalizados o los valores por defecto si no se han establecido.

**Respuesta 200:**

```json
{
  "status": "Success",
  "userId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "preferences": {
    "music": true,
    "smoking": false,
    "max_passengers": 4
  }
}
```

---

### 4. Actualizar mis preferencias

```
PUT /api/preferences/me
```

**Autenticación:** Requerida (`authenticate`)

**Descripción:** Actualiza las preferencias del usuario autenticado. Acepta múltiples formatos de entrada. Si un valor es `null`, elimina la preferencia (revierte al valor por defecto).

**Body (JSON) — Formato 1 (objeto clave-valor):**

```json
{
  "music": true,
  "smoking": false,
  "max_passengers": 3
}
```

**Body (JSON) — Formato 2 (array de objetos):**

```json
{
  "preferences": [
    { "pref_key": "music", "value": true },
    { "pref_key": "smoking", "value": false }
  ]
}
```

**Body (JSON) — Formato 3 (objeto anidado):**

```json
{
  "preferences": {
    "music": true,
    "smoking": false
  }
}
```

| Campo   | Tipo                                | Validación                                                |
| ------- | ----------------------------------- | --------------------------------------------------------- |
| Claves  | string                              | Deben existir en `preference_definitions` y estar activas |
| Valores | string \| number \| boolean \| null | Según el `value_type` de cada preferencia                 |

**Respuesta 200:**

```json
{
  "status": "Success",
  "message": "Se ha actualizado correctamente las preferencias de usuario"
}
```

**Errores:**

- `400` — Preferencias no válidas, inactivas, o valor inválido para el tipo.

---

### 5. Obtener preferencias por ID de usuario

```
GET /api/preferences/user_id/:userIdParam
```

**Autenticación:** Requerida (`authenticate`)

**Descripción:** Devuelve las preferencias de un usuario específico. El `userIdParam` debe coincidir con el ID del usuario autenticado.

**Path params:**

| Parámetro     | Tipo          | Descripción                                        |
| ------------- | ------------- | -------------------------------------------------- |
| `userIdParam` | string (UUID) | ID del usuario (debe coincidir con el autenticado) |

**Respuesta 200:**

```json
{
  "status": "Success",
  "userId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "preferences": {
    "music": true,
    "smoking": false
  }
}
```

**Errores:**

- `401` — No tienes permiso para ver las preferencias de este usuario.
