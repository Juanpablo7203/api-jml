import app from './app.js';
import { env } from './config/env.js';
import { closeAllPools } from './db/index.js';

const server = app.listen(env.port, () => {
  console.log(`[api] dimasoft-smallservices-api escuchando en http://localhost:${env.port}`);
});

const shutdown = (signal) => async () => {
  console.log(`[api] ${signal} recibido, cerrando...`);
  server.close();
  await closeAllPools();
  process.exit(0);
};

process.on('SIGINT', shutdown('SIGINT'));
process.on('SIGTERM', shutdown('SIGTERM'));

export default server;
