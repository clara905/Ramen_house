const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

// All inventory endpoints require Admin authentication
router.use(verifyToken, isAdmin);

router.get('/', inventoryController.getInventory);
router.get('/:id', inventoryController.getIngredientDetails);
router.post('/', inventoryController.createIngredient);
router.put('/:id', inventoryController.updateIngredient);
router.delete('/:id', inventoryController.deleteIngredient);

module.exports = router;
