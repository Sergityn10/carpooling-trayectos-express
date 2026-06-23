# Documentación API — Backend de Trayectos (Carpooling)

**URL base:** `http://localhost:4001` (o el dominio configurado en producción)

## Autenticación

Se usa token JWT mediante cabecera `Authorization: Bearer <token>` o cookie `access_token`. El token se valida contra el microservicio de usuarios (`USUARIOS_URL/api/auth/validate`).

- **`authenticate`**: requiere token válido. Si no hay token o es inválido, devuelve `401`.
- **`tryAuthenticate`**: opcional. Si hay token y es válido, añade `req.user`; si no, continúa sin usuario.

## Formato de respuestas

```json
{ "status": "Success", "message": "...", ... }
```
```json
{ "status": "Error", "message": "..." }
```

## Documentos por dominio

| Archivo | Descripción |
|---------|-------------|
| [viajes.md](./viajes.md) | Gestión de trayectos/viajes y opiniones/comentarios |
| [reservas.md](./reservas.md) | Reservas de plazas, pagos con Stripe, confirmación e incidencias |
| [preferencias.md](./preferencias.md) | Preferencias de usuario (catálogo, consulta, actualización) |
| [ubicaciones.md](./ubicaciones.md) | Ubicaciones/direcciones guardadas por usuario |
| [rutas-frecuentes.md](./rutas-frecuentes.md) | Plantillas de rutas frecuentes del usuario |
| [combustible.md](./combustible.md) | Precios de combustible, estaciones de servicio y gasolineras |
