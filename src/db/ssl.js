import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config/env.js';

const fileCache = new Map();

const readCert = (filename) => {
  if (!filename) {
    throw new Error('Falta el nombre de archivo del certificado en el .env');
  }
  const fullPath = path.isAbsolute(filename) ? filename : path.join(env.certsDir, filename);
  if (!fileCache.has(fullPath)) {
    if (!fs.existsSync(fullPath)) {
      throw new Error(`No se encontro el certificado: ${fullPath}`);
    }
    fileCache.set(fullPath, fs.readFileSync(fullPath));
  }
  return fileCache.get(fullPath);
};

/**
 * Traduce la configuracion SSL del .env a las opciones TLS que espera `pg`.
 *
 * Equivale a lo que Prisma hace con `?sslmode=require&sslcert=...&sslidentity=...&sslpassword=...`:
 *  - `ca`         <- sslcert      (server-ca.pem de la instancia de Cloud SQL)
 *  - `pfx`        <- sslidentity  (client-identity.p12: cert + llave privada del cliente)
 *  - `passphrase` <- sslpassword  (password con la que se cifro el .p12)
 *
 * Sobre la verificacion: el certificado que presenta Cloud SQL lleva como CN el nombre de
 * la instancia (`proyecto:instancia`), no el CNAME DNS por el que se conecta. Con
 * `PG_SSL_VERIFY_CA=true` se valida la cadena contra el CA pero se omite la comprobacion de
 * hostname; con `false` se replica el comportamiento laxo de `sslmode=require`.
 */
export const buildSslOptions = (instance) => {
  const options = {
    ca: readCert(instance.ssl.ca),
    pfx: readCert(instance.ssl.identity),
    passphrase: instance.ssl.passphrase,
  };

  if (env.pgSslVerifyCa) {
    options.rejectUnauthorized = true;
    options.checkServerIdentity = () => undefined;
  } else {
    options.rejectUnauthorized = false;
  }

  return options;
};

export const clearCertCache = () => fileCache.clear();
