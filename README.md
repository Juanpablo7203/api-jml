# dimasoft-jamila-api

API de servicios pequenos sobre las instancias PostgreSQL (Google Cloud SQL) de Dimasoft.
Node 24 LTS, ESM, Express 5 y `pg` (node-postgres).

## Como funciona la conexion

Las instancias de Cloud SQL exigen **mTLS**: el cliente presenta su propio certificado.
El material viene en tres piezas por instancia:

| Pieza | Archivo | Que es |
| --- | --- | --- |
| CA del servidor | `certs/server-ca.pem` | Valida el certificado que presenta Cloud SQL |
| Identidad de cliente | `certs/client-identity.p12` | Bundle PKCS#12 con el cert **y** la llave privada del cliente |
| Password del `.p12` | `SSL_PWD_POSTGRES` | Clave con la que se cifro el bundle |

`dimasoft_dashboard_api` entrega esas piezas a Prisma por querystring:

```
postgresql://user:pass@host:5432/DB?sslmode=require&sslcert=../server-ca.pem&sslidentity=../client-identity.p12&sslpassword=...
```

Aqui se hace el mismo handshake, pero con las opciones TLS nativas de Node (`src/db/ssl.js`):

| Prisma | `pg` / Node TLS |
| --- | --- |
| `sslcert` | `ssl.ca` |
| `sslidentity` | `ssl.pfx` |
| `sslpassword` | `ssl.passphrase` |
| `sslmode=require` | `ssl.rejectUnauthorized` |

Dos detalles que no son evidentes:

1. **Las passwords del `.env` estan URL-encoded** (`B%3FRhDtb6c*OSI.` -> `B?RhDtb6c*OSI.`)
   porque en el proyecto original iban dentro de una connection string. `pg` las recibe en
   crudo, asi que se decodifican en `src/config/database.js`. Controlado por
   `PG_PASSWORD_URLENCODED`.
2. **El CN del certificado de Cloud SQL es el nombre de la instancia**, no el CNAME DNS por
   el que se conecta. Con `PG_SSL_VERIFY_CA=true` (por defecto) se valida la cadena contra el
   CA y se omite solo la verificacion de hostname — mas estricto que el `sslmode=require` de
   Prisma, que no valida nada. Con `false` se replica el comportamiento laxo.

> El `process.env.NODE_OPTIONS = '--openssl-legacy-provider'` de `dashboard_api/Utils/Global.js`
> no hace falta: ambos `.p12` usan PBES2 + AES-256-CBC, que OpenSSL 3 acepta sin proveedor legacy.
> (Ademas, asignar `NODE_OPTIONS` en tiempo de ejecucion no tiene efecto.)

## Instancias y bases

Hay dos instancias, cada una con su propio CA + `.p12`:

- **Instancia 1** — `db-dimasoft-cname.dimasoft.cl`, `server-ca.pem` + `client-identity.p12`
- **Instancia 2** — `db-dimasoft-cname-2.dimasoft.cl`, `rw-instance-2-*`

Y dos tipos de base:

- `DIMA_GES` — base de gestion, credenciales `*_GES` (rol `ges`)
- `DATOS<companyId>` — base por empresa, credenciales `USR_POSTGRES`/`PWD_POSTGRES` (rol `postgres`)

Cada empresa vive en **una sola** instancia; el `instance` viaja en el JWT en el proyecto
original. Un `DATOS007` contra la instancia 2 devuelve `3D000 database does not exist`, y eso
es lo esperado.

## Uso

```js
import { getGesPool, getCompanyPool, query, withTransaction } from './src/db/index.js';

// Base de gestion de la instancia 2
const rows = await query(getGesPool(2), 'SELECT * FROM empresas WHERE codigo = $1', [codigo]);

// Base de una empresa en la instancia 1
const ventas = await query(
  getCompanyPool('007', 1),
  'SELECT folio, total FROM facturav WHERE fecha >= $1',
  [desde],
);

// Transaccion
await withTransaction(getCompanyPool('007', 1), async (client) => {
  await client.query('INSERT INTO ... VALUES ($1)', [valor]);
});
```

Los pools se crean bajo demanda y se cachean por `instancia + base`, asi que llamar
`getCompanyPool` en cada request no abre conexiones nuevas.

## Comandos

```bash
npm install
npm run dev     # node --watch
npm start
```

## Endpoints actuales

Todos de solo lectura.

| Endpoint | Que hace |
| --- | --- |
| `GET /health` | Liveness, sin tocar la base |
| `GET /health/db` | Handshake mTLS + login contra DIMA_GES de ambas instancias |
| `GET /health/db/:instance` | Lo mismo, solo una instancia |
| `GET /health/query/:instance` | SELECT real sobre `empresas` de DIMA_GES |

El ultimo acepta `?limit=N` (tope 50, default 10) o `?cod_emp=007` para una empresa puntual:

```bash
curl -s "localhost:3041/health/query/1?limit=3"
curl -s "localhost:3041/health/query/1?cod_emp=007"
```

```json
{
  "data": {
    "instance": 1,
    "database": "DIMA_GES",
    "count": 1,
    "rows": [{ "cod_emp": "007", "razon_social": "INFORMATICA DIMASOFT LTDA.", ... }]
  },
  "message": "ok"
}
```

`/health/db` responde 503 si alguna instancia falla; `/health/query` responde 503 si la
consulta falla e incluye el `code` de Postgres.

## Estructura

```
certs/                      CA y .p12 de cada instancia (fuera de git)
src/config/env.js           carga del .env y flags
src/config/database.js      definicion de instancias y credenciales
src/db/ssl.js               .p12/.pem -> opciones TLS (con cache de archivos)
src/db/pool.js              factory y cache de Pools
src/db/index.js             query / queryOne / withTransaction / ping
src/routes/                 rutas Express
src/app.js  src/server.js   app y arranque
```
