import { Router } from 'express';
import { getGesPool, getCompanyPool, query, withTransaction } from '../db/index.js';
import { responseJson } from '../utils/response.js';
import { verificarToken } from '../middleware/auth.js';
import jwt from 'jsonwebtoken';

const router = Router();

router.post('/api/logins', async (req, res) => {

  const passphrase = req.query.passphrase;
  //const { jwt_secrets } = req.body;

  // Aquí debes validar usuario/password
  // contra tu BD o sistema de autenticación.

  if (passphrase !== process.env.JWT_SECRET) {
    return res.status(401).json({
      exito: false,
      mensaje: 'passphrase  incorrecta',
    });
  }

  const token = jwt.sign(
    {
      servicio: 'api-pedidos'
    },
    process.env.JWT_SECRET,
    {
      expiresIn: '14d',
    }
  );

  return res.json({
    exito: true,
    token,
  });
});

router.get(
  '/api/pedido{/:numpedido/:sucursal}', 
  verificarToken,
  async (req, res) => {
    const { numpedido, sucursal } = req.params

     if(!numpedido || !sucursal){
        return res.status(400).json({
            exito: false,
            mensaje: 'folio y sucursal son obligatorios',
        });
    }

  try {

      const rows = await query(
          getCompanyPool('043', 1),
          'SELECT CODIGOSUC, FECHA, productos.codbar_producto AS CODIGO_BARRA,  productos.codigo_producto AS SKU, CANTIDAD, UNIDAD, DETALLE, ORDENDET, productos.UBICACION, SALCANDESP \
           FROM Nota_ped_det LEFT JOIN productos ON Nota_ped_det.codigo = productos.codigo_producto \
           WHERE folio = $1 and codigosuc=$2 order by ubicacion asc',
          [numpedido, sucursal],
          );

      return responseJson(res, 200, 'ok', {
        exito: true,
        mensaje: "documento encontrado",
        count: rows.length,
        rows,
      });
  } catch (error) {
    return responseJson(res, 503, 'Error al consultar la base', {
      exito: false,
      mensaje:  error.message,
      code: error.code,
    });
  }
});


router.get(
  '/api/loadpassalto', 
  verificarToken,
  async (req, res) => {
  const nombre = 'PassClaveZebra';

  try {

      const rows = await query(
          getCompanyPool('043',  1),
          'SELECT VALORTEXT \
           FROM CONFIGURA \
           WHERE trim(Campo) = $1 ',
          [nombre],
          );

      return responseJson(res, 200, 'ok', {
        exito: true,
        mensaje: "valor encontrado",
        count: rows.length,
        rows,
      });
  } catch (error) {
    return responseJson(res, 503, 'Error al consultar la base', {
      exito: false,
      mensaje:  error.message,
      code: error.code,
    });
  }
});

router.post(
  '/api/confirma{/:numpedido/:sucursal}',
  verificarToken,
  async (req, res) => {

    const datos = req.body;
    const { numpedido, sucursal } = req.params;

    if (!numpedido || !sucursal) {
      return res.status(400).json({
        exito: false,
        mensaje: 'folio y sucursal son obligatorios',
      });
    }

    if (!Array.isArray(datos) || datos.length === 0) {
      return res.status(400).json({
        exito: false,
        mensaje: 'El cuerpo debe ser un array JSON con elementos',
      });
    }

    // Validar datos antes de modificar la BD
    for (const item of datos) {

      if (!item.codigo || item.cantidad === undefined) {
        return res.status(400).json({
          exito: false,
          mensaje: 'Cada elemento debe contener codigo y cantidad',
        });
      }

      if (
        !Number.isFinite(Number(item.cantidad)) ||
        Number(item.cantidad) <= 0
      ) {
        return res.status(400).json({
          exito: false,
          mensaje: `Cantidad inválida para el código ${item.codigo}`,
        });
      }
    }

    try {

      // Preparar los detalles para PostgreSQL
      const detalles = datos.map((item, index) => ({
        CODIGO: item.codigo,
        CANTIDAD: Number(item.cantidad),
        INDICE: item.indice ?? index + 1,
      }));

      await withTransaction(
        getCompanyPool('043', 1),
        async (client) => {

          // ==========================================
          // 1. ACTUALIZAR NOTA_PED_DET
          // ==========================================

          for (const item of datos) {

            const result = await client.query(
              `UPDATE NOTA_PED_DET
               SET SALCANDESP = SALCANDESP - $1
               WHERE codigo = $2
                 AND folio = $3
                 AND codigosuc = $4`,
              [
                Number(item.cantidad),
                item.codigo,
                numpedido,
                sucursal,
              ]
            );

            if (result.rowCount === 0) {
              throw new Error(
                `No se encontró el código ${item.codigo} para el pedido ${numpedido} y sucursal ${sucursal}`
              );
            }
          }

          // ==========================================
          // 2. INSERTAR CODIGODESPA Y SUS DETALLES
          // ==========================================

          const resultadoDespa = await client.query(
            `SELECT FN_INSERTAR_CODIGODESPA(
                $1::INTEGER,
                $2::CHAR(3),
                NOW()::TIMESTAMP,
                $3::JSONB
             ) AS CODUNICO`,
            [
              numpedido,
              sucursal,
              JSON.stringify(detalles),
            ]
          );

          const codUnico = resultadoDespa.rows[0].codunico;

          // Retornar el código generado
          return codUnico;

        }
      ).then((codUnico) => {

        return responseJson(res, 200, 'ok', {
          exito: true,
          mensaje: 'Actualización y despacho registrados correctamente',
          CODUNICO: codUnico,
        });

      });

    } catch (error) {

      console.error('Error al confirmar despacho:', error);

      return responseJson(res, 503, 'Error al actualizar', {
        exito: false,
        mensaje: error.message,
        code: error.code,
      });
    }
  }
);

export default router;
