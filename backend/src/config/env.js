require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';
const jwtSecret = process.env.JWT_SECRET || 'dev-secret-change-me';

if (isProduction && jwtSecret === 'dev-secret-change-me') {
  throw new Error('JWT_SECRET seguro é obrigatório em produção');
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction,
  port: process.env.PORT || 3000,
  mongodbUri: process.env.MONGODB_URI,
  jwtSecret,
  deviceId: process.env.DEVICE_ID || 'CASA01',
  deviceKey: process.env.DEVICE_KEY || 'CHAVE_SEGURA_123',
  appName: process.env.APP_NAME || 'Casa Inteligente',
  resetTokenMinutes: Number(process.env.RESET_TOKEN_MINUTES || 30)
};
