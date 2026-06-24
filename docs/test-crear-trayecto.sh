#!/bin/bash
# Script para probar POST /api/trayecto (crearTrayecto)
# Uso: ./test-crear-trayecto.sh <TOKEN_JWT>
# Si no se pasa token, se usa uno vacío (la petición devolverá 401)

TOKEN="${1:-}"

# Configuración — ajusta HOST y PORT según tu entorno
HOST=""
ENDPOINT="/api/trayecto"

# Datos del trayecto de prueba
# Ajusta origen/destino a direcciones reales que Google Maps pueda geocodificar
BODY='{
  "origen": "Madrid, Gran Via 1",
  "destino": "Toledo, Plaza Mayor",
  "fecha": "2025-07-15",
  "hora": "10:00",
  "plazas": 4,
  "precio": 0,
  "routeIndex": 0
}'

echo "=== Test crearTrayecto ==="
echo "Endpoint: ${HOST}${ENDPOINT}"
echo "Token: ${TOKEN:0:20}..."
echo "Body: ${BODY}"
echo ""

curl -s -w "\n\nHTTP Status: %{http_code}\nTime: %{time_total}s\n" \
  -X POST "${HOST}${ENDPOINT}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "${BODY}"
