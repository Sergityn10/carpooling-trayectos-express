# Trayectos

Endpoints para gestionar trayectos (viajes compartidos).

**Base URL:** `/api/trayecto`

## Modelo de datos

| Campo         | Tipo     | Descripción                                    |
| ------------- | -------- | ---------------------------------------------- |
| `id`          | UUID     | Identificador único del trayecto               |
| `origen`      | String   | Dirección de origen                            |
| `destino`     | String   | Dirección de destino                           |
| `hora`        | DateTime | Fecha y hora de salida (UTC)                   |
| `plazas`      | Int      | Número total de plazas                         |
| `disponible`  | Int      | Plazas disponibles                             |
| `precio`      | Float    | Precio por plaza (€)                           |
| `conductor`   | UUID     | ID del conductor                               |
| `vehiculo_id` | UUID     | **Obligatorio.** ID del vehículo del conductor |
| `routeIndex`  | Int      | Índice de ruta (default 0)                     |
| `status`      | String   | `programado`, `en curso`, `finalizado`         |
| `origen_lat`  | Float    | Latitud del origen (auto)                      |
| `origen_lng`  | Float    | Longitud del origen (auto)                     |
| `destino_lat` | Float    | Latitud del destino (auto)                     |
| `destino_lng` | Float    | Longitud del destino (auto)                    |
| `evento_id`   | UUID     | ID del evento asociado (opcional)              |
| `created_at`  | DateTime | Fecha de creación                              |
| `updated_at`  | DateTime | Fecha de última actualización                  |

## Endpoints

### Listar todos los trayectos

```
GET /api/trayecto
```

**Auth:** Requerida

**Respuesta:** Array de trayectos con datos del conductor (nombre, imagen) y campo `valorado`.

---

### Buscar trayectos

```
GET /api/trayecto/search
```

**Auth:** Opcional

**Query params:**

| Param       | Tipo   | Descripción                   |
| ----------- | ------ | ----------------------------- |
| `origen`    | String | Dirección o ciudad de origen  |
| `destino`   | String | Dirección o ciudad de destino |
| `fecha`     | String | Fecha en formato `YYYY-MM-DD` |
| `plazas`    | Int    | Plazas mínimas requeridas     |
| `evento_id` | UUID   | Filtrar por evento            |

---

### Obtener mis trayectos (como conductor)

```
GET /api/trayecto/mis-trayectos
```

**Auth:** Requerida

---

### Obtener próximos trayectos (como pasajero)

```
GET /api/trayecto/proximos
```

**Auth:** Requerida

---

### Obtener trayecto por ID

```
GET /api/trayecto/:id
```

**Auth:** Opcional

**Respuesta:** Datos completos del trayecto + preferencias del conductor + nombre e imagen del conductor.

---

### Obtener trayecto completo

```
GET /api/trayecto/:id/completo
```

**Auth:** Opcional

**Respuesta:** Trayecto + reservas + eventos + preferencias + información del conductor.

---

### Obtener estado del trayecto (pasajero)

```
GET /api/trayecto/:id/estado
```

**Auth:** Requerida

---

### Crear trayecto

```
POST /api/trayecto
```

**Auth:** Requerida

**Body:**

```json
{
  "origen": "Madrid",
  "destino": "Toledo",
  "fecha": "2026-07-20",
  "hora": "10:00",
  "plazas": 4,
  "precio": 0,
  "conductor": "uuid-del-conductor",
  "vehiculo_id": "uuid-del-vehiculo",
  "routeIndex": 0,
  "evento_id": "uuid-del-evento (opcional)",
  "origen_lat": 40.4168,
  "origen_lng": -3.7038,
  "destino_lat": 39.8628,
  "destino_lng": -4.0273
}
```

**Campos obligatorios:** `origen`, `destino`, `fecha`, `hora`, `plazas`, `precio`, `conductor`, `vehiculo_id`

**Notas:**
- Si `conductor` no se envía, se usa el ID del usuario autenticado.
- Si `disponible` no se envía, se usa el valor de `plazas`.
- Si `precio` es `0`, se calcula automáticamente según el precio del gasoil de la provincia.
- Si la hora está a menos de 2 minutos de ahora, el estado inicial es `en curso`; si no, `programado`.
- Se crea automáticamente un chat asociado al trayecto en el microservicio de mensajes.

**Respuesta 201:**

```json
{
  "status": "Success",
  "message": "Trayecto creado correctamente",
  "trayecto": {
    "id": "uuid",
    "origen": "Madrid",
    "destino": "Toledo",
    "fecha": "2026-07-20",
    "hora": "10:00",
    "plazas": 4,
    "conductor": "Nombre del conductor",
    "conductor_id": "uuid-del-conductor",
    "vehiculo_id": "uuid-del-vehiculo",
    "precio": 5
  }
}
```

---

### Crear trayecto para un evento

```
POST /api/trayecto/evento
```

**Auth:** Requerida

**Body:** Igual que crear trayecto, pero con `evento_id` obligatorio.

---

### Obtener trayectos por evento

```
GET /api/trayecto/evento/:eventoId
```

**Auth:** Opcional

---

### Actualizar trayecto (PATCH parcial)

```
PATCH /api/trayecto/:id
```

**Auth:** No requerida (verificar en producción)

**Body:** Todos los campos del schema (validación completa `validateTrayectoSinId`), incluyendo `vehiculo_id` obligatorio.

**Notas:**
- Recalcula coordenadas si cambia `origen` o `destino`.
- Recalcula `disponible` si cambia `plazas`.

---

### Actualizar trayecto (PUT parcial)

```
PUT /api/trayecto/:id
```

**Auth:** No requerida (verificar en producción)

**Body:** Campos parciales (validación `validateTrayectoPartial`). Si se envía `vehiculo_id`, se actualiza.

**Notas:**
- `fecha` y `hora` deben enviarse juntos si se quieren actualizar.

---

### Iniciar trayecto

```
POST /api/trayecto/:id/iniciar
```

**Auth:** Requerida

**Notas:** Cambia el estado a `en curso` y envía notificaciones (push + email) a conductor y pasajeros.

---

### Finalizar trayecto

```
POST /api/trayecto/:id/finalizar
```

**Auth:** Requerida (solo el conductor puede finalizar)

**Notas:** Cambia el estado a `finalizado`, envía notificaciones (push + email) a conductor y pasajeros, y genera informe CAE.

---

### Eliminar trayecto

```
DELETE /api/trayecto/:id
```

**Auth:** No requerida (verificar en producción)

---

### Obtener trayectos por conductor

```
GET /api/trayecto/conductor/:id
```

**Auth:** Opcional

---

### Actualizar coordenadas (administración)

```
PUT /api/trayecto/update
PUT /api/trayecto/update/id/:id
```

Recalcula las coordenadas (lat/lng) de todos los trayectos o de uno específico a partir de sus direcciones.

---

## Recorridos y recogidas

### Guardar ubicación en tiempo real

```
POST /api/trayecto/:id/recorrido
```

**Auth:** Requerida

### Obtener recorrido

```
GET /api/trayecto/:id/recorrido
```

**Auth:** Requerida

### Crear recogida

```
POST /api/trayecto/:id/recoger
```

**Auth:** Requerida

### Obtener recogidas

```
GET /api/trayecto/:id/recoger
GET /api/trayecto/:id/recoger/:idUser
```

**Auth:** Requerida

### Eliminar recogida

```
DELETE /api/trayecto/:id/recoger/:idUser
```

**Auth:** Requerida

### Registrar llegada a destino

```
POST /api/trayecto/:id/llegada
```

**Auth:** Requerida
