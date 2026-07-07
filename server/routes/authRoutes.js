const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.get('/profile', verifyToken, authController.getProfile);
router.put('/profile', verifyToken, upload.single('profile_picture'), authController.updateProfile);
router.put('/change-password', verifyToken, authController.changePassword);

module.exports = router;
