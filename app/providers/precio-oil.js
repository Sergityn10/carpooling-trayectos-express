import dotenv from 'dotenv';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const provinces = require('./provincias.json');

dotenv.config();

const apiOil = process.env.API_OILPRICE;

function toQueryString(query) {
    if (!query) return '';

    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null || value === '') continue;
        params.set(key, String(value));
    }

    const qs = params.toString();
    return qs ? `?${qs}` : '';
}

async function requestJson(path, { query } = {}) {
    if (!apiOil) {
        throw new Error('API_OILPRICE no está configurada en las variables de entorno');
    }

    const response = await fetch(`${apiOil}${path}${toQueryString(query)}`);
    if (!response.ok) {
        throw new Error(`Error consultando Precioil.es (${response.status}): ${await response.text()}`);
    }

    return response.json();
}

function normalizeProvinceName(value) {
    return String(value ?? '')
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase();
}

function findProvinceByName(provincia) {
    const normalizedInput = normalizeProvinceName(provincia);
    if (!normalizedInput) {
        throw new Error('Provincia requerida');
    }

    const match = provinces.find((p) => normalizeProvinceName(p.nombreProvincia) === normalizedInput);
    if (!match) {
        throw new Error(`Provincia no encontrada: ${provincia}`);
    }

    return match;
}

async function getIdProvince(provincia) {
    return findProvinceByName(provincia).idProvincia;
}

async function getProvincias() {
    return requestJson('/provincias');
}

async function getMunicipiosByProvincia(idProvincia) {
    return requestJson(`/municipios/provincia/${idProvincia}`);
}

async function getEstacionesCerca(idEstacion, { radio } = {}) {
    return requestJson(`/estaciones/cerca/${idEstacion}`, { query: { radio } });
}

async function getEstacionDetalles(idEstacion) {
    return requestJson(`/estaciones/detalles/${idEstacion}`);
}

async function getEstacionHistorico(idEstacion, { fechaInicio, fechaFin } = {}) {
    return requestJson(`/estaciones/historico/${idEstacion}`, { query: { fechaInicio, fechaFin } });
}

async function getEstacionesByMunicipio(idMunicipio) {
    return requestJson(`/estaciones/municipio/${idMunicipio}`);
}

async function getEstacionesRadio({ latitud, longitud, radio, pagina, limite } = {}) {
    return requestJson('/estaciones/radio', {
        query: {
            latitud,
            longitud,
            radio,
            pagina,
            limite
        }
    });
}

async function getPrecioMedioDiario({ idFuelType, fechaInicio, fechaFin } = {}) {
    return requestJson('/precioMedioDiario', {
        query: {
            idFuelType,
            fechaInicio,
            fechaFin
        }
    });
}

async function getPreciosMediosByProvinciaId(idProvincia, idFuelType) {
    return requestJson(`/precios/medios/provincia/${idProvincia}`, { query: { idFuelType } });
}

async function getPreciosMediosByProvinciaNombre(provincia, idFuelType) {
    const idProvincia = await getIdProvince(provincia);
    return getPreciosMediosByProvinciaId(idProvincia, idFuelType);
}

function normalizeFuelTypeName(value) {
    return String(value ?? '')
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase();
}

function pickGasoilItem(items) {
    const normalizedItems = (items ?? []).map((i) => ({
        ...i,
        __name: normalizeFuelTypeName(i.fuelTypeName)
    }));

    return (
        normalizedItems.find((i) => i.__name.includes('GASOLEO')) ||
        normalizedItems.find((i) => i.__name.includes('GASOIL')) ||
        normalizedItems.find((i) => i.__name.includes('DIESEL')) ||
        null
    );
}

async function getGasoilAveragePriceByProvinciaId(idProvincia) {
    const items = await getPreciosMediosByProvinciaId(idProvincia);
    const item = pickGasoilItem(items);
    console.log(item)
    item.averagePrice = parseFloat(item.averagePrice);
    console.log(item.averagePrice)
    if (!item || typeof item.averagePrice !== 'number') {
        throw new Error(`No se pudo obtener el precio medio de gasoil para la provincia ${idProvincia}`);
    }
    return item.averagePrice;
}

async function getGasoilAveragePriceByProvinciaNombre(provincia) {
    const idProvincia = await getIdProvince(provincia);
    return getGasoilAveragePriceByProvinciaId(idProvincia);
}

async function getPriceInProvince(provincia, idFuelType) {
    return getPreciosMediosByProvinciaNombre(provincia, idFuelType);
}

export const OilPriceProvider = {
    getIdProvince,
    getPriceInProvince,
    getPreciosMediosByProvinciaId,
    getPreciosMediosByProvinciaNombre,
    getGasoilAveragePriceByProvinciaId,
    getGasoilAveragePriceByProvinciaNombre,
    getProvincias,
    getMunicipiosByProvincia,
    getEstacionesCerca,
    getEstacionDetalles,
    getEstacionHistorico,
    getEstacionesByMunicipio,
    getEstacionesRadio,
    getPrecioMedioDiario
};

export {
    getIdProvince,
    getPriceInProvince,
    getPreciosMediosByProvinciaId,
    getPreciosMediosByProvinciaNombre,
    getGasoilAveragePriceByProvinciaId,
    getGasoilAveragePriceByProvinciaNombre,
    getProvincias,
    getMunicipiosByProvincia,
    getEstacionesCerca,
    getEstacionDetalles,
    getEstacionHistorico,
    getEstacionesByMunicipio,
    getEstacionesRadio,
    getPrecioMedioDiario
};