import { prisma } from "../database.js";

async function trackTrayectoSearch(req, res, next) {
  const { origin, destination, date, passengers } = req.query;

  if (!origin || !destination || !date || !passengers) {
    return next();
  }

  const userId = req.user?.userId ?? null;

  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    null;

  const userAgent = req.headers["user-agent"] || null;

  const originStr = String(origin).trim();
  const destinationStr = String(destination).trim();
  const dateStr = String(date).trim();
  const passengersNum = parseInt(String(passengers), 10);

  if (!originStr || !destinationStr || !dateStr || Number.isNaN(passengersNum)) {
    return next();
  }

  res.on("finish", () => {
    const resultsCount = res.locals.searchResultsCount ?? 0;

    prisma.trayectoSearchHistory
      .create({
        data: {
          user_id: userId,
          origin: originStr,
          destination: destinationStr,
          search_date: dateStr,
          passengers: passengersNum,
          origin_lat: res.locals.searchOriginLat ?? null,
          origin_lng: res.locals.searchOriginLng ?? null,
          destination_lat: res.locals.searchDestLat ?? null,
          destination_lng: res.locals.searchDestLng ?? null,
          results_count: resultsCount,
          ip_address: ip,
          user_agent: userAgent,
        },
      })
      .catch((err) => {
        console.error("[SearchTracker] Error guardando búsqueda:", err.message);
      });
  });

  next();
}

export { trackTrayectoSearch };
