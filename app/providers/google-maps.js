import dotenv from 'dotenv';
dotenv.config();
// Asegúrate de que esta URL base esté disponible (debe ser importada o definida)
const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json?address=";
const API_KEY = process.env.GOOGLE_MAPS_API_KEY; // Usar tu clave de entorno
async function geocodeAddress(address) {
    const response = await fetch(`${GEOCODE_URL}${encodeURIComponent(address)}&key=${API_KEY}`);
    const data = await response.json();

    if (data.status !== 'OK' || data.results.length === 0) {
        throw new Error(`No se pudo geocodificar la dirección: ${address}`);
    }

    const { lat, lng } = data.results[0].geometry.location;
    return { lat, lng };
}

export const GoogleMapsProvider = {
    geocodeAddress
}