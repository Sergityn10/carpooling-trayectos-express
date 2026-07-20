# Despliegue y configuración

## Requisitos previos

- **Node.js** 18 o superior
- **Docker** y **Docker Compose**
- **Cuenta SMTP** (Gmail, SendGrid, Mailtrap, etc.)
- **Proyecto Firebase** con credenciales de service account
- **Clave pública JWT** del servicio de autenticación de Carpooling

## Instalación

```bash
# 1. Clonar el repositorio
git clone <repo-url>
cd carpooling-notiifications

# 2. Instalar dependencias
npm install

# 3. Copiar el archivo de entorno
cp .env.example .env

# 4. Levantar MySQL en Docker
npm run db:up

# 5. Ejecutar migraciones de Prisma
npm run prisma:migrate -- --name init_device_tokens

# 6. Generar Prisma Client
npm run prisma:generate

# 7. Arrancar el servidor
npm run dev
```

El servicio estará disponible en `http://localhost:3004`.

## Variables de entorno

### Server

| Variable   | Default       | Descripción                           |
| ---------- | ------------- | ------------------------------------- |
| `PORT`     | `3004`        | Puerto del servidor Express           |
| `NODE_ENV` | `development` | Entorno: `development` o `production` |

### Database

| Variable       | Default | Descripción                     |
| -------------- | ------- | ------------------------------- |
| `DATABASE_URL` | —       | URL de conexión MySQL de Prisma |

Formato:
```
DATABASE_URL="mysql://usuario:password@host:puerto/database"
```

### SMTP

| Variable          | Default                  | Descripción               |
| ----------------- | ------------------------ | ------------------------- |
| `SMTP_HOST`       | `localhost`              | Host del servidor SMTP    |
| `SMTP_PORT`       | `587`                    | Puerto SMTP               |
| `SMTP_USER`       | —                        | Usuario SMTP              |
| `SMTP_PASS`       | —                        | Contraseña o App Password |
| `SMTP_FROM_NAME`  | `Carpooling`             | Nombre del remitente      |
| `SMTP_FROM_EMAIL` | `noreply@carpooling.com` | Email del remitente       |

### Frontend

| Variable       | Default                 | Descripción                               |
| -------------- | ----------------------- | ----------------------------------------- |
| `FRONTEND_URL` | `http://localhost:3000` | URL del frontend (para enlaces en emails) |

### Admin

| Variable                | Default | Descripción                                                                         |
| ----------------------- | ------- | ----------------------------------------------------------------------------------- |
| `ADMIN_EMAIL`           | —       | Email del administrador que recibe notificaciones (ej. sugerencias)                 |
| `ADMIN_SUGGESTIONS_URL` | —       | URL base del panel de admin para revisar sugerencias. Se le añade `/{suggestionId}` |

### JWT

| Variable         | Default | Descripción                            |
| ---------------- | ------- | -------------------------------------- |
| `JWT_ALGORITHM`  | `RS256` | Algoritmo de verificación JWT          |
| `JWT_PUBLIC_KEY` | —       | Clave pública PEM del servicio de auth |

### Firebase / FCM

| Variable                | Default | Descripción                      |
| ----------------------- | ------- | -------------------------------- |
| `FIREBASE_PROJECT_ID`   | —       | Project ID de Firebase           |
| `FIREBASE_CLIENT_EMAIL` | —       | Client email del service account |
| `FIREBASE_PRIVATE_KEY`  | —       | Private key del service account  |

## Base de datos MySQL con Docker

### Configuración Docker

El archivo `docker-compose.yml` levanta MySQL 8.4:

```yaml
services:
  mysql:
    image: mysql:8.4
    container_name: carpooling-notifications-mysql
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: root_password
      MYSQL_DATABASE: carpooling_notifications
      MYSQL_USER: carpooling_notifications_user
      MYSQL_PASSWORD: carpooling_notifications_password
    ports:
      - "3307:3306"
    volumes:
      - mysql_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "root", "-proot_password"]
      interval: 10s
      timeout: 5s
      retries: 10
```

### Datos por defecto

| Parámetro      | Valor                               |
| -------------- | ----------------------------------- |
| Host           | `localhost`                         |
| Puerto externo | `3307`                              |
| Puerto interno | `3306`                              |
| Database       | `carpooling_notifications`          |
| Usuario        | `carpooling_notifications_user`     |
| Password       | `carpooling_notifications_password` |
| Root password  | `root_password`                     |

### Comandos DB

```bash
npm run db:up       # Levantar MySQL
npm run db:down     # Parar MySQL
npm run db:logs     # Ver logs de MySQL
```

### Comandos Prisma

```bash
npm run prisma:migrate -- --name nombre_migracion   # Crear y aplicar migración
npm run prisma:generate                             # Regenerar Prisma Client
npm run prisma:studio                               # Abrir Prisma Studio (GUI)
```

## Scripts disponibles

| Script            | Comando                        | Descripción                 |
| ----------------- | ------------------------------ | --------------------------- |
| `start`           | `node src/server.js`           | Servidor en modo producción |
| `dev`             | `node --watch src/server.js`   | Servidor con auto-reload    |
| `test`            | `node --test`                  | Ejecutar tests              |
| `db:up`           | `docker compose up -d mysql`   | Levantar MySQL              |
| `db:down`         | `docker compose down`          | Parar contenedores          |
| `db:logs`         | `docker compose logs -f mysql` | Logs de MySQL               |
| `prisma:migrate`  | `prisma migrate dev`           | Migraciones                 |
| `prisma:generate` | `prisma generate`              | Generar Prisma Client       |
| `prisma:studio`   | `prisma studio`                | GUI de Prisma               |

## Configuración SMTP

### Gmail

Para Gmail, no uses tu contraseña normal. Usa una **App Password**:

1. Activa la verificación en 2 pasos en tu cuenta Google.
2. Ve a Google Account → Security → App Passwords.
3. Genera una nueva App Password.
4. Configura:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-email@gmail.com
SMTP_PASS=tu-app-password-sin-espacios
SMTP_FROM_NAME=Carpooling
SMTP_FROM_EMAIL=tu-email@gmail.com
```

### Otros proveedores

| Proveedor  | Host                                | Puerto |
| ---------- | ----------------------------------- | ------ |
| SendGrid   | `smtp.sendgrid.net`                 | `587`  |
| Mailtrap   | `sandbox.smtp.mailtrap.io`          | `2525` |
| Mailgun    | `smtp.mailgun.org`                  | `587`  |
| Amazon SES | `email-smtp.[region].amazonaws.com` | `587`  |

## Configuración Firebase FCM

1. Entra en [Firebase Console](https://console.firebase.google.com/).
2. Selecciona tu proyecto.
3. Ve a **Project settings** → **Service accounts**.
4. Pulsa **Generate new private key**.
5. Copia los valores al `.env`:

```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
```

> **Importante**: El archivo JSON completo de Firebase no debe subirse al repositorio. Solo se usan las variables de entorno.

## Despliegue en producción

### Checklist

- [ ] `NODE_ENV=production` en `.env`
- [ ] Credenciales SMTP reales configuradas
- [ ] Credenciales Firebase reales configuradas
- [ ] `JWT_PUBLIC_KEY` con la clave pública del servicio de auth
- [ ] `FRONTEND_URL` con la URL real del frontend
- [ ] `DATABASE_URL` apuntando a la base de datos de producción
- [ ] Migraciones de Prisma aplicadas (`npm run prisma:migrate`)
- [ ] CORS configurado correctamente (revisar `src/server.js` si es necesario)
- [ ] Puerto expuesto correctamente (firewall, reverse proxy, etc.)

### Arranque en producción

```bash
npm install --production
npm run prisma:generate
npm start
```

### Recomendaciones

- Usa un reverse proxy (nginx, Caddy) delante del servicio para TLS.
- Configura un proceso manager (PM2, systemd) para reinicios automáticos.
- Monitoriza el endpoint `/health` para health checks.
- Considera usar un servicio de cola (Redis, RabbitMQ) para emails en lote si el volumen es alto.

## Troubleshooting

### Docker: `docker-credential-desktop` no encontrado

```
error getting credentials - err: exec: "docker-credential-desktop": executable file not found in $PATH
```

**Solución**: Edita `~/.docker/config.json` y elimina `credsStore: desktop` o las entradas `credHelpers` que referencien `desktop`.

### Prisma no conecta a MySQL

```bash
# Verificar que MySQL está corriendo
npm run db:up
npm run db:logs

# Validar el esquema
npx prisma validate

# Verificar la URL de conexión
# DATABASE_URL debe apuntar a localhost:3307
```

### JWT inválido

Verifica que:

- El token se envía como `Authorization: Bearer <JWT>`.
- El payload contiene `{ userId, email, role }`.
- `JWT_PUBLIC_KEY` corresponde a la clave privada del servicio de auth.
- `JWT_ALGORITHM` coincide con el algoritmo de firma (`RS256`).

### Gmail SMTP: `535 BadCredentials`

Usa una **App Password** de Gmail, no la contraseña normal. Verifica que:

1. La verificación en 2 pasos está activada.
2. La App Password no tiene espacios.
3. `SMTP_USER` y `SMTP_FROM_EMAIL` coinciden con tu cuenta de Gmail.

### Firebase: `Firebase no configurado`

El error aparece cuando falta alguna de las tres variables:

```
Firebase no configurado. Revisa FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY en .env
```

Verifica que las tres variables están definidas en `.env` y que `FIREBASE_PRIVATE_KEY` tiene los `\n` correctamente escapados.
