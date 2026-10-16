import { database as prisma } from "../app/database.js";
import { RouteGeometryService } from "../app/services/routing/geometry-service.js";
import { GoogleMapsProvider } from "../app/providers/google-maps.js";
import { randomUUID } from "node:crypto";

/**
 * Script de Backfill / Migración para poblar `overview_polyline` en trayectos existentes.
 * 
 * Uso:
 *   node scripts/backfill-polylines.js                 (Modo estándar: genera polilíneas desde Tramos o coordenadas)
 *   node scripts/backfill-polylines.js --fetch-google  (Modo enriquecido: consulta Google Directions para los de 0 tramos)
 */

const fetchGoogleForEmpty = process.argv.includes("--fetch-google");

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runBackfill() {
  console.log("=== INICIANDO BACKFILL DE OVERVIEW_POLYLINE ===");
  console.log(`Modo: ${fetchGoogleForEmpty ? "Enriquecido (--fetch-google)" : "Estándar (sin llamadas externas a Google)"}`);

  const pendingTrayectos = await prisma.trayecto.findMany({
    where: {
      OR: [
        { overview_polyline: null },
        { overview_polyline: "" },
      ],
    },
    include: {
      Tramos: {
        orderBy: { step_order: "asc" },
      },
    },
  });

  console.log(`[Backfill] Encontrados ${pendingTrayectos.length} trayectos sin overview_polyline.`);

  let updatedFromTramos = 0;
  let updatedFromGoogle = 0;
  let updatedFromCoords = 0;
  let skipped = 0;
  let errors = 0;

  for (const t of pendingTrayectos) {
    try {
      // Caso 1: Tiene tramos en base de datos
      if (t.Tramos && t.Tramos.length >= 2) {
        const rawCoords = t.Tramos.map((tr) => [tr.lng, tr.lat]);
        const encoded = RouteGeometryService.encodePolyline(rawCoords);
        if (encoded) {
          await prisma.trayecto.update({
            where: { id: t.id },
            data: { overview_polyline: encoded },
          });
          updatedFromTramos++;
          continue;
        }
      }

      // Caso 2: No tiene tramos suficientes, pero sí coordenadas de origen y destino
      if (
        t.origen_lat != null &&
        t.origen_lng != null &&
        t.destino_lat != null &&
        t.destino_lng != null
      ) {
        // Si se especificó --fetch-google, consultar la API de Google Directions
        if (fetchGoogleForEmpty) {
          try {
            console.log(`[Backfill] Consultando Google Directions para trayecto ${t.id} (${t.origen} -> ${t.destino})...`);
            const route = await GoogleMapsProvider.getDirections(
              `${t.origen_lat},${t.origen_lng}`,
              `${t.destino_lat},${t.destino_lng}`,
              t.routeIndex || 0,
            );

            if (route.overviewPolyline) {
              await prisma.trayecto.update({
                where: { id: t.id },
                data: { overview_polyline: route.overviewPolyline },
              });

              // Si tampoco tenía tramos, guardar los nuevos tramos decodificados
              if ((!t.Tramos || t.Tramos.length === 0) && route.steps.length > 0) {
                await prisma.tramo.createMany({
                  data: route.steps.map((step, idx) => ({
                    id: randomUUID(),
                    id_trayecto: t.id,
                    lat: step.lat,
                    lng: step.lng,
                    address: step.address || "",
                    step_order: idx,
                  })),
                });
              }

              updatedFromGoogle++;
              // Pausa de cortesía para no saturar la cuota de Google
              await sleep(200);
              continue;
            }
          } catch (gErr) {
            console.warn(`[Backfill] Falló consulta a Google para trayecto ${t.id}:`, gErr?.message ?? gErr);
          }
        }

        // Fallback: generar polilínea directa con origen y destino
        const fallbackEncoded = RouteGeometryService.encodePolyline([
          [t.origen_lng, t.origen_lat],
          [t.destino_lng, t.destino_lat],
        ]);

        await prisma.trayecto.update({
          where: { id: t.id },
          data: { overview_polyline: fallbackEncoded },
        });
        updatedFromCoords++;
        continue;
      }

      skipped++;
    } catch (err) {
      console.error(`[Backfill] Error procesando trayecto ${t.id}:`, err?.message ?? err);
      errors++;
    }
  }

  console.log("\n=== RESUMEN DE BACKFILL ===");
  console.log(`Total procesados: ${pendingTrayectos.length}`);
  console.log(`- Actualizados desde tramos existentes: ${updatedFromTramos}`);
  console.log(`- Actualizados vía Google Directions: ${updatedFromGoogle}`);
  console.log(`- Actualizados desde coordenadas directas: ${updatedFromCoords}`);
  console.log(`- Saltados (sin coordenadas): ${skipped}`);
  console.log(`- Errores: ${errors}`);
  console.log("=== FINALIZADO ===");
}

runBackfill()
  .catch((e) => {
    console.error("Error fatal en backfill:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
