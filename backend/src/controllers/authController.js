const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { jwtSecret, resetTokenMinutes, isProduction } = require('../config/env');
const { ok, fail } = require('../utils/response');
const { requireFields, isEmail, isStrongEnoughPassword } = require('../utils/validation');

function publicUser(user) {
  return { id: user._id.toString(), name: user.name, email: user.email };
}

function sign(user) {
  return jwt.sign(publicUser(user), jwtSecret, { subject: user._id.toString(), expiresIn: '7d' });
}

function validateAuthPayload(req, res) {
  const missing = requireFields(req.body, ['email', 'password']);
  if (missing.length) return fail(res, 400, `Campos obrigatórios: ${missing.join(', ')}`);
  if (!isEmail(req.body.email)) return fail(res, 400, 'Email inválido');
  if (!isStrongEnoughPassword(req.body.password)) return fail(res, 400, 'A senha deve ter pelo menos 8 caracteres');
  return null;
}

async function register(req, res) {
  const missing = requireFields(req.body, ['name', 'email', 'password']);
  if (missing.length) return fail(res, 400, `Campos obrigatórios: ${missing.join(', ')}`);
  if (!isEmail(req.body.email)) return fail(res, 400, 'Email inválido');
  if (!isStrongEnoughPassword(req.body.password)) return fail(res, 400, 'A senha deve ter pelo menos 8 caracteres');

  const existing = await User.findOne({ email: req.body.email });
  if (existing) return fail(res, 409, 'Email já registado');

  const user = new User({ name: req.body.name, email: req.body.email });
  await user.setPassword(req.body.password);
  await user.save();

  return ok(res, { token: sign(user), user: publicUser(user) }, 201);
}

async function login(req, res) {
  const validationResponse = validateAuthPayload(req, res);
  if (validationResponse) return validationResponse;

  const user = await User.findOne({ email: req.body.email });
  if (!user || !(await user.checkPassword(req.body.password))) {
    return fail(res, 401, 'Credenciais inválidas');
  }

  return ok(res, { token: sign(user), user: publicUser(user) });
}

async function me(req, res) {
  return ok(res, { user: req.user });
}

async function forgotPassword(req, res) {
  if (!isEmail(req.body.email)) return fail(res, 400, 'Email inválido');

  const generic = { message: 'Se o email existir, será enviado/gerado um token de recuperação.' };
  const user = await User.findOne({ email: req.body.email });
  if (!user) return ok(res, generic);

  const resetToken = user.createResetToken(resetTokenMinutes);
  await user.save();

  // Em produção, não expomos o token na API. Integração SMTP pode ser adicionada por serviço externo.
  const data = { ...generic, expiresInMinutes: resetTokenMinutes };
  if (!isProduction) data.resetToken = resetToken;
  return ok(res, data);
}

async function resetPassword(req, res) {
  const missing = requireFields(req.body, ['token', 'password']);
  if (missing.length) return fail(res, 400, `Campos obrigatórios: ${missing.join(', ')}`);
  if (!isStrongEnoughPassword(req.body.password)) return fail(res, 400, 'A senha deve ter pelo menos 8 caracteres');

  const hash = User.hashResetToken(req.body.token);
  const user = await User.findOne({ resetTokenHash: hash, resetTokenExpiresAt: { $gt: new Date() } });
  if (!user) return fail(res, 400, 'Token inválido ou expirado');

  await user.setPassword(req.body.password);
  user.clearResetToken();
  await user.save();

  return ok(res, { message: 'Senha alterada com sucesso' });
}

module.exports = { register, login, me, forgotPassword, resetPassword };
