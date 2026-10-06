FROM node:24-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src


ENV NODE_ENV=production
EXPOSE 3041

CMD ["node", "src/server.js"]
