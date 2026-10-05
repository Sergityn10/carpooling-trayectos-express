/**
 * Script de validación y test unitario para el motor de enrutamiento y estructuras de datos.
 */

import {
  GeoMath,
  MinHeap,
  SpatialIndex,
  DistanceMatrixCache,
  RouteEvaluator,
  Pathfinder,
  RoutingEngine,
} from "../app/services/routing/routing-engine.js";

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FALLÓ: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASÓ: ${message}`);
}

console.log("==================================================");
console.log("🧪 INICIANDO TESTS UNITARIOS DEL MOTOR DE RUTAS");
console.log("==================================================\n");

// 1. Test GeoMath
console.log("--- 1. GeoMath & Proyecciones ---");
const madrid = { lat: 40.4168, lng: -3.7038 };
const getafe = { lat: 40.3083, lng: -3.7327 };
const toledo = { lat: 39.8628, lng: -4.0273 };

const distMadridGetafe = GeoMath.haversineKm(
  madrid.lat,
  madrid.lng,
  getafe.lat,
  getafe.lng,
);
assert(
  distMadridGetafe > 11 && distMadridGetafe < 14,
  `Distancia Madrid-Getafe esperada ~12km, obtenida: ${distMadridGetafe.toFixed(2)}km`,
);

// Punto intermedio cerca de la autovía Madrid-Toledo (por ejemplo Pinto)
const pinto = { lat: 40.2417, lng: -3.6997 };
const proj = GeoMath.projectPointOnSegment(pinto, madrid, toledo);
assert(
  proj.distanceKm < 10,
  `Proyección ortogonal de Pinto sobre Madrid-Toledo a ${proj.distanceKm.toFixed(2)}km`,
);
assert(
  proj.t > 0 && proj.t < 1,
  `Parámetro de interpolación t dentro de segmento: ${proj.t.toFixed(2)}`,
);

// 2. Test MinHeap
console.log("\n--- 2. MinHeap Priority Queue ---");
const heap = new MinHeap();
heap.push({ id: "node3", priority: 30 });
heap.push({ id: "node1", priority: 10 });
heap.push({ id: "node2", priority: 20 });
heap.push({ id: "node0", priority: 5 });

assert(heap.pop().id === "node0", "MinHeap extrajo correctamente el mínimo (5)");
assert(
  heap.pop().id === "node1",
  "MinHeap extrajo correctamente el siguiente (10)",
);
assert(
  heap.pop().id === "node2",
  "MinHeap extrajo correctamente el siguiente (20)",
);
assert(
  heap.pop().id === "node3",
  "MinHeap extrajo correctamente el último (30)",
);
assert(heap.isEmpty(), "MinHeap queda vacío tras extraer todos");

// 3. Test SpatialIndex (R-Tree)
console.log("\n--- 3. SpatialIndex (R-Tree 2D) ---");
const index = new SpatialIndex();
const tramosMadridToledo = [
  { lat: 40.4168, lng: -3.7038, address: "Madrid Centro", step_order: 0 },
  { lat: 40.3083, lng: -3.7327, address: "Getafe", step_order: 1 },
  { lat: 40.1500, lng: -3.8500, address: "Illescas", step_order: 2 },
  { lat: 39.8628, lng: -4.0273, address: "Toledo Centro", step_order: 3 },
];

index.addTrayecto("trip-madrid-toledo", tramosMadridToledo);

const nearbySegments = index.searchNearbySegments(40.308, -3.732, 2.0); // Cerca de Getafe
assert(
  nearbySegments.length > 0,
  `R-Tree encontró ${nearbySegments.length} tramos cercanos a Getafe`,
);
assert(
  nearbySegments[0].entry.trayectoId === "trip-madrid-toledo",
  "R-Tree identificó el ID de trayecto correcto",
);

// 4. Test RouteEvaluator (Detour & Strict Order)
console.log("\n--- 4. RouteEvaluator (Detour Matching) ---");
const fakeTrip = {
  id: "trip-madrid-toledo",
  origen_lat: madrid.lat,
  origen_lng: madrid.lng,
  destino_lat: toledo.lat,
  destino_lng: toledo.lng,
  hora: new Date().toISOString(),
  disponible: 3,
};

// Caso A: Pasajero va de Getafe a Illescas (en la misma dirección del conductor)
const matchCorrecto = RouteEvaluator.evaluateTripMatch(
  fakeTrip,
  tramosMadridToledo,
  {
    origin: { lat: 40.3083, lng: -3.7327 }, // Getafe
    destination: { lat: 40.15, lng: -3.85 }, // Illescas
    maxDetourKm: 5,
    maxDetourMins: 15,
  },
);
assert(
  matchCorrecto.isMatch === true,
  "Evaluador aceptó trayecto en el mismo sentido (Getafe -> Illescas)",
);
assert(
  matchCorrecto.detourKm < 1.0,
  `Desvío mínimo calculado: ${matchCorrecto.detourKm}km`,
);

// Caso B: Pasajero va en sentido contrario (Illescas -> Getafe)
const matchInvertido = RouteEvaluator.evaluateTripMatch(
  fakeTrip,
  tramosMadridToledo,
  {
    origin: { lat: 40.15, lng: -3.85 }, // Illescas
    destination: { lat: 40.3083, lng: -3.7327 }, // Getafe
    maxDetourKm: 5,
    maxDetourMins: 15,
  },
);
assert(
  matchInvertido.isMatch === false,
  "Evaluador rechazó correctamente el trayecto en sentido contrario (orden invertido)",
);

// 5. Test Pathfinder (A* Multi-Stop PDP)
console.log("\n--- 5. Pathfinder (A* Multi-Stop PDP) ---");
const passengerRequests = [
  {
    id: "pasajero-1",
    pickup: { lat: 40.3083, lng: -3.7327, address: "Getafe Recogida" },
    dropoff: { lat: 40.15, lng: -3.85, address: "Illescas Bajada" },
    seats: 1,
  },
  {
    id: "pasajero-2",
    pickup: { lat: 40.24, lng: -3.7, address: "Pinto Recogida" },
    dropoff: { lat: 39.8628, lng: -4.0273, address: "Toledo Bajada" },
    seats: 1,
  },
];

const itinerary = Pathfinder.solveMultiStopItinerary(
  madrid,
  toledo,
  passengerRequests,
  4,
);
assert(itinerary.success === true, "Pathfinder resolvió el itinerario multi-parada");
assert(
  itinerary.orderedStops.length === 6,
  `Itinerario cuenta con 6 paradas (origen conductor, 2 recogidas, 2 bajadas, destino final). Obtenidas: ${itinerary.orderedStops.length}`,
);

console.log("Secuencia de paradas optimizada con A*:");
itinerary.orderedStops.forEach((stop, idx) => {
  console.log(`  ${idx + 1}. [${stop.type}] ${stop.address || stop.type} (${stop.lat.toFixed(4)}, ${stop.lng.toFixed(4)})`);
});

console.log("\n==================================================");
console.log("🎉 TODOS LOS TESTS DEL MOTOR DE RUTAS PASARON CON ÉXITO");
console.log("==================================================");
