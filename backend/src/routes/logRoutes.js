const router = require('express').Router();
const { asyncHandler } = require('../utils/asyncHandler');
const { authRequired } = require('../middleware/authMiddleware');
const { logs } = require('../controllers/logController');

router.get('/:deviceId/logs', authRequired, asyncHandler(logs));

module.exports = router;
