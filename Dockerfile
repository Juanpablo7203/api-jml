FROM node:24-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src

RUN mkdir -p /app/certs

ENV NODE_ENV=production
ENV SSL_CERTS_DIR=/app/certs

EXPOSE 3041

CMD ["sh", "-c", "\
printf '%s' \"$CERT_INSTANCE_1_CA\" > /app/certs/server-ca.pem && \
printf '%s' \"$CERT_INSTANCE_1_P12\" | base64 -d > /app/certs/client-identity.p12 && \
printf '%s' \"$CERT_INSTANCE_2_CA\" > /app/certs/rw-instance-2-server-ca.pem && \
printf '%s' \"$CERT_INSTANCE_2_P12\" | base64 -d > /app/certs/rw-instance-2-client-identity.p12 && \
chmod 600 /app/certs/*.p12 && \
node src/server.js"]