# Eventos y Etiquetas (`/api/events`, `/api/tags`)

Endpoints para gestión de eventos de plataforma, etiquetas (tags) y sus relaciones. Las operaciones de creación, actualización y eliminación requieren rol **admin**. La lectura es accesible para usuarios autenticados.

---

## Modelos de datos

### PlatformEvent
| Campo         | Tipo          | Descripción                                        |
| ------------- | ------------- | -------------------------------------------------- |
| `id`          | UUID          | Identificador único                                |
| `name`        | String        | Nombre del evento                                  |
| `company_id`  | UUID (FK)     | Empresa que genera el evento                       |
| `latitude`    | Decimal(10,7) | Latitud de la ubicación                            |
| `longitude`   | Decimal(10,7) | Longitud de la ubicación                           |
| `image`       | MediumText    | Imagen del evento (base64 o URL)                   |
| `unique_code` | String(20)    | Código único para unirse al evento (auto-generado) |
| `description` | Text          | Descripción general del evento                     |
| `url`         | String(500)   | URL del evento                                     |
| `ticket_url`  | String(500)   | URL para comprar entradas                          |
| `created_at`  | DateTime      | Fecha de creación                                  |
| `updated_at`  | DateTime      | Fecha de actualización                             |

### Tag
| Campo         | Tipo        | Descripción                 |
| ------------- | ----------- | --------------------------- |
| `id`          | Int (auto)  | Identificador único         |
| `name`        | String(50)  | Nombre único de la etiqueta |
| `description` | String(255) | Descripción de la etiqueta  |
| `created_at`  | DateTime    | Fecha de creación           |

### Company
| Campo         | Tipo        | Descripción            |
| ------------- | ----------- | ---------------------- |
| `id`          | UUID        | Identificador único    |
| `name`        | String(255) | Nombre de la empresa   |
| `email`       | String(255) | Email único            |
| `phone`       | String(30)  | Teléfono               |
| `website`     | String(255) | Sitio web              |
| `logo`        | MediumText  | Logo de la empresa     |
| `description` | Text        | Descripción            |
| `created_at`  | DateTime    | Fecha de creación      |
| `updated_at`  | DateTime    | Fecha de actualización |

---

## Eventos

### 1. Listar eventos

**URL:** `GET /api/events`

**Autenticación:** Requerida (`isLoged`).

**Query params (opcionales):**
- `search` — Buscar por nombre del evento.
- `tag` — Filtrar por nombre de etiqueta.
- `page` — Número de página (default: 1).
- `limit` — Resultados por página (default: 20, máx: 100).

**Salida (200):**
```json
{
  "status": "Success",
  "events": [
    {
      "id": "uuid",
      "name": "Hackathon YouConnext 2025",
      "company_id": "uuid",
      "latitude": 40.416775,
      "longitude": -3.703790,
      "image": "base64...",
      "unique_code": "A1B2C3D4E5F6",
      "description": "Descripción del evento",
      "url": "https://evento.com",
      "ticket_url": "https://evento.com/entradas",
      "created_at": "2025-07-03T10:00:00Z",
      "updated_at": "2025-07-03T10:00:00Z",
      "company": { "id": "uuid", "name": "YouConnext", "logo": null },
      "tags": [
        { "tag": { "id": 1, "name": "programacion", "description": "..." } }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "totalPages": 3
  }
}
```

---

### 2. Obtener evento por ID

**URL:** `GET /api/events/:id`

**Autenticación:** Requerida (`isLoged`).

**Parámetros de URL:**
- `id` — UUID del evento.

**Salida (200) — evento encontrado:**
```json
{
  "status": "Success",
  "event": {
    "id": "uuid",
    "name": "Hackathon YouConxt 2025",
    "company_id": "uuid",
    "latitude": 40.416775,
    "longitude": -3.703790,
    "image": "base64...",
    "unique_code": "A1B2C3D4E5F6",
    "description": "Descripción del evento",
    "url": "https://evento.com",
    "ticket_url": "https://evento.com/entradas",
    "created_at": "2025-07-03T10:00:00Z",
    "updated_at": "2025-07-03T10:00:00Z",
    "company": { "id": "uuid", "name": "YouConxt", "email": "...", "phone": "...", "website": "...", "logo": null, "description": "..." },
    "tags": [
      { "tag": { "id": 1, "name": "programacion", "description": "..." } }
    ]
  }
}
```

**Salida (200) — evento no encontrado:**
```json
{
  "status": "Success",
  "event": null
}
```

> **Nota:** Este endpoint siempre devuelve `200`. Si el evento no existe, `event` es `null`.

---

### 3. Obtener eventos cercanos

**URL:** `GET /api/events/nearby`

**Autenticación:** Requerida (`isLoged`).

**Descripción:** Devuelve los eventos ordenados por distancia a la ubicación proporcionada. Usa la fórmula de Haversine para calcular la distancia entre coordenadas. Solo incluye eventos que tengan `latitude` y `longitude` definidas.

**Query params:**
- `lat` — Latitud de la ubicación del usuario (requerido).
- `lng` — Longitud de la ubicación del usuario (requerido).
- `radius` — Radio de búsqueda en km (default: 50).
- `tag` — Filtrar por nombre de etiqueta (opcional).
- `limit` — Número máximo de resultados (default: 20, máx: 100).

**Ejemplo:**
```
GET /api/events/nearby?lat=40.416775&lng=-3.703790&radius=25&limit=10
```

**Salida (200):**
```json
{
  "status": "Success",
  "events": [
    {
      "id": "uuid",
      "name": "Hackathon YouConnext 2025",
      "latitude": 40.416775,
      "longitude": -3.703790,
      "unique_code": "A1B2C3D4E5F6",
      "distance_km": 0.51,
      "company": { "id": "uuid", "name": "YouConnext", "logo": null },
      "tags": [
        { "tag": { "id": 1, "name": "programacion", "description": "..." } }
      ]
    }
  ],
  "pagination": {
    "total": 5,
    "limit": 10,
    "radius_km": 25
  }
}
```

**Errores:**
- `400` — Faltan `lat` o `lng`.

---

### 4. Obtener evento por código único

**URL:** `GET /api/events/code/:code`

**Autenticación:** Requerida (`isLoged`).

**Parámetros de URL:**
- `code` — Código único del evento (ej: `A1B2C3D4E5F6`).

**Salida (200):** Igual que obtener por ID, pero la empresa solo incluye campos públicos (`id`, `name`, `logo`, `website`).

**Errores:**
- `404` — Evento no encontrado.

---

### 5. Crear evento

**URL:** `POST /api/events`

**Autenticación:** Requerida (`onlyAdmin`).

**Entrada (body JSON):**
```json
{
  "name": "Hackathon YouConnext 2025",
  "company_id": "uuid",
  "latitude": 40.416775,
  "longitude": -3.703790,
  "image": "base64...",
  "description": "Descripción del evento",
  "url": "https://evento.com",
  "ticket_url": "https://evento.com/entradas",
  "tags": [1, 3, 5]
}
```

**Campos requeridos:** `name`, `company_id`.
**Campos opcionales:** `latitude`, `longitude`, `image`, `description`, `url`, `ticket_url`, `tags` (array de IDs de etiquetas).
**Auto-generado:** `unique_code` (12 caracteres alfanuméricos).

**Salida (201):**
```json
{
  "status": "Success",
  "message": "Event created successfully",
  "event": {
    "id": "uuid",
    "name": "Hackathon YouConnext 2025",
    "unique_code": "A1B2C3D4E5F6",
    "company": { "id": "uuid", "name": "YouConnext" },
    "tags": [
      { "tag": { "id": 1, "name": "programacion", "description": "..." } }
    ]
  }
}
```

**Errores:**
- `400` — Faltan `name` o `company_id`.
- `404` — Empresa no encontrada.
- `403` — No es admin.

---

### 6. Actualizar evento

**URL:** `PATCH /api/events/:id`

**Autenticación:** Requerida (`onlyAdmin`).

**Parámetros de URL:**
- `id` — UUID del evento.

**Entrada (body JSON, todos opcionales):**
```json
{
  "name": "Nuevo nombre",
  "company_id": "uuid",
  "latitude": 41.3851,
  "longitude": 2.1734,
  "image": "base64...",
  "description": "Nueva descripción",
  "url": "https://nueva-url.com",
  "ticket_url": "https://nueva-url.com/entradas",
  "tags": [1, 2, 3]
}
```

> **Nota:** Si se envía `tags`, se reemplazan todas las etiquetas del evento. Enviar `tags: []` para eliminar todas.

**Salida (200):**
```json
{
  "status": "Success",
  "message": "Event updated successfully",
  "event": { ... }
}
```

**Errores:**
- `404` — Evento o empresa no encontrada.
- `403` — No es admin.

---

### 7. Eliminar evento

**URL:** `DELETE /api/events/:id`

**Autenticación:** Requerida (`onlyAdmin`).

**Parámetros de URL:**
- `id` — UUID del evento.

**Salida (200):**
```json
{
  "status": "Success",
  "message": "Event deleted successfully"
}
```

**Errores:**
- `404` — Evento no encontrado.
- `403` — No es admin.

> **Nota:** Al eliminar un evento, se eliminan en cascada todas sus relaciones con etiquetas (`event_tags`).

---

## Etiquetas (Tags)

### 8. Listar etiquetas

**URL:** `GET /api/tags`

**Autenticación:** Requerida (`isLoged`).

**Salida (200):**
```json
{
  "status": "Success",
  "tags": [
    { "id": 1, "name": "programacion", "description": "Eventos de programación y desarrollo de software", "created_at": "..." },
    { "id": 2, "name": "tecnologia", "description": "Eventos tecnológicos generales", "created_at": "..." }
  ]
}
```

---

### 9. Crear etiqueta

**URL:** `POST /api/tags`

**Autenticación:** Requerida (`onlyAdmin`).

**Entrada (body JSON):**
```json
{
  "name": "nueva-etiqueta",
  "description": "Descripción de la etiqueta"
}
```

**Salida (201):**
```json
{
  "status": "Success",
  "message": "Tag created successfully",
  "tag": { "id": 16, "name": "nueva-etiqueta", "description": "..." }
}
```

**Errores:**
- `400` — Falta `name`.
- `409` — La etiqueta ya existe.
- `403` — No es admin.

---

### 10. Eliminar etiqueta

**URL:** `DELETE /api/tags/:id`

**Autenticación:** Requerida (`onlyAdmin`).

**Parámetros de URL:**
- `id` — ID numérico de la etiqueta.

**Salida (200):**
```json
{
  "status": "Success",
  "message": "Tag deleted successfully"
}
```

**Errores:**
- `404` — Etiqueta no encontrada.
- `403` — No es admin.

> **Nota:** Al eliminar una etiqueta, se eliminan en cascada todas sus relaciones con eventos (`event_tags`).

---

## Etiquetas por defecto (seed)

El seed crea automáticamente las siguientes etiquetas:

| ID  | Name                      | Descripción                                      |
| --- | ------------------------- | ------------------------------------------------ |
| 1   | `programacion`            | Eventos de programación y desarrollo de software |
| 2   | `tecnologia`              | Eventos tecnológicos generales                   |
| 3   | `inteligencia-artificial` | IA, machine learning y deep learning             |
| 4   | `ciberseguridad`          | Seguridad informática y ciberdefensa             |
| 5   | `diseño`                  | Diseño UX/UI, gráfico y producto                 |
| 6   | `marketing`               | Marketing digital y crecimiento                  |
| 7   | `networking`              | Eventos de networking profesional                |
| 8   | `startups`                | Emprendimiento y ecosistema startup              |
| 9   | `blockchain`              | Blockchain, crypto y Web3                        |
| 10  | `cloud-computing`         | Cloud, DevOps e infraestructura                  |
| 11  | `data-science`            | Ciencia de datos y analítica                     |
| 12  | `videojuegos`             | Game development y industria gamer               |
| 13  | `movilidad`               | Movilidad sostenible y transporte                |
| 14  | `sostenibilidad`          | Sostenibilidad y medio ambiente                  |
| 15  | `educacion`               | Educación tecnológica y formación                |

---

## Notas generales

- **Permisos:** Las operaciones de lectura (`GET`) requieren autenticación (`isLoged`). Las operaciones de escritura (`POST`, `PATCH`, `DELETE`) requieren rol admin (`onlyAdmin`).
- **Código único:** Se genera automáticamente al crear un evento usando `crypto.randomBytes` (12 caracteres hexadecimales en mayúsculas).
- **Paginación:** Los endpoints de listado soportan paginación con `page` y `limit`.
- **Filtrado:** Se puede filtrar por nombre (`search`) y por etiqueta (`tag`) en `GET /api/events`.
- **Relaciones:** Al eliminar un evento o etiqueta, las relaciones en `event_tags` se eliminan en cascada.
- **Orden de rutas:** `/api/events/nearby` y `/api/events/code/:code` están registradas antes de `/api/events/:id` para evitar conflictos de routing en Express.
- **Imagen en base64:** El campo `image` de `PlatformEvent` es de tipo `MediumText` y almacena la imagen codificada en base64 (igual que `img_perfil` en usuarios y `logo` en empresas).
- **Evento no encontrado:** `GET /api/events/:id` devuelve `200` con `event: null` en lugar de un error `404` cuando el evento no existe.
