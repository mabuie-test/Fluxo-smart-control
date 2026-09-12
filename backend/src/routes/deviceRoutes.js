const router = require('express').Router();
const { asyncHandler } = require('../utils/asyncHandler');
const { authRequired } = require('../middleware/authMiddleware');
const controller = require('../controllers/deviceController');

router.get('/:deviceId/state', authRequired, asyncHandler(controller.state));
router.get('/:deviceId/energy', authRequired, asyncHandler(controller.energy));
router.put('/:deviceId/energy', authRequired, asyncHandler(controller.updateEnergy));
router.post('/:deviceId/energy', authRequired, asyncHandler(controller.updateEnergy));
router.get('/:deviceId/set', authRequired, asyncHandler(controller.setDesired));
router.post('/:deviceId/set', authRequired, asyncHandler(controller.setDesired));

// Usados só pelo firmware (SIM800L). Texto simples, sem JWT — autenticação
// própria por DEVICE_KEY.
router.get('/:deviceId/sync', asyncHandler(controller.sync));
router.post('/:deviceId/sync', asyncHandler(controller.sync));
router.get('/:deviceId/ping', asyncHandler(controller.ping));

module.exports = router;
