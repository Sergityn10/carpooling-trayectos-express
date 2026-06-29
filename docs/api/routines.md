# Disponibilidad Semanal / Rutas (`/api/routines`)

Endpoints para gestionar la disponibilidad semanal de los usuarios (rutinas recurrentes de transporte). Todos requieren autenticación.

---

## 1. Crear disponibilidad

**URL:** `POST /api/routines`

**Autenticación:** Requerida (`isLoged`).

**Descripción:** Crea un nuevo registro de disponibilidad semanal para el usuario autenticado. Define un día de la semana, horario, origen, destino y finalidad del viaje.

**Entrada (body JSON):**
```json
{
  "dia_semana": "string (Lunes | Martes | Miercoles | Jueves | Viernes | Sabado | Domingo)",
  "hora_inicio": "string (HH:MM)",
  "hora_fin": "string (HH:MM)",
  "transport_needed": "boolean",
  "transporte": "string (opcional, medio de transporte)",
  "estado": "string",
  "finalidad": "string (ej: trabajo, estudio, ocio)",
  "origen": "string",
  "destino": "string"
}
```

**Salida (200):**
```json
{
  "status": "Success",
  "message": "Disponibilidad creada correctamente",
  "disponibilidad": {
    "user_id": 1,
    "dia_semana": "Lunes",
    "hora_inicio": "08:00",
    "hora_fin": "09:00",
    "transport_needed": 1,
    "transporte": null,
    "estado": "activo",
    "finalidad": "trabajo",
    "origen": "Madrid",
    "destino": "Alcobendas",
    "id": 1
  }
}
```

**Errores:**
- `400` — Validación fallida.
- `401` — No autorizado.
- `500` — Error al crear.

---

## 2. Obtener disponibilidad por ID

**URL:** `GET /api/routines/:id`

**Autenticación:** Requerida (`isLoged`).

**Descripción:** Devuelve una disponibilidad específica por su ID. Solo el propietario puede acceder.

**Parámetros de URL:**
- `id` — ID numérico de la disponibilidad.

**Salida (200):**
```json
{
  "status": "Success",
  "message": "Disponibilidad encontrada",
  "disponibilidad": {
    "id": 1,
    "user_id": 1,
    "dia_semana": "Lunes",
    "hora_inicio": "08:00",
    "hora_fin": "09:00",
    "transport_needed": 1,
    "transporte": null,
    "estado": "activo",
    "finalidad": "trabajo",
    "origen": "Madrid",
    "destino": "Alcobendas",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

**Errores:**
- `403` — No tienes permiso para acceder.
- `404` — Disponibilidad no encontrada.
- `500` — Error al obtener.

---

## 3. Actualizar disponibilidad (PUT / PATCH)

**URL:** `PUT /api/routines/:id` o `PATCH /api/routines/:id`

**Autenticación:** Requerida (`isLoged`).

**Descripción:** Actualiza parcialmente una disponibilidad. Solo el propietario puede modificarla. No permite cambiar `user_id` ni `disponibilidad_semana_id`.

**Parámetros de URL:**
- `id` — ID numérico de la disponibilidad.

**Entrada (body JSON, campos opcionales):**
```json
{
  "dia_semana": "string",
  "hora_inicio": "string",
  "hora_fin": "string",
  "transport_needed": "boolean",
  "transporte": "string",
  "estado": "string",
  "finalidad": "string",
  "origen": "string",
  "destino": "string"
}
```

**Salida (200):**
```json
{
  "status": "Success",
  "message": "Disponibilidad actualizada correctamente"
}
```

**Errores:**
- `400` — Validación fallida o no hay campos.
- `403` — No tienes permiso.
- `404` — Disponibilidad no encontrada.
- `500` — Error al actualizar.

---

## 4. Eliminar disponibilidad

**URL:** `DELETE /api/routines/:id`

**Autenticación:** Requerida (`isLoged`).

**Descripción:** Elimina una disponibilidad. Solo el propietario puede eliminarla.

**Parámetros de URL:**
- `id` — ID numérico de la disponibilidad.

**Salida (200):**
```json
{
  "status": "Success",
  "message": "Disponibilidad eliminada"
}
```

**Errores:**
- `403` — No tienes permiso.
- `404` — Disponibilidad no encontrada.
- `500` — Error al eliminar.

---

## 5. Obtener disponibilidades por usuario

**URL:** `GET /api/routines/user/:userId`

**Autenticación:** Requerida (`isLoged`).

**Descripción:** Devuelve todas las disponibilidades semanales de un usuario, ordenadas por día de la semana y hora de inicio.

**Parámetros de URL:**
- `userId` — ID numérico del usuario.

**Salida (200):**
```json
{
  "status": "Success",
  "message": "Disponibilidades encontradas",
  "disponibilidades": [
    {
      "id": 1,
      "user_id": 1,
      "dia_semana": "Lunes",
      "hora_inicio": "08:00",
      "hora_fin": "09:00",
      "finalidad": "trabajo",
      "origen": "Madrid",
      "destino": "Alcobendas",
      ...
    }
  ]
}
```

**Errores:**
- `404` — Usuario no encontrado.
- `500` — Error al obtener.

---

## 6. Obtener disponibilidades por usuario y finalidad

**URL:** `GET /api/routines/user/:userId/finalidad/:finalidad`

**Autenticación:** Requerida (`isLoged`).

**Descripción:** Devuelve las disponibilidades de un usuario filtradas por finalidad (ej: `trabajo`, `estudio`), ordenadas por día y hora.

**Parámetros de URL:**
- `userId` — ID numérico del usuario.
- `finalidad` — Finalidad del viaje (ej: `trabajo`).

**Salida (200):**
```json
{
  "status": "Success",
  "message": "Disponibilidades por finalidad encontradas",
  "disponibilidades": [ ... ]
}
```

**Errores:**
- `500` — Error al obtener.

---

## Notas generales

- **Días de la semana:** Lunes, Martes, Miercoles, Jueves, Viernes, Sabado, Domingo.
- **Orden:** Las disponibilidades se ordenan por día de la semana (Lunes=1 ... Domingo=7) y luego por `hora_inicio`.
- **Permisos:** Cada usuario solo puede acceder/modificar/eliminar sus propias disponibilidades (verificación via `user_id`).
- **`transport_needed`:** Booleano que indica si el usuario necesita transporte (1) o si ofrece transporte (0).
