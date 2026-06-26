const router = require('express').Router();
const { setDesired } = require('../controllers/relayController');
const { authRequired } = require('../middleware/authMiddleware');
router.post('/:deviceId', authRequired, setDesired);
module.exports = router;
