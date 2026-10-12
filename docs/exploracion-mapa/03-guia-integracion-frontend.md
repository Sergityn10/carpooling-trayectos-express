# Guía de Integración Frontend - Mapa de Exploración de Trayectos

## 1. Flujo Básico de Integración

```typescript
// 1. Obtener bounds del mapa
const bounds = map.getBounds(); // Leaflet / Mapbox / Google Maps

// 2. Construir query params
const params = new URLSearchParams({
  minLat: bounds.getSouth().toFixed(6),
  maxLat: bounds.getNorth().toFixed(6),
  minLng: bounds.getWest().toFixed(6),
  maxLng: bounds.getEast().toFixed(6),
  zoom: map.getZoom().toString(),
  precision: map.getZoom() < 10 ? 'bounds' : 'simplified',
  limit: '50'
});

// 3. Llamar a la API con cancelación
const controller = new AbortController();
const response = await fetch(`/api/trayecto/viewport?${params}`, {
  signal: controller.signal
});
const { data, meta } = await response.json();

// 4. Renderizar en el mapa
renderTrips(data);
```

---

## 2. Control de Peticiones: Debounce + AbortController

### 2.1 Hook Personalizado (React + Leaflet/Mapbox)

```typescript
// useMapViewport.ts
import { useEffect, useRef, useCallback } from 'react';

export function useMapViewport(map, onViewportChange, delay = 300) {
  const abortRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastBoundsRef = useRef<string | null>(null);

  const fetchViewport = useCallback(async (bounds, zoom) => {
    // Cancelar petición anterior
    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = new AbortController();

    const params = new URLSearchParams({
      minLat: bounds._southWest.lat.toFixed(6),
      maxLat: bounds._northEast.lat.toFixed(6),
      minLng: bounds._southWest.lng.toFixed(6),
      maxLng: bounds._northEast.lng.toFixed(6),
      zoom: zoom.toString(),
      precision: zoom < 10 ? 'bounds' : 'simplified',
      limit: '50'
    });

    try {
      const res = await fetch(`/api/trayecto/viewport?${params}`, {
        signal: abortRef.current.signal
      });
      if (!res.ok) throw new Error('Error en la respuesta');
      const json = await res.json();
      onViewportChange(json.data, json.meta);
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error('Error fetching viewport:', e);
      }
    }
  }, [onViewportChange]);

  useEffect(() => {
    if (!map) return;

    const handleMoveEnd = () => {
      const bounds = map.getBounds();
      const zoom = map.getZoom();
      const boundsKey = `${bounds._southWest.lat},${bounds._southWest.lng},${bounds._northEast.lat},${bounds._northEast.lng},${zoom}`;

      // Evitar peticiones duplicadas si el viewport no cambió significativamente
      if (boundsKey === lastBoundsRef.current) return;
      lastBoundsRef.current = boundsKey;

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        fetchViewport(bounds, zoom);
      }, delay);
    };

    map.on('moveend', handleMoveEnd);
    map.on('zoomend', handleMoveEnd);

    // Carga inicial
    handleMoveEnd();

    return () => {
      map.off('moveend', handleMoveEnd);
      map.off('zoomend', handleMoveEnd);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [map, fetchViewport, delay]);
}
```

### 2.2 Uso en Componente

```tsx
// MapaExploracion.tsx
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet';
import { useMapViewport } from './useMapViewport';

export function MapaExploracion() {
  const mapRef = useRef(null);
  const [trips, setTrips] = useState([]);
  const [meta, setMeta] = useState(null);

  useMapViewport(mapRef.current, (data, m) => {
    setTrips(data);
    setMeta(m);
  });

  return (
    <MapContainer
      ref={mapRef}
      center={[40.4168, -3.7038]}
      zoom={12}
      style={{ height: '100vh', width: '100%' }}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {trips.map(trip => (
        <TripLayer key={trip.id} trip={trip} />
      ))}
    </MapContainer>
  );
}
```

---

## 3. Renderizado de Capas - Formato Unificado

A partir de la v2.0, **todas las respuestas incluyen `encodedPolyline` y `puntosClave`** por defecto. El campo `geometry` (GeoJSON) solo se incluye si se solicita explícitamente con `?format=geojson` o `?format=both`.

### 3.1 Componente `TripLayer` Unificado

```tsx
// TripLayer.tsx
import { Marker, Polyline, Popup } from 'react-leaflet';
import L from 'leaflet';
import polyline from '@mapbox/polyline'; // npm i @mapbox/polyline

const carIcon = L.icon({
  iconUrl: '/icons/car-marker.svg',
  iconSize: [32, 32],
  iconAnchor: [16, 32]
});

export function TripLayer({ trip }) {
  const { encodedPolyline, puntosClave, geometry, precio, plazasDisponibles, hora, conductor } = trip;

  // Decodificar polilínea (máx 1ms, ~300 bytes)
  const coordinates = trip.encodedPolyline 
    ? polyline.decode(trip.encodedPolyline).map(([lat, lng]) => [lat, lng])
    : geometry?.coordinates?.map(([lng, lat]) => [lat, lng]) ?? [];

  // Puntos clave para marcadores inmediatos (origen/destino)
  const { origen, destino } = trip.puntosClave;

  return (
    <>
      <Polyline
        positions={coordinates}
        color="#2563eb"
        weight={3}
        opacity={0.8}
        lineCap="round"
        lineJoin="round"
      />
      {coordinates.length > 0 && (
        <>
          <Marker position={coordinates[0]} icon={carIcon}>
            <Popup>
              <strong>{trip.origen}</strong><br />
              {new Date(trip.hora).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} · {trip.precio}€ · {trip.plazasDisponibles} plazas
            </Popup>
          </Marker>
          <Marker position={coordinates[coordinates.length - 1]} icon={carIcon}>
            <Popup>{trip.destino}</Popup>
          </Marker>
        </>
      )}
    </>
  );
}
```

### 3.2 Decodificación de Polilíneas por Framework

| Framework / Librería | Código de decodificación |
|----------------------|---------------------------|
| **Leaflet + @mapbox/polyline** | `polyline.decode(encodedPolyline).map(([lat, lng]) => [lat, lng])` |
| **Google Maps JS API** | `google.maps.geometry.encoding.decodePath(encodedPolyline)` |
| **Mapbox GL JS** | `mapbox.Polyline.fromEncoded(encodedPolyline).getCoordinates()` |
| **OpenLayers** | `ol.format.Polyline().readGeometry(encodedPolyline).getCoordinates()` |
| **Vanilla JS** | `@mapbox/polyline` o implementación nativa (~20 líneas) |

### 3.3 Estrategia de Carga Adaptativa

```typescript
// En el hook useMapViewport
const precision = zoom < 10 ? 'bounds' : 'simplified';
const format = zoom < 10 ? 'bounds' : 'both'; // encoded + geometry opcional

const params = new URLSearchParams({
  minLat: bounds.getSouth().toFixed(6),
  maxLat: bounds.getNorth().toFixed(6),
  minLng: bounds.getWest().toFixed(6),
  maxLng: bounds.getEast().toFixed(6),
  zoom: map.getZoom().toString(),
  precision,
  format,
  limit: '50'
});
```

| Zoom | `precision` | `format` | Respuesta |
|------|-------------|----------|-----------|
| 1-9 | `bounds` | `bounds` | Solo `puntosClave` (clustering) |
| 10-14 | `simplified` | `encoded` | `encodedPolyline` + `puntosClave` |
| 15+ | `full` | `both` | `encodedPolyline` + `geometry` (LineString completo) |

---

## 4. Manejo de Caché en Cliente (Opcional)

```typescript
// viewCache.ts - Evitar peticiones redundantes
interface CachedViewport {
  bounds: { minLat, minLng, maxLat, maxLng };
  zoom: number;
  data: any[];
  timestamp: number;
}

const cache = new Map<string, CachedViewport>();
const CACHE_TTL = 30_000; // 30 segundos

function getCacheKey(bounds, zoom) {
  return `${bounds.minLat.toFixed(4)},${bounds.minLng.toFixed(4)},${bounds.maxLat.toFixed(4)},${bounds.maxLng.toFixed(4)},${zoom}`;
}

function isContainedInCached(newBounds, cachedBounds) {
  return (
    newBounds.minLat >= cachedBounds.minLat &&
    newBounds.maxLat <= cachedBounds.maxLat &&
    newBounds.minLng >= cachedBounds.minLng &&
    newBounds.maxLng <= cachedBounds.maxLng
  );
}

export function getCachedOrFetch(bounds, zoom, fetchFn) {
  const key = getCacheKey(bounds, zoom);
  const now = Date.now();

  // Buscar en caché entradas que contengan el viewport actual
  for (const [, entry] of cache) {
    if (now - entry.timestamp < CACHE_TTL && isContainedInCached(bounds, entry.bounds)) {
      return Promise.resolve(entry.data);
    }
  }

  return fetchFn().then(data => {
    cache.set(key, { bounds, zoom, data, timestamp: now });
    // Limpiar caché antigua
    for (const [k, v] of cache) {
      if (now - v.timestamp > CACHE_TTL) cache.delete(k);
    }
    return data;
  });
}
```

---

## 5. Tipos TypeScript para la Respuesta

```typescript
// types/trayecto-viewport.ts
export interface ViewportTrip {
  id: string;
  origen: string;
  destino: string;
  hora: string; // ISO 8601
  precio: number;
  plazasTotales: number;
  plazasDisponibles: number;
  conductor: {
    id: string;
    nombre: string;
    avatar?: string;
    rating: number;
  };
  puntosClave: {
    origen: { lat: number; lng: number };
    destino: { lat: number; lng: number };
  };
  geometry?: {
    type: 'LineString';
    coordinates: [number, number][]; // [lng, lat] - GeoJSON order
  };
}

export interface ViewportResponse {
  status: 'Success';
  meta: {
    totalMatches: number;
    viewport: {
      minLat: number;
      minLng: number;
      maxLat: number;
      maxLng: number;
      zoom: number;
    };
    clustered?: boolean;
  };
  data: ViewportTrip[];
}

export interface ViewportError {
  status: 'Error';
  message: string;
  errors?: { field: string; message: string }[];
}
```

---

## 6. Checklist de Integración

- [ ] Configurar `AbortController` en cada petición de viewport
- [ ] Implementar debounce mínimo 300ms en `moveend`/`zoomend`
- [ ] Manejar respuesta vacía (`data.length === 0`) con UI amigable
- [ ] Renderizar polilíneas con `lineCap="round"` para aspecto suave
- [ ] Mostrar loading skeleton mientras llega la primera respuesta
- [ ] Implementar retry automático (exponential backoff) en errores 5xx
- [ ] Testear en mobile: touch move + zoom pinch
- [ ] Verificar rendimiento con 100+ trayectos simultáneos en mapa