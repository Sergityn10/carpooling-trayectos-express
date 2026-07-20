# Documentación del Microservicio de Notificaciones

> **Carpooling Notifications** — Microservicio encargado de gestionar emails (SMTP) y notificaciones push (FCM) para la plataforma Carpooling.

---

## Índice de documentación

| Documento | Descripción |
|-----------|-------------|
| [Arquitectura](./architecture.md) | Visión general de la arquitectura, modelo de datos, flujos y estructura del proyecto |
| [Referencia de la API](./api-reference.md) | Documentación completa de todos los endpoints REST con ejemplos de petición y respuesta |
| [Guía de integración](./integration-guide.md) | Cómo integrar otros microservicios con este servicio de notificaciones |
| [Plantillas de email](./email-templates.md) | Catálogo de plantillas HTML disponibles y campos requeridos |
| [Autenticación JWT](./authentication.md) | Especificación del mecanismo de autenticación para endpoints protegidos |
| [Despliegue y configuración](./deployment.md) | Guía de instalación, variables de entorno, Docker y troubleshooting |

---

## Resumen rápido

- **Puerto por defecto**: `3004`
- **Base URL**: `http://localhost:3004`
- **Tipo**: Microservicio REST (Node.js + Express)
- **Base de datos**: MySQL 8.4 (Docker) con Prisma ORM
- **Autenticación**: JWT RS256 (solo en endpoints de device tokens)
- **Notificaciones**: Email (Nodemailer/SMTP) y Push (Firebase Cloud Messaging)

## Módulos funcionales

```
Notifications Service
├── Emails (SMTP)
│   ├── Envío simple (HTML/texto)
│   ├── Envío por plantilla
│   └── Envío en lote (batch)
├── Push Notifications (FCM)
│   ├── Envío por token
│   ├── Envío multicast
│   ├── Envío por usuario
│   ├── Envío por topic
│   └── Subscribe/Unsubscribe a topics
└── Device Tokens (JWT requerido)
    ├── Registrar/actualizar token
    ├── Listar dispositivos del usuario
    └── Desactivar dispositivo
```

## Cómo empezar

1. Lee la [Guía de integración](./integration-guide.md) si vas a consumir este servicio desde otro microservicio.
2. Consulta la [Referencia de la API](./api-reference.md) para ver los endpoints disponibles.
3. Revisa [Despliegue y configuración](./deployment.md) para poner en marcha el servicio.
