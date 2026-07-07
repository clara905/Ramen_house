const db = require('../config/db');

// 1. Get All Menu Items (supports search, category filter, pagination)
async function getMenu(req, res) {
  try {
    const { search, category, page = 1, limit = 9, admin = false } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let sql = `
      SELECT m.*, c.name AS category_name 
      FROM menu m
      JOIN categories c ON m.category_id = c.id
      WHERE 1=1
    `;
    const params = [];

    // Search query filter
    if (search) {
      sql += ' AND (m.name LIKE ? OR m.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    // Category filter
    if (category) {
      sql += ' AND (c.name = ? OR m.category_id = ?)';
      params.push(category, category);
    }

    // Availability filter (non-admin only views available items)
    if (admin !== 'true' && admin !== true) {
      sql += ' AND m.availability = 1';
    }

    // Get count for pagination
    let countSql = `SELECT COUNT(*) as total FROM (${sql}) AS temp`;
    const countResult = await db.query(countSql, params);
    const totalItems = countResult[0].total;

    // Apply pagination
    sql += ' ORDER BY m.id DESC LIMIT ? OFFSET ?';
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
    console.error('Get menu error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

// 2. Get Menu Item Details
async function getMenuDetails(req, res) {
  try {
    const { id } = req.params;
    const menuItems = await db.query(
      `SELECT m.*, c.name AS category_name 
       FROM menu m
       JOIN categories c ON m.category_id = c.id
       WHERE m.id = ?`,
      [id]
    );

    if (menuItems.length === 0) {
      return res.status(404).json({ success: false, message: 'Menu item not found.' });
    }

    return res.json({ success: true, data: menuItems[0] });
  } catch (error) {
    console.error('Get menu details error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

// 3. Create Menu Item (Admin Only)
async function createMenu(req, res) {
  try {
    const { name, description, category_id, price, spice_level, availability } = req.body;

    if (!name || !category_id || !price) {
      return res.status(400).json({ success: false, message: 'Name, category, and price are required.' });
    }

    let image = null;
    if (req.file) {
      image = req.file.filename;
    }

    const avail = availability !== undefined ? parseInt(availability) : 1;
    const spice = spice_level !== undefined ? parseInt(spice_level) : 0;

    const result = await db.query(
      `INSERT INTO menu (name, description, category_id, price, rating, availability, spice_level, image) 
       VALUES (?, ?, ?, ?, 5.0, ?, ?, ?)` ,
      [name, description || null, parseInt(category_id), parseFloat(price), avail, spice, image]
    );

    return res.status(201).json({
      success: true,
      message: 'Menu item created successfully!',
      itemId: result.insertId
    });
  } catch (error) {
    console.error('Create menu error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

// 4. Update Menu Item (Admin Only)
async function updateMenu(req, res) {
  try {
    const { id } = req.params;
    const { name, description, category_id, price, spice_level, availability, rating } = req.body;

    if (!name || !category_id || !price) {
      return res.status(400).json({ success: false, message: 'Name, category, and price are required.' });
    }

    // Check if exists
    const menuItems = await db.query('SELECT image FROM menu WHERE id = ?', [id]);
    if (menuItems.length === 0) {
      return res.status(404).json({ success: false, message: 'Menu item not found.' });
    }

    let image = menuItems[0].image;
    if (req.file) {
      image = req.file.filename;
    }

    const avail = availability !== undefined ? parseInt(availability) : 1;
    const spice = spice_level !== undefined ? parseInt(spice_level) : 0;
    const rate = rating !== undefined ? parseFloat(rating) : 5.0;

    await db.query(
      `UPDATE menu SET name = ?, description = ?, category_id = ?, price = ?, rating = ?, availability = ?, spice_level = ?, image = ? 
       WHERE id = ?`,
      [name, description || null, parseInt(category_id), parseFloat(price), rate, avail, spice, image, id]
    );

    return res.json({ success: true, message: 'Menu item updated successfully!' });
  } catch (error) {
    console.error('Update menu error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

// 5. Delete Menu Item (Admin Only)
async function deleteMenu(req, res) {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM menu WHERE id = ?', [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Menu item not found.' });
    }

    return res.json({ success: true, message: 'Menu item deleted successfully!' });
  } catch (error) {
    console.error('Delete menu error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

// 6. Get All Categories
async function getCategories(req, res) {
  try {
    const categories = await db.query('SELECT * FROM categories ORDER BY name ASC');
    return res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Get categories error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

module.exports = {
  getMenu,
  getMenuDetails,
  createMenu,
  updateMenu,
  deleteMenu,
  getCategories
};
