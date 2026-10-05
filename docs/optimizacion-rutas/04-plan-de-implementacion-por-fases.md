# Plan de Implementación por Fases

## Fase 1: Núcleo Matemático y Estructuras Espaciales
- [x] Crear documentación de arquitectura y diseño.
- [ ] Implementar `app/services/routing/geo-math.js`:
  - Fórmulas geodésicas de Haversine.
  - Proyección vectorial ortogonal en calzada.
  - Distancia perpendicular mínima.
- [ ] Implementar `app/services/routing/min-heap.js`:
  - Cola de prioridad binaria ($O(\log K)$) para Dijkstra y A*.
- [ ] Implementar `app/services/routing/spatial-index.js`:
  - Índice R-Tree 2D en memoria para segmentos viales.
  - Métodos de inserción, eliminación y búsqueda de cajas de proximidad.

---

## Fase 2: Motor de Desvíos y Matching de Pasajeros
- [ ] Implementar `app/services/routing/distance-matrix.js`:
  - Caché LRU de distancias/tiempos entre coordenadas.
- [ ] Implementar `app/services/routing/route-evaluator.js`:
  - Evaluación de desvíos para recogida y bajada de pasajeros.
  - Validación de orden espacial estricto ($\text{recogida} \prec \text{destino}$).
  - Cálculo de $\Delta \text{Distancia}$, $\Delta \text{Tiempo}$ y ratio de desvío.

---

## Fase 3: Algoritmo A\* Multi-Parada (PDPTW)
- [ ] Implementar `app/services/routing/pathfinder.js`:
  - Algoritmo A* con poda de estados por capacidad y precedencia.
  - Secuenciación óptima de puntos intermedios.
- [ ] Implementar `app/services/routing/routing-engine.js`:
  - Fachada unificada que integra todos los submódulos.

---

## Fase 4: Integración en Controladores y Ciclo de Vida
- [ ] Conectar `RoutingEngine` en `app/index.js` para inicialización en el arranque.
- [ ] Integrar en `app/controllers/trayectos.js` para acelerar la búsqueda de trayectos regulares y por evento.
- [ ] Conectar eventos de creación/cancelación para mantener el R-Tree sincronizado.

---

## Fase 5: Pruebas, Benchmarking y Verificación
- [ ] Crear tests unitarios para matemáticas vectoriales y A*.
- [ ] Crear script de benchmarking (`scripts/benchmark-routing.js`).
- [ ] Validar tiempos de respuesta y rendimiento bajo carga.
