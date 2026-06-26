const mongoose = require('mongoose');
const { mongodbUri } = require('./env');
async function connectDb() {
  if (!mongodbUri) throw new Error('MONGODB_URI não definido');
  await mongoose.connect(mongodbUri);
}
module.exports = { connectDb };
