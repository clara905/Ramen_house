const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

router.use(verifyToken, isAdmin);

router.get('/', reportController.getReport);
router.get('/export', reportController.exportReport);

module.exports = router;
