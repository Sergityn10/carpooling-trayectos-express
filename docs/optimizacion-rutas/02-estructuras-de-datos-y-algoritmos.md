# Estructuras de Datos y Algoritmos de Enrutamiento

## 1. Índice Espacial R-Tree (RBush)

### 1.1 Concepto
El R-Tree es una estructura en árbol balanceada diseñada para indexar datos multidimensionales (como rectángulos o puntos espaciales). Agrupa objetos cercanos dentro de cajas delimitadoras mínimas (*Minimum Bounding Boxes - MBR*).

```
                  ┌────────────────────── R-Tree Raíz ─────────────────────┐
                  │                                                        │
          ┌───────┴───────┐                                        ┌───────┴───────┐
          │     MBR 1     │                                        │     MBR 2     │
          │ (Zona Norte)  │                                        │  (Zona Sur)   │
          └───┬───────┬───┘                                        └───┬───────┬───┘
              │       │                                                │       │
       ┌──────┴──┐ ┌──┴──────┐                                  ┌──────┴──┐ ┌──┴──────┐
       │ Segment │ │ Segment │                                  │ Segment │ │ Segment │
       │  T0->T1 │ │  T1->T2 │                                  │  S0->S1 │ │  S1->S2 │
       └─────────┘ └─────────┘                                  └─────────┘ └─────────┘
```

### 1.2 Estructura del Elemento Indexado
Cada segmento de ruta entre dos puntos consecutivos $A(lat_A, lng_A)$ y $B(lat_B, lng_B)$ se indexa con el siguiente formato:
```javascript
{
  minX: Math.min(lngA, lngB),
  minY: Math.min(latA, latB),
  maxX: Math.max(lngA, lngB),
  maxY: Math.max(latA, latB),
  trayectoId: "uuid-trayecto",
  stepOrder: 0,
  start: { lat: latA, lng: lngA },
  end: { lat: latB, lng: lngB },
  cumDistanceKm: 12.5,
  cumDurationSec: 650
}
```

### 1.3 Complejidad Temporal
- **Inserción**: $O(\log N)$
- **Eliminación**: $O(\log N)$
- **Búsqueda por Bounding Box**: $O(\log N + K)$ donde $K$ es el número de elementos devueltos.

---

## 2. Proyección Ortogonal de Puntos sobre Segmentos de Carretera

Para calcular con exactitud a qué distancia pasa una ruta de la ubicación deseada por el usuario (y encontrar el punto óptimo de encuentro en la calzada), se utiliza la proyección vectorial:

### 2.1 Fórmulas Matemáticas
Dado el segmento $A \to B$ y el punto del usuario $P$:
1. Corrección longitudinal local por latitud:
   $$s_x = \cos\left(\frac{lat_A \cdot \pi}{180}\right)$$
   $$dx = (lng_B - lng_A) \cdot s_x, \quad dy = lat_B - lat_A$$
   $$px = (lng_P - lng_A) \cdot s_x, \quad py = lat_P - lat_A$$

2. Longitud al cuadrado del segmento:
   $$L^2 = dx^2 + dy^2$$

3. Factor de proyección escalar $t$:
   $$t = \begin{cases} 0 & \text{si } L^2 = 0 \\ \max\left(0, \min\left(1, \frac{px \cdot dx + py \cdot dy}{L^2}\right)\right) & \text{en otro caso} \end{cases}$$

4. Coordenada proyectada $P_{\text{proj}}$:
   $$lat_{\text{proj}} = lat_A + t \cdot (lat_B - lat_A)$$
   $$lng_{\text{proj}} = lng_A + t \cdot (lng_B - lng_A)$$

5. Distancia euclidiana convertida a km:
   $$d = \text{haversine}(P, P_{\text{proj}})$$

---

## 3. Algoritmo de Evaluación de Desvío (*Detour Evaluation*)

Para un trayecto con origen $O_D$ y destino $D_D$, y un pasajero que solicita $O_P \to D_P$:

```
Ruta Original:   O_D ========================================> D_D  (d_orig, t_orig)

Ruta con Desvío: O_D =======> [O_P'] ---> O_P ---> [O_P'] ===> [D_P'] ---> D_P ---> [D_P'] ===> D_D
                              (Recogida con desvío)           (Bajada con desvío)
```

### 3.1 Condiciones de Validación
1. **Orden Temporal y Espacial**:
   $$\text{posicion}(O_P') < \text{posicion}(D_P')$$
   Donde $\text{posicion}$ se mide en distancia acumulada a lo largo de la ruta del conductor.

2. **Cálculo de Incrementos**:
   $$\Delta d = d(O_P', O_P) + d(O_P, O_P') + d(D_P', D_P) + d(D_P, D_P') = 2 \cdot d(O_P', O_P) + 2 \cdot d(D_P', D_P)$$
   $$\Delta t = \frac{\Delta d}{v_{\text{urbana}}} + t_{\text{espera\_recogida}}$$

3. **Restricción de Aceptación**:
   $$\Delta d \le \text{maxDetourKm} \quad \wedge \quad \Delta t \le \text{maxDetourMins} \quad \wedge \quad \frac{\Delta d}{d_{\text{orig}}} \le \text{maxDetourRatio}$$

---

## 4. Algoritmo A\* con Min-Heap para Múltiples Paradas (PDPTW)

### 4.1 Min-Heap (Cola de Prioridad)
- Mantiene ordenados los nodos candidatos por coste estimado total $f(n) = g(n) + h(n)$.
- Operaciones en tiempo logarítmico estricto $O(\log K)$ sin depender de ordenamiento $O(K \log K)$ en cada iteración.

### 4.2 Función Heurística Admisible $h(n)$
Para garantizar la optimalidad en A\*, la heurística $h(n)$ nunca debe sobreestimar el coste real restante:
$$h(n) = \sum_{k \in \text{PasajerosPendientes}} \text{haversine}(\text{ubicacion\_actual}, \text{destino}_k) \times 1.15$$
El multiplicador $1.15$ modela la sinuosidad mínima de la red vial respecto a la línea recta geodésica.

### 4.3 Poda de Ramas y Restricciones Duras
Al expandir un estado sucesor:
1. **Regla de Precedencia**: No se permite visitar el punto de entrega $D_k$ si el punto de recogida $O_k$ no ha sido visitado previamente.
2. **Regla de Capacidad**: En cada transición, el número de pasajeros dentro del vehículo debe cumplir:
   $$\text{ocupación}(n) \le \text{plazas\_disponibles}$$
3. **Regla de Ventana Temporal**: El retraso acumulado respecto a la hora estimada inicial no debe sobrepasar la ventana acordada con los pasajeros ya confirmados.
