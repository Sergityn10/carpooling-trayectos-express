# ---------- Build stage ----------
FROM node:alpine AS builder

WORKDIR /app

# Copiar solo package.json y package-lock.json para aprovechar cache de capas
COPY package*.json ./

# Instalar TODAS las dependencias (incluidas devDependencies para prisma generate)
RUN npm ci

# Copiar el schema de Prisma y generar el cliente
COPY prisma ./prisma
RUN npx prisma generate

# ---------- Production stage ----------
FROM node:alpine AS production

WORKDIR /app

# Copiar package.json y package-lock.json
COPY package*.json ./

# Instalar solo dependencias de producción
RUN npm ci  && npm cache clean --force

# Copiar el cliente de Prisma generado en el stage builder
COPY --from=builder --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=node:node /app/node_modules/@prisma ./node_modules/@prisma

# Copiar el código de la aplicación
COPY --chown=node:node . .

# Crear directorio para logs si es necesario
RUN mkdir -p /app/logs && chown node:node /app/logs

USER node

EXPOSE 4001

# Sincronizar schema con la base de datos y arrancar la app
CMD npx prisma db push && npx prisma generate && node app/index.js
