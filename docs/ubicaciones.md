# Ubicaciones

Gestión de ubicaciones/direcciones guardadas por el usuario.

---

### 1. Crear ubicación

```
POST /api/ubicacion
```

**Autenticación:** Requerida (`authenticate`)

**Descripción:** Crea una nueva ubicación (dirección guardada) asociada al usuario autenticado.

**Body (JSON):**

```json
{
  "lat": 40.4168,
  "lng": -3.7038,
  "display_name": "Mi casa",
  "address": "Calle Gran Vía 1",
  "city": "Madrid",
  "province": "Madrid",
  "country": "España",
  "postal_code": "28013",
  "type": "home"
}
```

| Campo          | Tipo   | Requerido | Validación                          |
| -------------- | ------ | --------- | ----------------------------------- |
| `lat`          | number | Sí        | -90 a 90                            |
| `lng`          | number | Sí        | -180 a 180                          |
| `display_name` | string | Sí        | min 2, max 100                      |
| `address`      | string | Sí        | min 2, max 100                      |
| `city`         | string | No        | min 2, max 100                      |
| `province`     | string | No        | min 2, max 100                      |
| `country`      | string | No        | min 2, max 100                      |
| `postal_code`  | string | No        | min 2, max 100                      |
| `type`         | string | No        | min 2, max 100 (ej: "home", "work") |

**Respuesta 201:**

```json
{
  "status": "Success",
  "message": "Ubicación creada correctamente",
  "ubicacion": {
    "id": "u1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "lat": 40.4168,
    "lng": -3.7038,
    "display_name": "Mi casa",
    "address": "Calle Gran Vía 1",
    "city": "Madrid",
    "province": "Madrid",
    "country": "España",
    "postal_code": "28013",
    "type": "home",
    "userId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  }
}
```

**Errores:**

- `400` — Validación fallida o la dirección ya existe.

---

### 2. Obtener todas las ubicaciones

```
GET /api/ubicacion
```

**Autenticación:** No requerida

**Descripción:** Devuelve todas las ubicaciones registradas.

**Respuesta 200:**

```json
[
  {
    "id": "u1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "lat": 40.4168,
    "lng": -3.7038,
    "display_name": "Mi casa",
    "address": "Calle Gran Vía 1",
    "city": "Madrid",
    "province": "Madrid",
    "country": "España",
    "postal_code": "28013",
    "type": "home",
    "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  }
]
```

---

### 3. Obtener ubicaciones por usuario

```
GET /api/ubicacion/user_id/:userIdParam
```

**Autenticación:** Requerida (`authenticate`)

**Descripción:** Devuelve las ubicaciones de un usuario específico. El `userIdParam` debe coincidir con el ID del usuario autenticado.

**Path params:**

| Parámetro     | Tipo          | Descripción                                        |
| ------------- | ------------- | -------------------------------------------------- |
| `userIdParam` | string (UUID) | ID del usuario (debe coincidir con el autenticado) |

**Respuesta 200:**

```json
[
  {
    "id": "u1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "lat": 40.4168,
    "lng": -3.7038,
    "display_name": "Mi casa",
    "address": "Calle Gran Vía 1",
    "city": "Madrid",
    "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  }
]
```

**Errores:**

- `401` — No tienes permiso para ver las ubicaciones de este usuario.

---

### 4. Obtener ubicación por ID

```
GET /api/ubicacion/:id
```

**Autenticación:** No requerida

**Descripción:** Devuelve una ubicación específica por su ID.

**Path params:**

| Parámetro | Tipo          | Descripción        |
| --------- | ------------- | ------------------ |
| `id`      | string (UUID) | ID de la ubicación |

**Respuesta 200:**

```json
{
  "id": "u1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "lat": 40.4168,
  "lng": -3.7038,
  "display_name": "Mi casa",
  "address": "Calle Gran Vía 1",
  "city": "Madrid",
  "province": "Madrid",
  "country": "España",
  "postal_code": "28013",
  "type": "home",
  "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Errores:**

- `404` — Ubicación no encontrada.

---

### 5. Actualizar ubicación

```
PUT /api/ubicacion/:id
```

**Autenticación:** Requerida (`authenticate`)

**Descripción:** Actualiza parcialmente una ubicación. Solo el propietario puede actualizarla.

**Path params:**

| Parámetro | Tipo          | Descripción        |
| --------- | ------------- | ------------------ |
| `id`      | string (UUID) | ID de la ubicación |

**Body (JSON):** Cualquier subconjunto de campos:

```json
{
  "display_name": "Casa de verano",
  "city": "Valencia"
}
```

**Respuesta 204:** Sin contenido.

**Errores:**

- `400` — Validación fallida o la dirección ya existe.
- `401` — No tienes permiso para actualizar esta ubicación.
- `404` — Ubicación no encontrada.

---

### 6. Eliminar ubicación

```
DELETE /api/ubicacion/:id
```

**Autenticación:** Requerida (`authenticate`)

**Descripción:** Elimina permanentemente una ubicación. Solo el propietario puede eliminarla.

**Path params:**

| Parámetro | Tipo          | Descripción        |
| --------- | ------------- | ------------------ |
| `id`      | string (UUID) | ID de la ubicación |

**Respuesta 200:**

```json
{
  "status": "Success",
  "message": "Ubicación eliminada correctamente"
}
```

**Errores:**

- `401` — No tienes permiso para eliminar esta ubicación.
- `404` — Ubicación no encontrada.
