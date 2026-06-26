const router = require('express').Router();
const { asyncHandler } = require('../utils/asyncHandler');
const { authRequired } = require('../middleware/authMiddleware');
const controller = require('../controllers/authController');

router.post('/register', asyncHandler(controller.register));
router.post('/login', asyncHandler(controller.login));
router.get('/me', authRequired, asyncHandler(controller.me));
router.post('/forgot-password', asyncHandler(controller.forgotPassword));
router.post('/reset-password', asyncHandler(controller.resetPassword));

module.exports = router;
