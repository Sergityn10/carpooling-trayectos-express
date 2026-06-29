# Rutas Frecuentes

Gestión de plantillas de rutas frecuentes guardadas por el usuario.

---

### 1. Crear ruta frecuente

```
POST /api/frequent-routes
```

**Autenticación:** Requerida (`authenticate`)

**Descripción:** Crea una plantilla de ruta frecuente para el usuario autenticado, con origen, destino, rol (conductor/pasajero) y número de asientos.

**Body (JSON):**

```json
{
  "name": "Ruta al trabajo",
  "originAddress": "Calle Gran Vía 1, Madrid",
  "originLat": 40.4168,
  "originLng": -3.7038,
  "destAddress": "Polígono Industrial, Madrid",
  "destLat": 40.4500,
  "destLng": -3.6800,
  "role": "DRIVER",
  "seats": 4
}
```

| Campo           | Tipo   | Requerido | Validación                                          |
| --------------- | ------ | --------- | --------------------------------------------------- |
| `name`          | string | No        | min 1, max 50                                       |
| `originAddress` | string | Sí        | min 1, max 255                                      |
| `originLat`     | number | Sí        | -90 a 90                                            |
| `originLng`     | number | Sí        | -180 a 180                                          |
| `destAddress`   | string | Sí        | min 1, max 255                                      |
| `destLat`       | number | Sí        | -90 a 90                                            |
| `destLng`       | number | Sí        | -180 a 180                                          |
| `role`          | string | No        | `"DRIVER"` o `"PASSENGER"` (por defecto `"DRIVER"`) |
| `seats`         | number | No        | Int 1–7 (por defecto 1)                             |

**Respuesta 201:**

```json
{
  "status": "Success",
  "message": "Ruta frecuente creada correctamente",
  "frequentRoute": {
    "id": "f1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "name": "Ruta al trabajo",
    "originAddress": "Calle Gran Vía 1, Madrid",
    "originLat": 40.4168,
    "originLng": -3.7038,
    "destAddress": "Polígono Industrial, Madrid",
    "destLat": 40.4500,
    "destLng": -3.6800,
    "role": "DRIVER",
    "seats": 4
  }
}
```

**Errores:**

- `400` — Validación fallida o el usuario no existe.

---

### 2. Obtener mis rutas frecuentes

```
GET /api/frequent-routes/me
```

**Autenticación:** Requerida (`authenticate`)

**Descripción:** Devuelve las rutas frecuentes del usuario autenticado, ordenadas por fecha de actualización.

**Respuesta 200:**

```json
{
  "status": "Success",
  "frequentRoutes": [
    {
      "id": "f1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "name": "Ruta al trabajo",
      "originAddress": "Calle Gran Vía 1, Madrid",
      "originLat": 40.4168,
      "originLng": -3.7038,
      "destAddress": "Polígono Industrial, Madrid",
      "destLat": 40.4500,
      "destLng": -3.6800,
      "role": "DRIVER",
      "seats": 4,
      "createdAt": "2025-01-10T12:00:00.000Z",
      "updatedAt": "2025-01-12T08:30:00.000Z"
    }
  ]
}
```

---

### 3. Obtener rutas frecuentes por usuario

```
GET /api/frequent-routes/user_id/:userIdParam
```

**Autenticación:** Requerida (`authenticate`)

**Descripción:** Devuelve las rutas frecuentes de un usuario específico. El `userIdParam` debe coincidir con el ID del usuario autenticado.

**Path params:**

| Parámetro     | Tipo          | Descripción                                        |
| ------------- | ------------- | -------------------------------------------------- |
| `userIdParam` | string (UUID) | ID del usuario (debe coincidir con el autenticado) |

**Respuesta 200:** Igual que `GET /api/frequent-routes/me`.

**Errores:**

- `401` — No tienes permiso para ver las rutas frecuentes de este usuario.

---

### 4. Obtener ruta frecuente por ID

```
GET /api/frequent-routes/:id
```

**Autenticación:** Requerida (`authenticate`)

**Descripción:** Devuelve una ruta frecuente específica. Solo el propietario puede verla.

**Path params:**

| Parámetro | Tipo          | Descripción             |
| --------- | ------------- | ----------------------- |
| `id`      | string (UUID) | ID de la ruta frecuente |

**Respuesta 200:**

```json
{
  "status": "Success",
  "frequentRoute": {
    "id": "f1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "name": "Ruta al trabajo",
    "originAddress": "Calle Gran Vía 1, Madrid",
    "originLat": 40.4168,
    "originLng": -3.7038,
    "destAddress": "Polígono Industrial, Madrid",
    "destLat": 40.4500,
    "destLng": -3.6800,
    "role": "DRIVER",
    "seats": 4,
    "createdAt": "2025-01-10T12:00:00.000Z",
    "updatedAt": "2025-01-12T08:30:00.000Z"
  }
}
```

**Errores:**

- `400` — ID inválido.
- `404` — Ruta frecuente no encontrada.

---

### 5. Actualizar ruta frecuente

```
PATCH /api/frequent-routes/:id
```

**Autenticación:** Requerida (`authenticate`)

**Descripción:** Actualiza parcialmente una ruta frecuente. Solo el propietario puede actualizarla. No se pueden modificar `id`, `user_id`, `createdAt` ni `updatedAt`.

**Path params:**

| Parámetro | Tipo          | Descripción             |
| --------- | ------------- | ----------------------- |
| `id`      | string (UUID) | ID de la ruta frecuente |

**Body (JSON):** Cualquier subconjunto de:

```json
{
  "name": "Ruta al trabajo (nueva)",
  "seats": 3,
  "role": "PASSENGER"
}
```

**Respuesta 204:** Sin contenido.

**Errores:**

- `400` — Validación fallida o no se proporcionaron campos.
- `401` — No tienes permiso para actualizar esta ruta frecuente.
- `404` — Ruta frecuente no encontrada.

---

### 6. Eliminar ruta frecuente

```
DELETE /api/frequent-routes/:id
```

**Autenticación:** Requerida (`authenticate`)

**Descripción:** Elimina permanentemente una ruta frecuente. Solo el propietario puede eliminarla.

**Path params:**

| Parámetro | Tipo          | Descripción             |
| --------- | ------------- | ----------------------- |
| `id`      | string (UUID) | ID de la ruta frecuente |

**Respuesta 200:**

```json
{
  "status": "Success",
  "message": "Ruta frecuente eliminada correctamente"
}
```

**Errores:**

- `400` — ID inválido.
- `401` — No tienes permiso para eliminar esta ruta frecuente.
- `404` — Ruta frecuente no encontrada.
