function notFound(req, res) {
  res.status(404).json({ ok: false, message: 'Rota não encontrada' });
}

function errorHandler(err, req, res, next) {
  console.error(err);

  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors).map((item) => item.message);
    return res.status(400).json({ ok: false, message: 'Dados inválidos', details });
  }

  if (err.code === 11000) {
    return res.status(409).json({ ok: false, message: 'Registo duplicado' });
  }

  return res.status(err.status || 500).json({ ok: false, message: err.message || 'Erro interno' });
}

module.exports = { notFound, errorHandler };
