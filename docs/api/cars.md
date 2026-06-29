# Gestión de Coches (`/api/cars`)

Endpoints CRUD para gestionar los coches de los usuarios. Todos requieren autenticación.

---

## 1. Crear coche

**URL:** `POST /api/cars`

**Autenticación:** Requerida (`isLoged`).

**Descripción:** Registra un nuevo coche asociado al usuario autenticado. La matrícula debe ser única.

**Entrada (body JSON):**
```json
{
  "matricula": "string (requerido, único)",
  "marca": "string (requerido)",
  "modelo": "string (requerido)",
  "color": "string (opcional)",
  "tipo_combustible": "string (requerido)",
  "num_plazas": "number (requerido)",
  "year": "number (requerido)"
}
```

**Salida (200):**
```json
{
  "status": "Success",
  "message": "Car created successfully",
  "car": {
    "matricula": "1234ABC",
    "marca": "Toyota",
    "modelo": "Corolla",
    "color": "Azul",
    "tipo_combustible": "gasolina",
    "num_plazas": 5,
    "user_id": 1,
    "year": 2020
  }
}
```

**Errores:**
- `400` — Validación fallida o coche ya existe (matrícula duplicada).
- `500` — Error al crear coche.

---

## 2. Actualizar coche (PUT)

**URL:** `PUT /api/cars/:id`

**Autenticación:** Requerida (`isLoged`).

**Descripción:** Actualiza parcialmente un coche por su ID.

**Parámetros de URL:**
- `id` — ID numérico del coche (`id_coche`).

**Entrada (body JSON, campos opcionales):**
```json
{
  "matricula": "string",
  "marca": "string",
  "modelo": "string",
  "color": "string",
  "tipo_combustible": "string",
  "num_plazas": "number",
  "year": "number"
}
```

**Salida (200):**
```json
{
  "status": "Success",
  "message": "Car updated successfully"
}
```

**Errores:**
- `400` — Validación fallida o no hay campos.
- `500` — Error al actualizar.

---

## 3. Eliminar coche

**URL:** `DELETE /api/cars/:id`

**Autenticación:** Requerida (`isLoged`).

**Descripción:** Elimina un coche por su ID.

**Parámetros de URL:**
- `id` — ID numérico del coche (`id_coche`).

**Salida (200):**
```json
{
  "status": "Success",
  "message": "Car deleted successfully"
}
```

**Errores:**
- `500` — Error al eliminar (coche no encontrado).

---

## 4. Obtener coche por ID

**URL:** `GET /api/cars/:id`

**Autenticación:** Requerida (`isLoged`).

**Descripción:** Devuelve los datos de un coche específico.

**Parámetros de URL:**
- `id` — ID numérico del coche (`id_coche`).

**Salida (200):**
```json
{
  "status": "Success",
  "message": "Car found successfully",
  "car": {
    "id_coche": 1,
    "matricula": "1234ABC",
    "marca": "Toyota",
    "modelo": "Corolla",
    "color": "Azul",
    "tipo_combustible": "gasolina",
    "num_plazas": 5,
    "user_id": 1,
    "year": 2020,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

**Errores:**
- `404` — Coche no encontrado.

---

## 5. Obtener coches por usuario

**URL:** `GET /api/cars/user/:userId`

**Autenticación:** Requerida (`isLoged`).

**Descripción:** Devuelve todos los coches asociados a un usuario específico.

**Parámetros de URL:**
- `userId` — ID numérico del usuario.

**Salida (200):**
```json
{
  "status": "Success",
  "message": "Cars found successfully",
  "cars": [
    { "id_coche": 1, "matricula": "1234ABC", ... },
    { "id_coche": 2, "matricula": "5678DEF", ... }
  ]
}
```

**Errores:**
- `404` — Usuario no encontrado.
