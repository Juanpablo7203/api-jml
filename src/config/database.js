import { env } from './env.js';

/**
 * Las passwords viven URL-encoded en el .env (se heredan de dimasoft_dashboard_api,
 * donde iban embebidas en la connection string de Prisma: `postgresql://user:pass@host`).
 * El driver `pg` recibe la password en crudo, asi que hay que decodificarla.
 * Ej: "B%3FRhDtb6c*OSI." -> "B?RhDtb6c*OSI."
 */
const decodePassword = (value) => {
  if (!value) return value;
  if (!env.pgPasswordUrlEncoded) return value;
  try {
    return decodeURIComponent(value);
  } catch {
    // La password trae un '%' literal que no forma un escape valido: se usa tal cual.
    return value;
  }
};

/**
 * Cada instancia de Cloud SQL tiene su propio par server-CA + identidad de cliente (.p12).
 * `postgres` es el rol usado para las bases por empresa (DATOS<companyId>) y `ges` el
 * usado para la base de gestion (DIMA_GES); hoy coinciden, pero se mantienen separados
 * porque asi estan modelados en el .env.
 */
export const INSTANCES = {
  1: {
    id: 1,
    label: 'instancia-1',
    postgres: {
      host: process.env.HOST_POSTGRES,
      user: process.env.USR_POSTGRES,
      password: decodePassword(process.env.PWD_POSTGRES),
    },
    ges: {
      host: process.env.HOST_GES,
      user: process.env.USR_GES,
      password: decodePassword(process.env.PWD_GES),
      database: process.env.DATABASE_GES,
    },
    ssl: {
      ca: process.env.SSL_CERT_POSTGRES,
      identity: process.env.SSL_IDENTITY_POSTGRES,
      passphrase: process.env.SSL_PWD_POSTGRES,
    },
  },
  2: {
    id: 2,
    label: 'instancia-2',
    postgres: {
      host: process.env.HOST_POSTGRES_TWO,
      user: process.env.USR_POSTGRES_TWO,
      password: decodePassword(process.env.PWD_POSTGRES_TWO),
    },
    ges: {
      host: process.env.HOST_GES_TWO,
      user: process.env.USR_GES_TWO,
      password: decodePassword(process.env.PWD_GES_TWO),
      database: process.env.DATABASE_GES_TWO,
    },
    ssl: {
      ca: process.env.SSL_CERT_POSTGRES_TWO,
      identity: process.env.SSL_IDENTITY_POSTGRES_TWO,
      passphrase: process.env.SSL_PWD_POSTGRES_TWO,
    },
  },
};

export const DEFAULT_INSTANCE = 1;
export const PG_PORT = 5432;

export const getInstance = (instanceId = DEFAULT_INSTANCE) => {
  const key = Number(instanceId) === 2 ? 2 : DEFAULT_INSTANCE;
  return INSTANCES[key];
};

/** Nombre de la base por empresa, tal como lo arma dimasoft_dashboard_api. */
export const companyDatabaseName = (companyId) => `DATOS${companyId}`;
