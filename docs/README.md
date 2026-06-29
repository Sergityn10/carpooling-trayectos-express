# Documentación API — Backend de Trayectos (Carpooling)

**URL base:** `http://localhost:4001` (o el dominio configurado en producción)

## Autenticación

Se usa token JWT (RS256) mediante cabecera `Authorization: Bearer <token>` o cookie `access_token`. El token se verifica localmente usando la clave pública (`PUBLIC_KEY`) configurada en `.env`, sin llamadas a un servicio externo.

- **`authenticate`**: requiere token válido. Si no hay token o es inválido, devuelve `401`.
- **`tryAuthenticate`**: opcional. Si hay token y es válido, añade `req.user`; si no, continúa sin usuario.

## Identificadores

Todos los IDs (trayectos, reservas, comentarios, usuarios) son **UUIDs v4** (strings de 36 caracteres, ej: `"550e8400-e29b-41d4-a716-446655440000"`). Los datos de usuario (nombre, email, imagen de perfil, cuenta de Stripe) se obtienen del microservicio de usuarios mediante llamadas a su API.

## Formato de respuestas

```json
{ "status": "Success", "message": "...", ... }
```
```json
{ "status": "Error", "message": "..." }
```

## Documentos por dominio

| Archivo                                      | Descripción                                                      |
| -------------------------------------------- | ---------------------------------------------------------------- |
| [viajes.md](./viajes.md)                     | Gestión de trayectos/viajes y opiniones/comentarios              |
| [reservas.md](./reservas.md)                 | Reservas de plazas, pagos con Stripe, confirmación e incidencias |
| [preferencias.md](./preferencias.md)         | Preferencias de usuario (catálogo, consulta, actualización)      |
| [ubicaciones.md](./ubicaciones.md)           | Ubicaciones/direcciones guardadas por usuario                    |
| [rutas-frecuentes.md](./rutas-frecuentes.md) | Plantillas de rutas frecuentes del usuario                       |
| [combustible.md](./combustible.md)           | Precios de combustible, estaciones de servicio y gasolineras     |
