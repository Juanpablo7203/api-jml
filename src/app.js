import express from 'express';
import './config/env.js';
import healthRoutes from './routes/health.js';
import { responseJson } from './utils/response.js';

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use('/', healthRoutes);

app.use((_req, res) => responseJson(res, 404, 'Recurso no encontrado', {}));

// eslint-disable-next-line no-unused-vars
app.use((error, _req, res, _next) => {
  console.error('[api]', error);
  return responseJson(res, 500, 'Error interno', {});
});

export default app;
