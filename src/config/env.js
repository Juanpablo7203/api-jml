import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

dotenv.config({ path: path.join(ROOT_DIR, '.env'), quiet: true });

const bool = (value, fallback = false) => {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
};

const num = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const env = {
  port: num(process.env.PORT, 3041),
  // antes estaba :  certsDir: path.resolve(ROOT_DIR, process.env.SSL_CERTS_DIR ?? 'certs'),
  certsDir: process.env.SSL_CERTS_DIR
    ? path.resolve(process.env.SSL_CERTS_DIR)
    : path.resolve(ROOT_DIR, 'certs'),

  pgPasswordUrlEncoded: bool(process.env.PG_PASSWORD_URLENCODED, true),
  pgSslVerifyCa: bool(process.env.PG_SSL_VERIFY_CA, true),
  // Ajuste fino del pool: opcionales, los defaults sirven para el uso normal.
  pool: {
    max: num(process.env.PG_POOL_MAX, 10),
    idleTimeoutMillis: num(process.env.PG_IDLE_TIMEOUT_MS, 30_000),
    connectionTimeoutMillis: num(process.env.PG_CONNECT_TIMEOUT_MS, 15_000),
  },
};

export { bool, num };
