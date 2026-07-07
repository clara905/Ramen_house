const db = require('../config/db');

// Helper to determine status based on stock level
function calculateStatus(stock) {
  const numStock = parseFloat(stock);
  if (numStock <= 0) return 'Out of Stock';
  if (numStock <= 10) return 'Low Stock';
  return 'Available';
}

// 1. Get Inventory Items (supports search, category/status filters, pagination)
async function getInventory(req, res) {
  try {
    const { search, category, status, page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let sql = 'SELECT * FROM ingredients WHERE 1=1';
    const params = [];

    if (search) {
      sql += ' AND (name LIKE ? OR supplier LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    // Get count for pagination
    let countSql = `SELECT COUNT(*) as total FROM (${sql}) AS temp`;
    const countResult = await db.query(countSql, params);
    const totalItems = countResult[0].total;

    sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const items = await db.query(sql, params);

    return res.json({
      success: true,
      data: items,
      pagination: {
        total: totalItems,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalItems / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get inventory error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

// 2. Get Single Ingredient Details
async function getIngredientDetails(req, res) {
  try {
    const { id } = req.params;
    const items = await db.query('SELECT * FROM ingredients WHERE id = ?', [id]);

    if (items.length === 0) {
      return res.status(404).json({ success: false, message: 'Ingredient not found.' });
    }

    return res.json({ success: true, data: items[0] });
  } catch (error) {
    console.error('Get ingredient details error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

// 3. Create Ingredient
async function createIngredient(req, res) {
  try {
    const { name, category, stock, unit, supplier, purchase_price } = req.body;

    if (!name || !category || stock === undefined || !unit || purchase_price === undefined) {
      return res.status(400).json({ success: false, message: 'Please fill all required fields.' });
    }

    const floatStock = parseFloat(stock);
    const status = calculateStatus(floatStock);

    const result = await db.query(
      `INSERT INTO ingredients (name, category, stock, unit, supplier, purchase_price, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?)` ,
      [name, category, floatStock, unit, supplier || null, parseFloat(purchase_price), status]
    );

    return res.status(201).json({
      success: true,
      message: 'Ingredient added successfully!',
      ingredientId: result.insertId
    });
  } catch (error) {
    console.error('Create ingredient error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

// 4. Update Ingredient
async function updateIngredient(req, res) {
  try {
    const { id } = req.params;
    const { name, category, stock, unit, supplier, purchase_price } = req.body;

    if (!name || !category || stock === undefined || !unit || purchase_price === undefined) {
      return res.status(400).json({ success: false, message: 'Please fill all required fields.' });
    }

    // Check if exists
    const check = await db.query('SELECT id FROM ingredients WHERE id = ?', [id]);
    if (check.length === 0) {
      return res.status(404).json({ success: false, message: 'Ingredient not found.' });
    }

    const floatStock = parseFloat(stock);
    const status = calculateStatus(floatStock);

    await db.query(
      `UPDATE ingredients SET name = ?, category = ?, stock = ?, unit = ?, supplier = ?, purchase_price = ?, status = ? 
       WHERE id = ?`,
      [name, category, floatStock, unit, supplier || null, parseFloat(purchase_price), status, id]
    );

    return res.json({ success: true, message: 'Ingredient updated successfully!' });
  } catch (error) {
    console.error('Update ingredient error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

// 5. Delete Ingredient
async function deleteIngredient(req, res) {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM ingredients WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Ingredient not found.' });
    }

    return res.json({ success: true, message: 'Ingredient deleted successfully!' });
  } catch (error) {
    console.error('Delete ingredient error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

module.exports = {
  getInventory,
  getIngredientDetails,
  createIngredient,
  updateIngredient,
  deleteIngredient
};
