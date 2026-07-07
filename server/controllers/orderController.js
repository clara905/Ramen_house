const db = require('../config/db');

// 1. Customer Checkout
async function checkout(req, res) {
  try {
    const { name, phone, address, notes, payment_method, items } = req.body;
    const userId = req.user.id;

    if (!name || !phone || !address || !payment_method || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid checkout information.' });
    }

    // Connect database and run checkout sequence
    // Calculate total price from database values to avoid client tampering
    let calculatedTotal = 0;
    const itemsWithPrice = [];

    for (const item of items) {
      const menuItems = await db.query('SELECT price, name, availability FROM menu WHERE id = ?', [item.menu_id]);
      if (menuItems.length === 0) {
        return res.status(404).json({ success: false, message: `Menu item with ID ${item.menu_id} not found.` });
      }

      const menuItem = menuItems[0];
      if (!menuItem.availability) {
        return res.status(400).json({ success: false, message: `Menu item "${menuItem.name}" is currently unavailable.` });
      }

      const subtotal = parseFloat(menuItem.price) * parseInt(item.quantity);
      calculatedTotal += subtotal;

      itemsWithPrice.push({
        menu_id: item.menu_id,
        quantity: parseInt(item.quantity),
        price: parseFloat(menuItem.price),
        subtotal
      });
    }

    // 1. Gather all recipe ingredients and check stock levels
    const recipeMap = {};
    for (const item of items) {
      const recipes = await db.query(
        `SELECT mi.ingredient_id, mi.quantity_needed, i.name as ingredient_name, i.stock as current_stock, i.unit 
         FROM menu_ingredients mi
         JOIN ingredients i ON mi.ingredient_id = i.id
         WHERE mi.menu_id = ?`,
        [item.menu_id]
      );

      for (const recipe of recipes) {
        const needed = parseFloat(recipe.quantity_needed) * parseInt(item.quantity);
        if (!recipeMap[recipe.ingredient_id]) {
          recipeMap[recipe.ingredient_id] = {
            name: recipe.ingredient_name,
            total_needed: 0,
            current_stock: parseFloat(recipe.current_stock),
            unit: recipe.unit
          };
        }
        recipeMap[recipe.ingredient_id].total_needed += needed;
      }
    }

    // 2. Validate stock levels
    for (const ingId in recipeMap) {
      const ing = recipeMap[ingId];
      if (ing.total_needed > ing.current_stock) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ingredient: "${ing.name}". Needed: ${ing.total_needed} ${ing.unit}, but only ${ing.current_stock} ${ing.unit} available.`
        });
      }
    }

    // 3. Deduct stock levels
    for (const ingId in recipeMap) {
      const ing = recipeMap[ingId];
      const newStock = Math.max(0, ing.current_stock - ing.total_needed);
      let newStatus = 'Available';
      if (newStock <= 0) {
        newStatus = 'Out of Stock';
      } else if (newStock <= 10) {
        newStatus = 'Low Stock';
      }
      await db.query(
        'UPDATE ingredients SET stock = ?, status = ? WHERE id = ?',
        [newStock, newStatus, ingId]
      );
    }

    // Insert Order
    const orderResult = await db.query(
      `INSERT INTO orders (user_id, total_price, status, name, phone, address, notes) 
       VALUES (?, ?, 'Waiting', ?, ?, ?, ?)` ,
      [userId, calculatedTotal, name, phone, address, notes || null]
    );

    const orderId = orderResult.insertId;

    // Insert Order Details
    for (const item of itemsWithPrice) {
      await db.query(
        `INSERT INTO order_details (order_id, menu_id, quantity, price, subtotal) 
         VALUES (?, ?, ?, ?, ?)` ,
        [orderId, item.menu_id, item.quantity, item.price, item.subtotal]
      );
    }

    // Insert Payment
    // For QRIS and Bank Transfer, set payment status to 'Pending' (Cash is 'Pending' too until received)
    await db.query(
      `INSERT INTO payments (order_id, payment_method, payment_status, amount) 
       VALUES (?, ?, 'Pending', ?)` ,
      [orderId, payment_method, calculatedTotal]
    );

    return res.status(201).json({
      success: true,
      message: 'Order placed successfully!',
      orderId,
      total: calculatedTotal
    });
  } catch (error) {
    console.error('Checkout error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

// 2. Get Customer Order History
async function getCustomerOrders(req, res) {
  try {
    const userId = req.user.id;
    const orders = await db.query(
      `SELECT o.*, p.payment_method, p.payment_status 
       FROM orders o
       LEFT JOIN payments p ON o.id = p.order_id
       WHERE o.user_id = ?
       ORDER BY o.order_date DESC`,
      [userId]
    );

    return res.json({ success: true, data: orders });
  } catch (error) {
    console.error('Get customer orders error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

// 3. Get Single Order Details (for both Admin & Customer)
async function getOrderDetails(req, res) {
  try {
    const { id } = req.params;
    
    // Fetch order header
    const orders = await db.query(
      `SELECT o.*, p.payment_method, p.payment_status, u.email as customer_email 
       FROM orders o
       LEFT JOIN payments p ON o.id = p.order_id
       JOIN users u ON o.user_id = u.id
       WHERE o.id = ?`,
      [id]
    );

    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const order = orders[0];

    // Security check: Customer can only view their own orders
    if (req.user.role === 'customer' && order.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access Denied.' });
    }

    // Fetch order items details
    const items = await db.query(
      `SELECT od.*, m.name as menu_name, m.image as menu_image 
       FROM order_details od
       JOIN menu m ON od.menu_id = m.id
       WHERE od.order_id = ?`,
      [id]
    );

    return res.json({
      success: true,
      data: {
        ...order,
        items
      }
    });
  } catch (error) {
    console.error('Get order details error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

// 4. Get Admin Orders List (with pagination and filter)
async function getAdminOrders(req, res) {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let sql = `
      SELECT o.*, p.payment_method, p.payment_status 
      FROM orders o
      LEFT JOIN payments p ON o.id = p.order_id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      sql += ' AND o.status = ?';
      params.push(status);
    }

    // Get count
    let countSql = `SELECT COUNT(*) as total FROM (${sql}) AS temp`;
    const countResult = await db.query(countSql, params);
    const totalItems = countResult[0].total;

    sql += ' ORDER BY o.order_date DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const orders = await db.query(sql, params);

    return res.json({
      success: true,
      data: orders,
      pagination: {
        total: totalItems,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalItems / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get admin orders error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

// 5. Update Order Status (Admin Only)
async function updateOrderStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, payment_status } = req.body; // Status can be Waiting, Cooking, Ready, Completed, Cancelled

    if (!status) {
      return res.status(400).json({ success: false, message: 'Please provide status.' });
    }

    // Check if exists
    const orders = await db.query('SELECT status FROM orders WHERE id = ?', [id]);
    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const oldStatus = orders[0].status;

    // Handle cancellation stock restoration
    if (status === 'Cancelled' && oldStatus !== 'Cancelled') {
      const orderItems = await db.query('SELECT menu_id, quantity FROM order_details WHERE order_id = ?', [id]);
      
      for (const item of orderItems) {
        const recipes = await db.query(
          `SELECT mi.ingredient_id, mi.quantity_needed, i.stock as current_stock 
           FROM menu_ingredients mi
           JOIN ingredients i ON mi.ingredient_id = i.id
           WHERE mi.menu_id = ?`,
          [item.menu_id]
        );

        for (const recipe of recipes) {
          const restoreQty = parseFloat(recipe.quantity_needed) * parseInt(item.quantity);
          const newStock = parseFloat(recipe.current_stock) + restoreQty;
          let newStatus = 'Available';
          if (newStock <= 0) {
            newStatus = 'Out of Stock';
          } else if (newStock <= 10) {
            newStatus = 'Low Stock';
          }
          await db.query(
            'UPDATE ingredients SET stock = ?, status = ? WHERE id = ?',
            [newStock, newStatus, recipe.ingredient_id]
          );
        }
      }
    }

    // Update order status
    await db.query('UPDATE orders SET status = ? WHERE id = ?', [status, id]);

    // Optional: If order is completed, update payment status to Paid (if cash or transfer confirmed)
    let finalPayStatus = payment_status;
    if (status === 'Completed' && !finalPayStatus) {
      finalPayStatus = 'Paid';
    }

    if (finalPayStatus) {
      await db.query('UPDATE payments SET payment_status = ? WHERE order_id = ?', [finalPayStatus, id]);
    }

    return res.json({ success: true, message: `Order status updated to ${status}.` });
  } catch (error) {
    console.error('Update order status error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

// 6. Get Dashboard Stats (Admin Only)
async function getDashboardStats(req, res) {
  try {
    // 1. Total Menu items
    const menuCount = await db.query('SELECT COUNT(*) as total FROM menu');
    
    // 2. Total Ingredients
    const ingredientCount = await db.query('SELECT COUNT(*) as total FROM ingredients');
    
    // 3. Today's Orders
    const todayOrders = await db.query(
      `SELECT COUNT(*) as total FROM orders 
       WHERE DATE(order_date) = CURDATE()`
    );

    // 4. Monthly Revenue
    const monthlyRev = await db.query(
      `SELECT SUM(total_price) as total FROM orders 
       WHERE status = 'Completed' AND MONTH(order_date) = MONTH(CURDATE()) AND YEAR(order_date) = YEAR(CURDATE())`
    );

    // 5. Total Customers
    const customerCount = await db.query("SELECT COUNT(*) as total FROM users WHERE role = 'customer'");

    // 6. Low Stock Ingredients
    const lowStockCount = await db.query("SELECT COUNT(*) as total FROM ingredients WHERE status IN ('Low Stock', 'Out of Stock')");

    // 7. Recent Orders (last 5)
    const recentOrders = await db.query(
      `SELECT o.*, p.payment_method, p.payment_status 
       FROM orders o
       LEFT JOIN payments p ON o.id = p.order_id
       ORDER BY o.order_date DESC LIMIT 5`
    );

    // 8. Sales Chart (Daily sales for last 7 days)
    const dailySales = await db.query(
      `SELECT DATE_FORMAT(order_date, '%Y-%m-%d') as date, COUNT(*) as count, SUM(total_price) as revenue 
       FROM orders 
       WHERE order_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
       GROUP BY DATE_FORMAT(order_date, '%Y-%m-%d')
       ORDER BY date ASC`
    );

    // 9. Monthly Revenue Chart (for last 6 months)
    const monthlyRevenueChart = await db.query(
      `SELECT DATE_FORMAT(order_date, '%Y-%m') as month, SUM(total_price) as revenue 
       FROM orders 
       WHERE status = 'Completed' AND order_date >= DATE_SUB(CURDATE(), INTERVAL 5 MONTH)
       GROUP BY DATE_FORMAT(order_date, '%Y-%m')
       ORDER BY month ASC`
    );

    return res.json({
      success: true,
      data: {
        cards: {
          totalMenu: menuCount[0].total,
          totalIngredients: ingredientCount[0].total,
          todayOrders: todayOrders[0].total,
          monthlyRevenue: parseFloat(monthlyRev[0].total || 0),
          totalCustomers: customerCount[0].total,
          lowStockIngredients: lowStockCount[0].total
        },
        recentOrders,
        charts: {
          dailySales,
          monthlyRevenue: monthlyRevenueChart
        }
      }
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

// 7. Simulate Customer Payment for QRIS / Bank Transfer
async function payOrder(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if order exists
    const orders = await db.query('SELECT * FROM orders WHERE id = ?', [id]);
    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const order = orders[0];

    // Customer can only pay for their own orders
    if (req.user.role !== 'admin' && order.user_id !== userId) {
      return res.status(403).json({ success: false, message: 'Access Denied.' });
    }

    // Check payment status
    const payments = await db.query('SELECT * FROM payments WHERE order_id = ?', [id]);
    if (payments.length === 0) {
      return res.status(404).json({ success: false, message: 'Payment details not found.' });
    }

    const payment = payments[0];
    if (payment.payment_status === 'Paid') {
      return res.status(400).json({ success: false, message: 'Order has already been paid.' });
    }

    // Update payment status to 'Paid'
    await db.query(
      "UPDATE payments SET payment_status = 'Paid', payment_date = CURRENT_TIMESTAMP WHERE order_id = ?",
      [id]
    );

    // If order is waiting, advance it to Cooking status
    if (order.status === 'Waiting') {
      await db.query("UPDATE orders SET status = 'Cooking' WHERE id = ?", [id]);
    }

    return res.json({
      success: true,
      message: 'Payment simulation successful. Your order is now being prepared!'
    });
  } catch (error) {
    console.error('Pay order error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

module.exports = {
  checkout,
  getCustomerOrders,
  getOrderDetails,
  getAdminOrders,
  updateOrderStatus,
  getDashboardStats,
  payOrder
};

