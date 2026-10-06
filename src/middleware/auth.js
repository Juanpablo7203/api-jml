import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET no está configurado');
}

export function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      exito: false,
      mensaje: 'Token no proporcionado',
    });
  }

  const [tipo, token] = authHeader.split(' ');

  if (tipo !== 'Bearer' || !token) {
    return res.status(401).json({
      exito: false,
      mensaje: 'Formato de token inválido',
    });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);

    // Dejamos disponible la información del usuario
    // para las rutas posteriores.
    req.usuario = payload;

    next();
  } catch (error) {
    return res.status(401).json({
      exito: false,
      mensaje: 'Token inválido o expirado',
    });
  }
}