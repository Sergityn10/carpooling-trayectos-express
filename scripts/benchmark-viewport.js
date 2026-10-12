/**
 * Benchmark de rendimiento para búsqueda por Viewport en R-Tree.
 * Ejecutar con: npm run benchmark
 */

import { SpatialIndex } from "../app/services/routing/spatial-index.js";
import { GeoMath } from "../app/services/routing/geo-math.js";

function generateRandomTrip(tripId, centerLat, centerLng, radiusKm = 20, numTramos = 8) {
  const tramos = [];
  let currentLat = centerLat + (Math.random() - 0.5) * (radiusKm / 111);
  let currentLng = centerLng + (Math.random() - 0.5) * (radiusKm / (111 * Math.cos(centerLat * Math.PI / 180)));

  for (let i = 0; i < numTramos; i++) {
    tramos.push({
      lat: currentLat,
      lng: currentLng,
      address: `Punto ${i}`,
      step_order: i,
    });

    const angle = Math.random() * 2 * Math.PI;
    const distKm = Math.random() * 5 + 1;
    currentLat += (distKm / 111) * Math.cos(angle);
    currentLng += (distKm / (111 * Math.cos(currentLat * Math.PI / 180))) * Math.sin(angle);
  }
  return tramos;
}

function generateRandomBBox(centerLat, centerLng, sizeDeg = 0.5) {
  const half = sizeDeg / 2;
  return {
    minLat: centerLat - half,
    maxLat: centerLat + half,
    minLng: centerLng - half,
    maxLng: centerLng + half,
  };
}

async function runBenchmark() {
  console.log("============================================================");
  console.log("🚀 BENCHMARK R-Tree Viewport Search");
  console.log("============================================================\n");

  const index = new SpatialIndex();
  const NUM_TRIPS = 10000;
  const NUM_QUERIES = 1000;

  // Ciudades principales de España para distribución realista
  const cities = [
    { name: "Madrid", lat: 40.4168, lng: -3.7038 },
    { name: "Barcelona", lat: 41.3851, lng: 2.1734 },
    { name: "Valencia", lat: 39.4699, lng: -0.3763 },
    { name: "Sevilla", lat: 37.3891, lng: -5.9845 },
    { name: "Zaragoza", lat: 41.6488, lng: -0.8891 },
    { name: "Málaga", lat: 36.7213, lng: -4.4214 },
    { name: "Murcia", lat: 37.9922, lng: -1.1307 },
    { name: "Palma", lat: 39.5696, lng: 2.6502 },
    { name: "Las Palmas", lat: 28.1235, lng: -15.4363 },
    { name: "Bilbao", lat: 43.2630, lng: -2.9350 },
  ];

  console.log(`📦 Indexando ${NUM_TRIPS} trayectos sintéticos (Bulk STR)...`);
  const indexStart = process.hrtime.bigint();

  // Generar todos los datos primero para bulk loading
  const trayectosData = [];
  for (let i = 0; i < NUM_TRIPS; i++) {
    const city = cities[i % cities.length];
    const tramos = generateRandomTrip(`trip-${i}`, city.lat, city.lng, 30, 6 + Math.floor(Math.random() * 8));
    trayectosData.push({ trayectoId: `trip-${i}`, tramos, metadata: {} });
  }

  index.loadBulk(trayectosData);

  const indexEnd = process.hrtime.bigint();
  const indexTimeMs = Number(indexEnd - indexStart) / 1_000_000;
  console.log(`✅ Indexación completada en ${indexTimeMs.toFixed(2)} ms`);
  console.log(`   Promedio: ${(indexTimeMs / NUM_TRIPS).toFixed(4)} ms/trayecto\n`);

  // Calentar el motor
  console.log("🔥 Calentando motor de búsqueda...");
  for (let i = 0; i < 100; i++) {
    const city = cities[Math.floor(Math.random() * cities.length)];
    const bbox = generateRandomBBox(city.lat, city.lng, 0.3);
    index.searchBBox(bbox);
  }
  console.log("✅ Calentamiento completado\n");

  // Benchmark de consultas
  console.log(`🔍 Ejecutando ${NUM_QUERIES} consultas de BBox aleatorias...`);
  const queryTimes = [];
  let totalResults = 0;

  const queryStart = process.hrtime.bigint();
  for (let i = 0; i < NUM_QUERIES; i++) {
    const city = cities[Math.floor(Math.random() * cities.length)];
    const bbox = generateRandomBBox(city.lat, city.lng, 0.2 + Math.random() * 0.4);

    const qStart = process.hrtime.bigint();
    const results = index.searchBBox(bbox);
    const qEnd = process.hrtime.bigint();

    queryTimes.push(Number(qEnd - qStart) / 1_000_000);
    totalResults += results.length;
  }
  const queryEnd = process.hrtime.bigint();
  const totalQueryTimeMs = Number(queryEnd - queryStart) / 1_000_000;

  // Estadísticas
  queryTimes.sort((a, b) => a - b);
  const avgTime = queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length;
  const p50 = queryTimes[Math.floor(queryTimes.length * 0.5)];
  const p95 = queryTimes[Math.floor(queryTimes.length * 0.95)];
  const p99 = queryTimes[Math.floor(queryTimes.length * 0.99)];
  const maxTime = queryTimes[queryTimes.length - 1];

  console.log("\n📊 RESULTADOS DE RENDIMIENTO:");
  console.log("------------------------------------------------------------");
  console.log(`Total trayectos indexados:     ${NUM_TRIPS.toLocaleString()}`);
  console.log(`Total consultas ejecutadas:    ${NUM_QUERIES.toLocaleString()}`);
  console.log(`Tiempo total consultas:        ${totalQueryTimeMs.toFixed(2)} ms`);
  console.log(`Throughput:                    ${(NUM_QUERIES / (totalQueryTimeMs / 1000)).toFixed(0)} consultas/seg`);
  console.log("------------------------------------------------------------");
  console.log(`Tiempo promedio:               ${avgTime.toFixed(4)} ms`);
  console.log(`P50 (mediana):                 ${p50.toFixed(4)} ms`);
  console.log(`P95:                           ${p95.toFixed(4)} ms`);
  console.log(`P99:                           ${p99.toFixed(4)} ms`);
  console.log(`Máximo:                        ${maxTime.toFixed(4)} ms`);
  console.log("------------------------------------------------------------");
  console.log(`Resultados promedio/consulta:  ${(totalResults / NUM_QUERIES).toFixed(1)} segmentos`);
  console.log("------------------------------------------------------------");

  // Verificación de objetivos
  console.log("\n🎯 VERIFICACIÓN DE OBJETIVOS (SLA):");
  console.log(`P95 < 10 ms:        ${p95 < 10 ? "✅ PASA" : "❌ FALLA"} (${p95.toFixed(4)} ms)`);
  console.log(`P99 < 20 ms:        ${p99 < 20 ? "✅ PASA" : "❌ FALLA"} (${p99.toFixed(4)} ms)`);
  console.log(`Avg < 2 ms:         ${avgTime < 2 ? "✅ PASA" : "❌ FALLA"} (${avgTime.toFixed(4)} ms)`);
  console.log(`Throughput > 500/s: ${(NUM_QUERIES / (totalQueryTimeMs / 1000)) > 500 ? "✅ PASA" : "❌ FALLA"} (${(NUM_QUERIES / (totalQueryTimeMs / 1000)).toFixed(0)}/s)`);

  // Test de memoria
  console.log("\n🧪 TEST DE MEMORIA (10k consultas adicionales)...");
  const memBefore = process.memoryUsage().heapUsed;
  for (let i = 0; i < 10000; i++) {
    const city = cities[Math.floor(Math.random() * cities.length)];
    const bbox = generateRandomBBox(city.lat, city.lng, 0.3);
    index.searchBBox(bbox);
  }
  const memAfter = process.memoryUsage().heapUsed;
  const memDiffMB = (memAfter - memBefore) / 1024 / 1024;
  console.log(`Delta memoria heap: ${memDiffMB.toFixed(2)} MB`);
  console.log(`${memDiffMB < 5 ? "✅ Sin fugas de memoria aparentes" : "⚠️ Posible fuga de memoria"}`);

  // Test de búsqueda cercana (searchNearbySegments)
  console.log("\n📍 TEST BÚSQUEDA CERCANA (searchNearbySegments)...");
  const nearbyStart = process.hrtime.bigint();
  for (let i = 0; i < 1000; i++) {
    const city = cities[Math.floor(Math.random() * cities.length)];
    index.searchNearbySegments(city.lat, city.lng, 2.0);
  }
  const nearbyEnd = process.hrtime.bigint();
  const nearbyTimeMs = Number(nearbyEnd - nearbyStart) / 1_000_000;
  console.log(`1000 búsquedas cercanas: ${nearbyTimeMs.toFixed(2)} ms (${(nearbyTimeMs / 1000 * 1000).toFixed(2)} μs/op)`);

  console.log("\n============================================================");
  console.log("✅ BENCHMARK COMPLETADO");
  console.log("============================================================");
}

runBenchmark().catch(err => {
  console.error("❌ Error en benchmark:", err);
  process.exit(1);
});