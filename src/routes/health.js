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
      expiresIn: '8h',
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
          getCompanyPool('084', 1),
          'SELECT CODIGOSUC, FECHA, CODIGO, CODIGOPRIN, CANTIDAD, UNIDAD, DETALLE, ORDENDET  FROM Nota_ped_det WHERE folio = $1 and codigosuc=$2',
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

      await withTransaction(
        getCompanyPool('084', 1),
        async (client) => {

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
        }
      );

      return responseJson(res, 200, 'ok', {
        exito: true,
        mensaje: 'Actualización efectuada',
      });

    } catch (error) {

      return responseJson(res, 503, 'Error al actualizar', {
        exito: false,
        mensaje: error.message,
        code: error.code,
      });
    }
  }
);

export default router;
