const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menuController');
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.get('/', menuController.getMenu);
router.get('/categories', menuController.getCategories);
router.get('/:id', menuController.getMenuDetails);

// Admin-only operations
router.post('/', verifyToken, isAdmin, upload.single('image'), menuController.createMenu);
router.put('/:id', verifyToken, isAdmin, upload.single('image'), menuController.updateMenu);
router.delete('/:id', verifyToken, isAdmin, menuController.deleteMenu);

module.exports = router;
