import pg from 'pg';
import { env } from '../config/env.js';
import { buildSslOptions } from './ssl.js';
import {
  DEFAULT_INSTANCE,
  PG_PORT,
  companyDatabaseName,
  getInstance,
} from '../config/database.js';

const { Pool, types } = pg;

// Los NUMERIC/DECIMAL de Postgres llegan como string para no perder precision.
// Las tablas de Dimasoft usan decimal(16,4) en montos, asi que se convierten a Number
// (mismo criterio que aplicaba Prisma al serializar) de forma explicita y en un solo lugar.
types.setTypeParser(types.builtins.NUMERIC, (value) => (value === null ? null : Number(value)));
types.setTypeParser(types.builtins.INT8, (value) => (value === null ? null : Number(value)));

const pools = new Map();

const poolKey = (instanceId, database) => `${instanceId}::${database}`;

const createPool = ({ instance, database, role }) => {
  const credentials = instance[role];

  if (!credentials?.host || !credentials?.user) {
    throw new Error(
      `Credenciales incompletas para ${instance.label}/${role}: revisa HOST_*/USR_*/PWD_* en el .env`,
    );
  }

  const pool = new Pool({
    host: credentials.host,
    port: PG_PORT,
    user: credentials.user,
    password: credentials.password,
    database,
    ssl: buildSslOptions(instance),
    ...env.pool,
    application_name: 'dimasoft-smallservices-api',
  });

  // Un error en un cliente ocioso no debe tumbar el proceso.
  pool.on('error', (error) => {
    console.error(`[db] error en cliente ocioso (${instance.label}/${database}):`, error.message);
  });

  return pool;
};

/**
 * Devuelve (y cachea) el Pool para una instancia + base concreta.
 * `role` decide que juego de credenciales se usa: 'ges' para DIMA_GES, 'postgres' para DATOS<id>.
 */
export const getPool = ({ instance: instanceId = DEFAULT_INSTANCE, database, role = 'postgres' }) => {
  const instance = getInstance(instanceId);
  const dbName = database ?? instance[role]?.database;

  if (!dbName) {
    throw new Error(`No se pudo determinar la base de datos para ${instance.label}/${role}`);
  }

  const key = poolKey(instance.id, dbName);
  if (!pools.has(key)) {
    pools.set(key, createPool({ instance, database: dbName, role }));
  }
  return pools.get(key);
};

/** Pool contra la base de gestion DIMA_GES de la instancia indicada. */
export const getGesPool = (instanceId = DEFAULT_INSTANCE) =>
  getPool({ instance: instanceId, role: 'ges' });

/** Pool contra la base de una empresa concreta: DATOS<companyId>. */
export const getCompanyPool = (companyId, instanceId = DEFAULT_INSTANCE) => {
  if (companyId === undefined || companyId === null || companyId === '') {
    throw new Error('companyId es obligatorio para resolver la base DATOS<companyId>');
  }
  return getPool({
    instance: instanceId,
    role: 'postgres',
    database: companyDatabaseName(companyId),
  });
};

export const closeAllPools = async () => {
  const closing = [...pools.values()].map((pool) => pool.end().catch(() => {}));
  pools.clear();
  await Promise.all(closing);
};

export const listOpenPools = () => [...pools.keys()];
