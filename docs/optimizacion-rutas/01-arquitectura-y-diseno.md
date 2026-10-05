# Arquitectura y Diseño del Motor de Optimización de Rutas

## 1. Visión General
El motor de optimización de rutas y cálculo de desvíos está diseñado para transformar la búsqueda lineal y rígida de trayectos en un sistema reactivo, geoespacialmente indexado y capaz de evaluar desvíos tolerables (*detour routing*) y múltiples paradas (*multi-stop ride matching*).

---

## 2. Diagrama de Arquitectura

```
                        ┌──────────────────────────────────────────────┐
                        │              Petición HTTP                   │
                        │ (Origen, Destino, Fecha, Pasajeros, Desvío)  │
                        └──────────────────────┬───────────────────────┘
                                               │
                                               ▼
                        ┌──────────────────────────────────────────────┐
                        │          RoutingEngine (Fachada)             │
                        └──────┬───────────────┬────────────────┬──────┘
                               │               │                │
            ┌──────────────────┘               │                └──────────────────┐
            ▼                                  ▼                                   ▼
┌───────────────────────┐          ┌───────────────────────┐           ┌───────────────────────┐
│     SpatialIndex      │          │     RouteEvaluator    │           │      Pathfinder       │
│  (R-Tree 2D en RAM)   │          │ (Proyección y Desvío) │           │    (A* Multi-Stop)    │
│  - Búsqueda en O(logN)│          │ - Proyección ortogonal│           │  - Secuenciación      │
│  - Segmentos viales   │          │ - Filtro de orden     │           │  - Min-Heap Priority  │
│  - Bounding boxes     │          │ - Δd y Δt tolerables  │           │  - Precedencia y cupo │
└───────────────────────┘          └───────────────────────┘           └───────────────────────┘
            │                                  │                                   │
            └──────────────────────────────────┼───────────────────────────────────┘
                                               ▼
                                   ┌───────────────────────┐
                                   │    DistanceMatrix     │
                                   │  (Caché LRU de dist.) │
                                   └───────────────────────┘
                                               │
                                               ▼
                                   ┌───────────────────────┐
                                   │  Respuesta Enriquecida│
                                   │  (Matches con Desvío) │
                                   └───────────────────────┘
```

---

## 3. Módulos y Responsabilidades

### 3.1 `SpatialIndex` (`app/services/routing/spatial-index.js`)
- **Propósito**: Indexación espacial en memoria de alta velocidad.
- **Estructura**: Árbol R-Tree 2D que indexa la envolvente convexa (bounding box) de cada segmento individual de los trayectos activos (`[x_min, y_min, x_max, y_max]`).
- **Complejidad**: Búsqueda de candidatos en $O(\log N + K)$, donde $N$ es el total de segmentos viales y $K$ el número de resultados.
- **Ciclo de vida**:
  - `initialize(prisma)`: Carga y calienta el árbol con los trayectos futuros programados.
  - `addTrayecto(trayecto, tramos)`: Indexa los nuevos tramos al publicarse un trayecto.
  - `removeTrayecto(trayectoId)`: Elimina del índice cuando el viaje se cancela o completa.

### 3.2 `GeoMath` (`app/services/routing/geo-math.js`)
- **Propósito**: Utilidades geométricas y trigonométricas optimizadas numéricamente.
- **Funcionalidades**:
  - Fórmula de Haversine con radio medio terrestre $R = 6371\text{ km}$.
  - Proyección ortogonal de punto sobre segmento euclidiano local.
  - Distancia perpendicular mínima punto-línea.
  - Sinuosidad y estimación empírica de velocidad según distancia.

### 3.3 `RouteEvaluator` (`app/services/routing/route-evaluator.js`)
- **Propósito**: Determinar si una ruta de conductor es compatible con la petición de un pasajero considerando desvíos.
- **Reglas de compatibilidad**:
  1. **Orden estricto**: El punto de recogida proyectado $O'_p$ debe ocurrir antes que el punto de destino proyectado $D'_p$ a lo largo de la secuencia del trayecto (`step_order` o distancia acumulada).
  2. **Desvío máximo absoluto**: $\Delta d \le \text{maxDetourKm}$ (por defecto 5 km) y $\Delta t \le \text{maxDetourMins}$ (por defecto 15 min).
  3. **Desvío relativo**: $\frac{d_{\text{nuevo}}}{d_{\text{original}}} \le 1 + \alpha$ (por defecto $\alpha = 0.20$).

### 3.4 `Pathfinder` (`app/services/routing/pathfinder.js`)
- **Propósito**: Optimización de orden de paradas cuando hay múltiples reservas en un mismo vehículo (*Pickup and Delivery Problem with Time Windows*).
- **Algoritmo**: A* y Branch & Bound asistido por `MinHeap`.
- **Restricciones duras**:
  - Precedencia: $\text{visitar}(O_i) \prec \text{visitar}(D_i)$ para cada pasajero $i$.
  - Capacidad: Pasajeros simultáneos $\le \text{plazas\_totales}$.

### 3.5 `DistanceMatrix` (`app/services/routing/distance-matrix.js`)
- **Propósito**: Reducir la latencia y evitar el gasto excesivo de APIs externas.
- **Implementación**: Caché LRU de pares de coordenadas redondeadas a 4 decimales (~11 m de resolución), guardando tuplas `{ distanceKm, durationSec }`.

---

## 4. Estrategia de Escalabilidad y Concurrencia

1. **Memoria Ligera**: Un índice R-Tree para 50.000 tramos consume menos de 15 MB de RAM en Node.js.
2. **Sincronización Reactiva**: El índice espacial se actualiza en tiempo real mediante eventos en la capa de controladores o consumidores de colas (RabbitMQ).
3. **Desacoplamiento**: El servicio no depende de librerías nativas en C++ difíciles de compilar en entornos serverless/Docker, sino de algoritmos puros en JavaScript moderno (ES Modules).
