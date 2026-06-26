const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    resetTokenHash: { type: String, default: '' },
    resetTokenExpiresAt: { type: Date, default: null }
  },
  { timestamps: true }
);

UserSchema.methods.setPassword = async function setPassword(password) {
  this.passwordHash = await bcrypt.hash(password, 12);
};

UserSchema.methods.checkPassword = function checkPassword(password) {
  return bcrypt.compare(password, this.passwordHash);
};

UserSchema.methods.createResetToken = function createResetToken(minutes) {
  const token = crypto.randomBytes(24).toString('hex');
  this.resetTokenHash = this.constructor.hashResetToken(token);
  this.resetTokenExpiresAt = new Date(Date.now() + minutes * 60 * 1000);
  return token;
};

UserSchema.methods.clearResetToken = function clearResetToken() {
  this.resetTokenHash = '';
  this.resetTokenExpiresAt = null;
};

UserSchema.statics.hashResetToken = function hashResetToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
};

module.exports = mongoose.model('User', UserSchema);
