FROM node:24.9.0-bookworm-slim

WORKDIR /app
COPY package*.json .
RUN npm install
COPY . .
EXPOSE 4001
CMD ["npm", "run", "dev"]
