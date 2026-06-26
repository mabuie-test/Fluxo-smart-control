const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/env');
const { fail } = require('../utils/response');

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';

  if (!token) return fail(res, 401, 'Autenticação necessária');

  try {
    req.user = jwt.verify(token, jwtSecret);
    return next();
  } catch {
    return fail(res, 401, 'Token inválido ou expirado');
  }
}

module.exports = { authRequired };
