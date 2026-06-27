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
router.get('/:deviceId/pull', asyncHandler(controller.pull));
router.get('/:deviceId/push', asyncHandler(controller.push));

module.exports = router;
