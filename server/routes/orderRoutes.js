const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

// All order operations require authentication
router.use(verifyToken);

router.post('/checkout', orderController.checkout);
router.get('/customer/orders', orderController.getCustomerOrders);
router.get('/admin/orders', verifyToken, isAdmin, orderController.getAdminOrders);
router.get('/admin/stats', verifyToken, isAdmin, orderController.getDashboardStats);
router.get('/:id', orderController.getOrderDetails);
router.post('/:id/pay', orderController.payOrder);
router.put('/:id/status', verifyToken, isAdmin, orderController.updateOrderStatus);

module.exports = router;
