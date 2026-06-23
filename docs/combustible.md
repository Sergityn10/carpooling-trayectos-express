# Precios de Combustible (Oil)

Endpoints que consultan la API externa de precios de combustible del Ministerio para España.

---

### 1. Listado de provincias

```
GET /api/oil/provincias
```

**Autenticación:** No requerida

**Descripción:** Obtiene el listado de provincias disponibles en la API de precios de combustible.

**Respuesta 200:** Array de provincias con sus IDs.

---

### 2. Municipios por provincia

```
GET /api/oil/provincias/:idProvincia/municipios
```

**Autenticación:** No requerida

**Descripción:** Obtiene los municipios de una provincia.

**Path params:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `idProvincia` | string | ID de la provincia |

**Respuesta 200:** Array de municipios.

---

### 3. Estaciones por municipio

```
GET /api/oil/estaciones/municipio/:idMunicipio
```

**Autenticación:** No requerida

**Descripción:** Obtiene las estaciones de servicio de un municipio.

**Path params:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `idMunicipio` | string | ID del municipio |

**Respuesta 200:** Array de estaciones de servicio.

---

### 4. Estaciones por radio

```
GET /api/oil/estaciones/radio
```

**Autenticación:** No requerida

**Descripción:** Busca estaciones de servicio dentro de un radio desde unas coordenadas.

**Query params:**

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `latitud` | number | Sí | Latitud del punto central |
| `longitud` | number | Sí | Longitud del punto central |
| `radio` | number | No | Radio de búsqueda en km |
| `pagina` | number | No | Página de resultados |
| `limite` | number | No | Número de resultados por página |

**Respuesta 200:** Array de estaciones de servicio.

---

### 5. Detalles de una estación

```
GET /api/oil/estaciones/:idEstacion/detalles
```

**Autenticación:** No requerida

**Descripción:** Devuelve los detalles de una estación de servicio por su ID.

**Path params:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `idEstacion` | string | ID de la estación |

**Respuesta 200:** Objeto con los detalles de la estación.

---

### 6. Estaciones cercanas a una estación

```
GET /api/oil/estaciones/:idEstacion/cerca
```

**Autenticación:** No requerida

**Descripción:** Devuelve las estaciones cercanas a una estación concreta.

**Path params:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `idEstacion` | string | ID de la estación de referencia |

**Query params:**

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `radio` | number | No | Radio de búsqueda en km |

**Respuesta 200:** Array de estaciones cercanas.

---

### 7. Histórico de precios de una estación

```
GET /api/oil/estaciones/:idEstacion/historico
```

**Autenticación:** No requerida

**Descripción:** Devuelve el histórico de precios de una estación de servicio.

**Path params:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `idEstacion` | string | ID de la estación |

**Query params:**

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `fechaInicio` | string | No | Fecha de inicio del rango |
| `fechaFin` | string | No | Fecha de fin del rango |

**Respuesta 200:** Array de registros históricos de precios.

---

### 8. Precio medio diario

```
GET /api/oil/precio-medio-diario
```

**Autenticación:** No requerida

**Descripción:** Devuelve el precio medio diario de combustible.

**Query params:**

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `idFuelType` | number | No | Tipo de combustible |
| `fechaInicio` | string | No | Fecha de inicio |
| `fechaFin` | string | No | Fecha de fin |

**Respuesta 200:** Datos del precio medio diario.

---

### 9. Precios medios por provincia (por ID)

```
GET /api/oil/precios/medios/provincia/:idProvincia
```

**Autenticación:** No requerida

**Descripción:** Devuelve los precios medios de combustible para una provincia por su ID.

**Path params:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `idProvincia` | string | ID de la provincia |

**Query params:**

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `idFuelType` | number | No | Tipo de combustible |

**Respuesta 200:** Datos de precios medios.

---

### 10. Precios medios por provincia (por nombre)

```
GET /api/oil/precios/medios/provincia-nombre/:provincia
```

**Autenticación:** No requerida

**Descripción:** Devuelve los precios medios de combustible para una provincia por su nombre.

**Path params:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `provincia` | string | Nombre de la provincia |

**Query params:**

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `idFuelType` | number | No | Tipo de combustible |

**Respuesta 200:** Datos de precios medios.

---

### 11. Precio medio de gasoil por provincia (por ID)

```
GET /api/oil/precios/gasoil/provincia/:idProvincia
```

**Autenticación:** No requerida

**Descripción:** Devuelve el precio medio de gasoil para una provincia por su ID.

**Path params:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `idProvincia` | string | ID de la provincia |

**Respuesta 200:**

```json
{
  "idProvincia": "28",
  "averagePrice": 1.45
}
```

---

### 12. Precio medio de gasoil por provincia (por nombre)

```
GET /api/oil/precios/gasoil/provincia-nombre/:provincia
```

**Autenticación:** No requerida

**Descripción:** Devuelve el precio medio de gasoil para una provincia por su nombre.

**Path params:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `provincia` | string | Nombre de la provincia |

**Respuesta 200:**

```json
{
  "provincia": "Madrid",
  "averagePrice": 1.45
}
```

---

### 13. Precios por provincia (por nombre)

```
GET /api/oil/precios/provincia/:provincia
```

**Autenticación:** No requerida

**Descripción:** Devuelve los precios de combustible para una provincia por su nombre.

**Path params:**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `provincia` | string | Nombre de la provincia |

**Query params:**

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `idFuelType` | number | No | Tipo de combustible |

**Respuesta 200:** Datos de precios por provincia.
