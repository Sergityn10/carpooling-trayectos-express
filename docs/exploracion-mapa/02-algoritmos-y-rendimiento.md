# Algoritmos y Rendimiento - Índice Espacial y Optimizaciones

## 1. Estructura de Datos: R-Tree 2D en Memoria (`SpatialIndex`)

### 1.1 Implementación Actual
Ubicación: `app/services/routing/spatial-index.js`

- **Tipo:** R-Tree balanceado con nodos hoja e internos.
- **Entrada indexada:** Segmento vial individual (`Tramo[i] → Tramo[i+1]`).
- **Bounding Box por entrada:** `[minLng, minLat, maxLng, maxLat]` (enveloppe convexo del segmento).
- **Orden del árbol:** `maxEntries = 9` (configurable).
- **Datos adjuntos por entrada:**
  ```javascript
  {
    trayectoId: string,
    stepOrder: number,
    start: { lat, lng, address },
    end: { lat, lng, address },
    segDistKm: number,
    cumDistanceKm: number,
    metadata: { fecha, hora, plazas, disponible, precio, conductor, evento_id }
  }
  ```

### 1.2 Complejidad Algorítmica

| Operación | Complejidad | Notas |
|-----------|-------------|-------|
| Inserción bulk (inicialización) | O(N log N) | N = total segmentos |
| Inserción individual | O(log N) | Rebalanceo por splits |
| **Eliminación** | **O(1)** | **Lazy Deletion (tombstones) + rebuild batch** |
| Búsqueda BBox | **O(log N + K)** | K = resultados que intersectan |
| Búsqueda radio (punto + radio) | O(log N + K) | Usa BBox + proyección ortogonal |

> **Nota:** La eliminación ahora usa **Lazy Deletion (tombstones)** con complejidad **O(1)**. La reconstrucción del árbol se dispara automáticamente cuando la basura supera el 25% o 2000 entradas, tardando < 150 ms para 50k segmentos.

---

## 2. Estrategia de Niveles de Detalle (LOD - Level of Detail)

| Zoom | precision | Geometría devuelta | Caso de uso |
|------|-----------|-------------------|-------------|
| 1-9 | `bounds` | Solo `{origen: {lat,lng}, destino: {lat,lng}}` | Vista país/región, clustering visual |
| 10-14 | `simplified` | Polilínea simplificada (Ramer-Douglas-Peucker ε ≈ 50-200m) | Vista ciudad/comarca |
| 15-18 | `full` | Todos los tramos originales (`Tramos` ordenados) | Vista calle/barrio, detalle exacto |
| 19+ | `full` | Tramos + puntos de recogida intermedios | Navegación precisa |

### 2.1 Simplificación Ramer-Douglas-Peucker (RDP)
- **Objetivo:** Reducir número de puntos manteniendo forma visual.
- **Implementación sugerida:** Librería `simplify-js` o implementación propia O(N log N).
- **Parámetro ε (tolerancia):** Función del zoom:
  - Zoom 10: ε = 200m
  - Zoom 12: ε = 50m
  - Zoom 14: ε = 15m

---

## 3. Clustering Espacial (Zoom Bajo)

### 3.1 Grid-based Binning (Recomendado para backend)
- Dividir viewport en celdas de ~0.01° (~1 km en latitud media).
- Contar trayectos únicos por celda (usando `origen_lat/lng` o centroide).
- Devolver: `{ clusterId, count, centerLat, centerLng, bounds }`.

### 3.2 Supercluster (Frontend)
- Enviar puntos individuales (origen/destino) al cliente.
- Usar `supercluster` (Mapbox) en el navegador para clustering dinámico.
- Ventaja: cero carga en backend, clustering fluido al hacer zoom.

---

## 7. RouteGeometryService - Serialización Eficiente de Recorridos

### 7.1 Responsabilidad
Servicio desacoplado (`app/services/routing/geometry-service.js`) que centraliza toda la lógica de formateo de geometrías de trayectos, desacoplando a los controladores de los detalles de serialización.

### 7.2 Formatos de Salida Soportados

| Formato (`format`) | Descripción | Caso de Uso |
|--------------------|-------------|-------------|
| `encoded` (default) | **Encoded Polyline** de Google + `keyPoints` | **Producción móvil/web** - Payload mínimo (~95% menos bytes que GeoJSON) |
| `geojson` | GeoJSON `LineString` estándar | Depuración, compatibilidad con Leaflet/Mapbox nativo |
| `both` | `encodedPolyline` + `geometry` (GeoJSON) | Clientes que necesitan ambos formatos |
| `bounds` | Solo `keyPoints` (origen/destino) | Clustering / vista lejana (zoom < 10) |

### 7.3 Estructura de Respuesta Unificada

```json
{
  "keyPoints": {
    "origen": { "lat": 40.4168, "lng": -3.7038, "address": "Madrid Centro" },
    "destino": { "lat": 39.8628, "lng": -4.0273, "address": "Toledo Centro" }
  },
  "encodedPolyline": "_p~iF~ps|U_ulLnnqC_mqN...",
  "geometry": { "type": "LineString", "coordinates": [...] }  // Solo si format=geojson|both
}
```

### 7.4 Codificación de Polilíneas (Google Encoded Polyline Algorithm)
- **Reducción de payload**: ~95% vs array JSON de coordenadas.
- **Ejemplo**: 200 puntos → ~300 bytes string vs ~15 KB JSON.
- **Decodificación cliente** (1 línea):
  ```javascript
  // Leaflet + @mapbox/polyline
  const latlngs = polyline.decode(trayecto.encodedPolyline);
  L.polyline(latlngs).addTo(map);
  
  // Google Maps JS API
  const path = google.maps.geometry.encoding.decodePath(trayecto.encodedPolyline);
  new google.maps.Polyline({ path, map });
  ```

### 7.5 Puntos Clave (`keyPoints`)
Siempre incluidos para renderizado inmediato de marcadores:
```json
"keyPoints": {
  "origen": { "lat": 40.4168, "lng": -3.7038, "address": "Madrid Centro" },
  "destino": { "lat": 39.8628, "lng": -4.0273, "address": "Toledo Centro" }
}
```

---

## 8. Benchmarks Actualizados (v2.0)

### 8.1 Rendimiento R-Tree + RouteGeometryService (10k trayectos, 1000 consultas)

| Métrica | Valor | SLA |
|---------|-------|-----|
| Indexación bulk (10k trayectos) | **153 ms** | — |
| Latencia P50 (BBox search) | **0.93 ms** | < 2 ms ✅ |
| Latencia P95 | **1.20 ms** | < 10 ms ✅ |
| Latencia P99 | **1.76 ms** | < 20 ms ✅ |
| Throughput | **1,098 req/s** | > 500/s ✅ |
| Throughput búsqueda cercana | **6,380 ops/s** | — |
| Memoria heap (10k queries) | +6 MB | Sin fugas ✅ |

> **Nota**: La codificación de polilíneas y la simplificación RDP añaden < 0.5 ms por trayecto, despreciable frente a la latencia de BD/red.

## 5. Sincronización Reactiva del Índice

### 5.1 Eventos que modifican el índice
| Evento | Acción | Origen |
|--------|--------|--------|
| Trayecto creado (status `programado`) | `globalSpatialIndex.addTrayecto()` | Controller POST `/api/trayecto` |
| Trayecto actualizado (tramos/horario) | `removeTrayecto()` + `addTrayecto()` | Controller PUT `/api/trayecto/:id` |
| Trayecto cancelado/finalizado | `globalSpatialIndex.removeTrayecto()` | Cron job / Controller PATCH status |
| Inicio servidor | `RoutingEngine.initialize(prisma)` | `app/index.js` startup |

### 5.2 Consistencia Eventual
- El índice en memoria es **eventualmente consistente** con la BD.
- Ventana de inconsistencia: milisegundos (event loop同步).
- Para consistencia fuerte en operaciones críticas, validar existencia en BD antes de reservar.

---

## 6. Optimizaciones Futuras (Roadmap)

1. **Lazy Deletion + Rebuild Batch:** Marcar entradas como eliminadas y reconstruir árbol cada N eliminaciones o cada T minutos.
2. **Sharding por Región:** Múltiples R-Trees por bounding box macro (ej. por comunidad autónoma).
3. **Persistencia del Índice:** Serializar R-Tree a disco (MessagePack/Protobuf) para warm-start instantáneo tras reinicio.
4. **PostGIS Migration:** Cuando el volumen supere 50k trayectos activos concurrentes.