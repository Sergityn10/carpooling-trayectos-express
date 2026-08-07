# ---------- Build stage ----------
FROM node:24.9.0-bookworm-slim AS builder

WORKDIR /app

# Copiar solo package.json y package-lock.json para aprovechar cache de capas
COPY package*.json ./

# Instalar TODAS las dependencias (incluidas devDependencies para prisma generate)
RUN npm ci

# Copiar el schema de Prisma y generar el cliente
COPY prisma ./prisma
RUN npx prisma generate

# ---------- Production stage ----------
FROM node:24.9.0-bookworm-slim AS production

WORKDIR /app

# Crear usuario no-root por seguridad
RUN groupmod -g 1001 -o node && usermod -u 1001 -o node

# Copiar package.json y package-lock.json
COPY package*.json ./

# Instalar solo dependencias de producción
RUN npm ci --omit=dev && npm cache clean --force

# Copiar el cliente de Prisma generado en el stage builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copiar el código de la aplicación
COPY --chown=node:node . .

# Crear directorio para logs si es necesario
RUN mkdir -p /app/logs && chown node:node /app/logs

USER node

EXPOSE 4001

# Usar node directamente en producción (sin nodemon)
CMD ["node", "app/index.js"]
