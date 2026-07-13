import dotenv from "dotenv";
dotenv.config();
// Asegúrate de que esta URL base esté disponible (debe ser importada o definida)
const GEOCODE_URL =
  "https://maps.googleapis.com/maps/api/geocode/json?address=";
const REVERSE_GEOCODE_URL =
  "https://maps.googleapis.com/maps/api/geocode/json?latlng=";
const SNAP_TO_ROADS_URL = "https://roads.googleapis.com/v1/snapToRoads";
const API_KEY = process.env.GOOGLE_MAPS_API_KEY; // Usar tu clave de entorno

async function geocodeRaw(address) {
  const response = await fetch(
    `${GEOCODE_URL}${encodeURIComponent(address)}&key=${API_KEY}`,
  );
  const data = await response.json();

  if (data.status !== "OK" || data.results.length === 0) {
    throw new Error(`No se pudo geocodificar la dirección: ${address}`);
  }

  return data.results[0];
}

function getAddressComponent(components, type) {
  const found = (components ?? []).find((c) => (c.types ?? []).includes(type));
  return found?.long_name ?? null;
}

function extractCityFromGeocodeResult(result) {
  const components = result?.address_components ?? [];
  return (
    getAddressComponent(components, "locality") ||
    getAddressComponent(components, "postal_town") ||
    getAddressComponent(components, "administrative_area_level_3") ||
    getAddressComponent(components, "administrative_area_level_2")
  );
}

function extractProvinceFromGeocodeResult(result) {
  const components = result?.address_components ?? [];
  return (
    getAddressComponent(components, "administrative_area_level_2") ||
    getAddressComponent(components, "administrative_area_level_1")
  );
}

async function geocodeAddress(address) {
  const result = await geocodeRaw(address);
  const { lat, lng } = result.geometry.location;
  return { lat, lng };
}

async function getCityFromAddress(address) {
  const result = await geocodeRaw(address);
  const city = extractCityFromGeocodeResult(result);
  if (!city)
    throw new Error(
      `No se pudo extraer la ciudad/municipio de la dirección: ${address}`,
    );
  return city;
}

async function getProvinceFromAddress(address) {
  const result = await geocodeRaw(address);
  const province = extractProvinceFromGeocodeResult(result);
  if (!province)
    throw new Error(
      `No se pudo extraer la provincia de la dirección: ${address}`,
    );
  return province;
}

async function geocodeAddressDetails(address) {
  const result = await geocodeRaw(address);
  const { lat, lng } = result.geometry.location;
  const city = extractCityFromGeocodeResult(result);
  const province = extractProvinceFromGeocodeResult(result);
  return { lat, lng, city, province };
}

async function reverseGeocode(lat, lng) {
  const response = await fetch(
    `${REVERSE_GEOCODE_URL}${lat},${lng}&key=${API_KEY}`,
  );
  const data = await response.json();

  if (data.status !== "OK" || data.results.length === 0) {
    throw new Error(`No se pudo reverse-geocodificar: ${lat},${lng}`);
  }

  return data.results[0];
}

async function reverseGeocodeAddress(lat, lng) {
  const result = await reverseGeocode(lat, lng);
  return result.formatted_address;
}

async function reverseGeocodeAddressDetails(lat, lng) {
  const result = await reverseGeocode(lat, lng);
  const city = extractCityFromGeocodeResult(result);
  const province = extractProvinceFromGeocodeResult(result);
  return {
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    formatted_address: result.formatted_address,
    city,
    province,
  };
}

async function snapToRoads(points) {
  if (!points || points.length === 0) return [];

  const BATCH_SIZE = 100;
  const snapped = [];

  for (let i = 0; i < points.length; i += BATCH_SIZE) {
    const batch = points.slice(i, i + BATCH_SIZE);
    const pathParam = batch.map((p) => `${p.lat},${p.lng}`).join("|");

    const response = await fetch(
      `${SNAP_TO_ROADS_URL}?path=${encodeURIComponent(pathParam)}&key=${API_KEY}`,
    );
    const data = await response.json();

    if (!data.snappedPoints || data.snappedPoints.length === 0) {
      console.warn(
        `[snapToRoads] No snapped points for batch starting at index ${i}, using originals`,
      );
      for (const p of batch) {
        snapped.push({ lat: p.lat, lng: p.lng });
      }
      continue;
    }

    for (const sp of data.snappedPoints) {
      snapped.push({
        lat: sp.location.latitude,
        lng: sp.location.longitude,
      });
    }
  }

  return snapped;
}

export const GoogleMapsProvider = {
  geocodeAddress,
  geocodeAddressDetails,
  getCityFromAddress,
  getProvinceFromAddress,
  reverseGeocodeAddress,
  reverseGeocodeAddressDetails,
  snapToRoads,
};
