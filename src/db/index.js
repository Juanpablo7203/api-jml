import { getCompanyPool, getGesPool, getPool } from './pool.js';

export { getPool, getGesPool, getCompanyPool, closeAllPools, listOpenPools } from './pool.js';

/**
 * Ejecuta una consulta parametrizada y devuelve solo las filas.
 * Siempre usar placeholders ($1, $2, ...) en vez de interpolar en el SQL.
 */
export const query = async (pool, text, params = []) => {
  const { rows } = await pool.query(text, params);
  return rows;
};

export const queryOne = async (pool, text, params = []) => {
  const rows = await query(pool, text, params);
  return rows[0] ?? null;
};

/** Corre `fn(client)` dentro de una transaccion, con COMMIT/ROLLBACK automatico. */
export const withTransaction = async (pool, fn) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
};

/** Abre y cierra una conexion para comprobar que el handshake mTLS y el login funcionan. */
export const ping = async (pool) => {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      'SELECT current_database() AS database, current_user AS "user", version() AS version',
    );
    return rows[0];
  } finally {
    client.release();
  }
};

export const pingGes = (instanceId) => ping(getGesPool(instanceId));
export const pingCompany = (companyId, instanceId) => ping(getCompanyPool(companyId, instanceId));
