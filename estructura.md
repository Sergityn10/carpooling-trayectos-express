# Estructura de carpetas del proyecto

```text
.                         # Raíz del proyecto backend de carpooling (API Express)
├── app                   # Código fuente principal de la aplicación (API, lógica de negocio)
│   ├── controllers       # Controladores HTTP para trayectos, reservas, opiniones, ubicaciones, etc.
│   ├── providers         # Proveedores e integraciones externas (p.ej. Google Maps)
│   ├── schemas           # Esquemas de validación y modelos de datos de las entidades
│   ├── utils             # Funciones utilitarias y helpers compartidos
│   └── Errors            # Definiciones y manejo de errores personalizados
├── node_modules          # Dependencias de Node.js instaladas por npm
├── .git                  # Metadatos del repositorio Git
├── .env                  # Variables de entorno locales (configuración sensible, no versionada)
├── .env_variables        # Plantilla/ejemplo de variables de entorno necesarias
├── Dockerfile            # Definición de la imagen Docker para ejecutar el servicio
├── package.json          # Configuración del proyecto Node (scripts, dependencias y metadatos)
└── package-lock.json     # Bloqueo de versiones exactas de las dependencias instaladas