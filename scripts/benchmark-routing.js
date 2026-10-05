/**
 * Benchmark de rendimiento: R-Tree Spatial Index vs Búsqueda Lineal
 */

import {
  SpatialIndex,
  GeoMath,
} from "../app/services/routing/routing-engine.js";

console.log("==================================================");
console.log("⚡ INICIANDO BENCHMARK DE RENDIMIENTO GEOESPACIAL");
console.log("==================================================\n");

const NUM_TRAYECTOS = 2000;
const TRAMOS_PER_TRAYECTO = 15;
const TOTAL_SEGMENTS = NUM_TRAYECTOS * (TRAMOS_PER_TRAYECTO - 1);

console.log(
  `Generando ${NUM_TRAYECTOS} trayectos sintéticos (~${TOTAL_SEGMENTS} segmentos viales)...`,
);

const index = new SpatialIndex();
const rawTramosList = [];

// Generar rutas sintéticas aleatorias alrededor de la Península Ibérica
for (let t = 0; t < NUM_TRAYECTOS; t++) {
  const baseLat = 36.5 + Math.random() * 6.5; // España: lat 36.5 a 43.0
  const baseLng = -8.5 + Math.random() * 11.5; // España: lng -8.5 a 3.0

  const tramos = [];
  let curLat = baseLat;
  let curLng = baseLng;

  for (let s = 0; s < TRAMOS_PER_TRAYECTO; s++) {
    curLat += (Math.random() - 0.5) * 0.05;
    curLng += (Math.random() - 0.5) * 0.05;
    tramos.push({
      lat: curLat,
      lng: curLng,
      step_order: s,
    });
  }

  index.addTrayecto(`trayecto-${t}`, tramos);
  rawTramosList.push({ id: `trayecto-${t}`, tramos });
}

console.log(
  `✅ Estructuras cargadas en memoria (${TOTAL_SEGMENTS} segmentos indexados).\n`,
);

const NUM_QUERIES = 200;
const queryPoints = [];
for (let q = 0; q < NUM_QUERIES; q++) {
  queryPoints.push({
    lat: 36.5 + Math.random() * 6.5,
    lng: -8.5 + Math.random() * 11.5,
    radiusKm: 5.0,
  });
}

// 1. Benchmark Búsqueda Lineal Clásica O(N * M)
console.log(`⏱️ Ejecutando ${NUM_QUERIES} consultas con Búsqueda Lineal...`);
const startLinear = performance.now();
let linearMatches = 0;

for (const q of queryPoints) {
  for (const item of rawTramosList) {
    let matched = false;
    for (const tramo of item.tramos) {
      const dist = GeoMath.haversineKm(q.lat, q.lng, tramo.lat, tramo.lng);
      if (dist <= q.radiusKm) {
        matched = true;
        break;
      }
    }
    if (matched) linearMatches++;
  }
}
const endLinear = performance.now();
const timeLinearMs = endLinear - startLinear;

// 2. Benchmark R-Tree Index O(log N)
console.log(`⚡ Ejecutando ${NUM_QUERIES} consultas con R-Tree Spatial Index...`);
const startRTree = performance.now();
let rtreeMatches = 0;

for (const q of queryPoints) {
  const matches = index.searchNearbyTrayectoIds(q.lat, q.lng, q.radiusKm);
  rtreeMatches += matches.size;
}
const endRTree = performance.now();
const timeRTreeMs = endRTree - startRTree;

console.log("\n==================================================");
console.log("📊 RESULTADOS COMPARATIVOS:");
console.log("==================================================");
console.log(
  `• Búsqueda Lineal O(N*M): ${timeLinearMs.toFixed(2)} ms (${(timeLinearMs / NUM_QUERIES).toFixed(3)} ms/query)`,
);
console.log(
  `• R-Tree Espacial O(logN): ${timeRTreeMs.toFixed(2)} ms (${(timeRTreeMs / NUM_QUERIES).toFixed(3)} ms/query)`,
);
const speedup = timeLinearMs / Math.max(0.1, timeRTreeMs);
console.log(`🚀 Factor de Aceleración: ${speedup.toFixed(1)}x más rápido!`);
console.log("==================================================\n");
