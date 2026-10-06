# Puesta en marcha

Los certificados y el `.env` **no van en el repo**. Te los paso aparte: son 5 archivos.

## 1. Donde va cada archivo

Respetar los nombres exactamente, el codigo los busca asi:

```
dimasoft_smallservices_api/
├── .env                                    <- en la raiz
└── certs/                                  <- crear la carpeta
    ├── server-ca.pem                       (instancia 1)
    ├── client-identity.p12                 (instancia 1)
    ├── rw-instance-2-server-ca.pem         (instancia 2)
    └── rw-instance-2-client-identity.p12   (instancia 2)
```

## 2. Levantar

Requiere Node 22 o superior (probado en Node 24 LTS).

```bash
npm install
npm run dev
```

## 3. Probar

```bash
curl -s localhost:3041/health                              # la api responde
curl -s localhost:3041/health/db                           # conexion SSL a ambas instancias
curl -s "localhost:3041/health/query/1?limit=3"            # SELECT real
curl -s "localhost:3041/health/query/1?cod_emp=007"        # una empresa puntual
```

Si `/health/db` devuelve las dos instancias en `ok: true`, el mTLS con el `.p12` funciona y
ya podes trabajar.

Si falla, casi siempre es una de estas tres:

- Un archivo mal nombrado o fuera de `certs/` -> el error dice la ruta que no encontro
- El `.env` no esta en la raiz
- El puerto 3041 ocupado por otra corrida -> `pkill -f "src/server.js"`

## 4. Ojo con esto

**La base es productiva.** Todo lo que hay hoy es de solo lectura y asi debe quedar hasta que
definamos los endpoints reales.

**`/health/query` es temporal y hay que borrarlo antes de salir a produccion.** Existe solo
para validar el setup: consulta la tabla `empresas` de `DIMA_GES` y recibe el numero de
instancia por URL (`/health/query/1` o `/2`). Es decir, la instancia y la base estan
resueltas a mano en la ruta. En los endpoints definitivos eso no va a ser asi: la instancia
y la empresa van a venir del token, como en `dimasoft_dashboard_api`.

Esta en `src/routes/health.js`; se borra ese handler y listo.

---

Contexto de como funciona la conexion mTLS (que es `sslidentity`, por que las passwords van
URL-encoded, etc.): ver `README.md`.
