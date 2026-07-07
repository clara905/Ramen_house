const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

let pool;

async function getPool() {
  if (pool) return pool;

  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
  };

  try {
    // Try to connect to establish database first
    const connection = await mysql.createConnection(dbConfig);
    const dbName = process.env.DB_NAME || 'ramen_house';
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
    await connection.end();

    // Now connect with database specified
    pool = mysql.createPool({
      ...dbConfig,
      database: dbName,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
    return pool;
  } catch (error) {
    console.error("Database connection/creation failed:", error.message);
    throw error;
  }
}

async function query(sql, params) {
  const activePool = await getPool();
  const [results] = await activePool.execute(sql, params);
  return results;
}

async function initDb() {
  try {
    const activePool = await getPool();
    const [tables] = await activePool.query(`SHOW TABLES LIKE 'users'`);
    
    if (tables.length === 0) {
      console.log("Database tables do not exist. Initializing schema...");
      const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');

      // Split the schema SQL by semicolon, clean, and run statements individually
      const statements = schemaSql
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0);

      for (const statement of statements) {
        if (statement.toUpperCase().startsWith('CREATE DATABASE') || statement.toUpperCase().startsWith('USE')) {
          continue;
        }
        await activePool.query(statement);
      }
      console.log("Database schema tables created.");
      await seedDb(activePool);
    } else {
      console.log("Database tables already exist. Skipping schema initialization.");
      // Check if users table is empty and seed if necessary
      const [usersCountResult] = await activePool.query(`SELECT COUNT(*) as count FROM users`);
      if (usersCountResult[0].count === 0) {
        console.log("Users table is empty. Seeding initial data...");
        await seedDb(activePool);
      }
    }

    // Ensure menu_ingredients table exists (migration)
    const [menuIngredientsTable] = await activePool.query(`SHOW TABLES LIKE 'menu_ingredients'`);
    if (menuIngredientsTable.length === 0) {
      console.log("Creating menu_ingredients table...");
      await activePool.query(`
        CREATE TABLE \`menu_ingredients\` (
          \`id\` INT AUTO_INCREMENT PRIMARY KEY,
          \`menu_id\` INT NOT NULL,
          \`ingredient_id\` INT NOT NULL,
          \`quantity_needed\` DECIMAL(10, 2) NOT NULL,
          FOREIGN KEY (\`menu_id\`) REFERENCES \`menu\` (\`id\`) ON DELETE CASCADE,
          FOREIGN KEY (\`ingredient_id\`) REFERENCES \`ingredients\` (\`id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      console.log("Created menu_ingredients table.");
      await seedRecipes(activePool);
    }

    // Make sure we have egg stock for testing on pre-existing database
    await activePool.query(`UPDATE ingredients SET stock = 100.00, status = 'Available' WHERE name = 'Ajitsuke Tamago (Egg)' AND stock = 0.00`);
  } catch (err) {
    console.error("Critical error during database schema init:", err.message);
  }
}

async function seedRecipes(db) {
  const [countResult] = await db.query('SELECT COUNT(*) as count FROM menu_ingredients');
  if (countResult[0].count > 0) return;

  console.log("Seeding default recipes (menu_ingredients)...");
  await db.query(`
    INSERT INTO menu_ingredients (menu_id, ingredient_id, quantity_needed) VALUES 
    (1, 1, 0.15), (1, 3, 0.05), (1, 4, 1.00), (1, 5, 0.02),
    (2, 1, 0.15), (2, 5, 0.02), (2, 10, 1.00),
    (3, 1, 0.15), (3, 2, 0.10), (3, 5, 0.02), (3, 6, 0.05),
    (4, 1, 0.15), (4, 2, 0.10), (4, 5, 0.02),
    (5, 1, 0.15), (5, 5, 0.02),
    (6, 7, 5.00), (6, 8, 0.08),
    (7, 5, 0.01),
    (8, 9, 0.02),
    (9, 9, 0.01),
    (10, 11, 0.15), (10, 12, 0.10), (10, 13, 0.05), (10, 14, 0.01), (10, 15, 2.00), (10, 16, 0.002),
    (11, 11, 0.15), (11, 12, 0.10), (11, 13, 0.05), (11, 9, 0.02), (11, 15, 2.00), (11, 16, 0.002)
  `);
  console.log("Seeded default recipes successfully.");
}

async function seedDb(db) {
  console.log("Seeding initial data...");

  // 1. Seed default accounts
  const adminPassword = bcrypt.hashSync('admin123', 10);
  const customerPassword = bcrypt.hashSync('customer123', 10);

  await db.query(
    `INSERT INTO users (name, email, password, role, phone, address) VALUES 
     ('System Admin', 'admin@ramenhouse.com', ?, 'admin', '123-456-7890', 'Ramen House HQ'),
     ('John Doe', 'customer@ramenhouse.com', ?, 'customer', '987-654-3210', '123 Foodie Street, Flavor Town')`,
    [adminPassword, customerPassword]
  );
  console.log("Seeded default users (Admin & Customer).");

  // 2. Seed categories
  await db.query(`INSERT INTO categories (id, name) VALUES (1, 'Ramen'), (2, 'Sides'), (3, 'Drinks'), (4, 'Desserts')`);
  console.log("Seeded categories.");

  // 3. Seed ingredients
  await db.query(
    `INSERT INTO ingredients (name, category, stock, unit, supplier, purchase_price, status) VALUES 
     ('Ramen Noodles', 'Noodles', 120.50, 'kg', 'Tokyo Noodle Co.', 3.50, 'Available'),
     ('Pork Chashu Slices', 'Meat', 45.00, 'kg', 'Premium Meat Supplier', 12.00, 'Available'),
     ('Chicken Broth Powder', 'Soup Base', 12.00, 'kg', 'Kikkoman Corp', 8.50, 'Low Stock'),
     ('Ajitsuke Tamago (Egg)', 'Toppings', 100.00, 'pcs', 'Egg Farm Local', 0.80, 'Available'),
     ('Green Onions (Scallions)', 'Vegetables', 25.00, 'kg', 'Fresh Farms Inc', 1.50, 'Available'),
     ('Shoyu Ramen Sauce', 'Seasoning', 30.00, 'liters', 'Kikkoman Corp', 4.20, 'Available'),
     ('Gyoza Wrappers', 'Wrapper', 500.00, 'pcs', 'Tokyo Noodle Co.', 0.05, 'Available'),
     ('Minced Pork', 'Meat', 8.00, 'kg', 'Premium Meat Supplier', 7.50, 'Low Stock'),
     ('Matcha Powder', 'Powder', 4.00, 'kg', 'Kyoto Tea Importers', 25.00, 'Available'),
     ('Nori Seaweed Sheets', 'Toppings', 150.00, 'pcs', 'Seaweed World', 0.15, 'Available'),
     ('Heavy Cream', 'Dairy', 50.00, 'liters', 'Meadow Farms Dairy', 4.50, 'Available'),
     ('Whole Milk', 'Dairy', 50.00, 'liters', 'Meadow Farms Dairy', 1.80, 'Available'),
     ('Sugar', 'Sweetener', 20.00, 'kg', 'Sweet Life Co.', 1.20, 'Available'),
     ('Vanilla Extract', 'Flavoring', 5.00, 'liters', 'Spice & Flavor Co.', 35.00, 'Available'),
     ('Egg Yolks', 'Dairy', 200.00, 'pcs', 'Egg Farm Local', 0.20, 'Available'),
     ('Salt', 'Seasoning', 10.00, 'kg', 'Fresh Farms Inc', 0.50, 'Available')`
  );
  console.log("Seeded ingredients.");

  // 4. Seed menu items
  await db.query(
    `INSERT INTO menu (id, name, description, category_id, price, rating, availability, spice_level, image) VALUES 
     (1, 'Chicken Ramen', 'Rich, creamy chicken broth topped with tender chicken slices, soft-boiled egg, green onions, and bamboo shoots.', 1, 12.99, 4.8, 1, 1, 'chicken_ramen.jpg'),
     (2, 'Beef Ramen', 'Savory beef-infused broth with thin slices of marinated beef, fresh bok choy, soy sauce egg, and nori sheets.', 1, 14.50, 4.7, 1, 1, 'beef_ramen.jpg'),
     (3, 'Shoyu Ramen', 'Traditional soy sauce based clear broth served with tender pork chashu, bamboo shoots, and green onions.', 1, 11.99, 4.5, 1, 0, 'shoyu_ramen.jpg'),
     (4, 'Spicy Miso Ramen', 'Spicy miso-flavored rich broth topped with pork chashu, sweet corn, wood ear mushrooms, and fresh chili.', 1, 13.99, 4.9, 1, 3, 'spicy_miso_ramen.jpg'),
     (5, 'Curry Ramen', 'Fragrant Japanese curry broth with tempura prawns, carrots, potatoes, and scallions.', 1, 13.49, 4.6, 1, 2, 'curry_ramen.jpg'),
     (6, 'Pork Gyoza', 'Pan-fried Japanese dumplings filled with seasoned minced pork and cabbage, served with dipping sauce.', 2, 5.99, 4.6, 1, 0, 'gyoza.jpg'),
     (7, 'Chicken Karaage', 'Crispy Japanese style deep-fried chicken bites, served with Kewpie mayo.', 2, 6.99, 4.7, 1, 0, 'karaage.jpg'),
     (8, 'Matcha Latte', 'Creamy and earthy beverage made with high-quality Uji matcha and steamed milk.', 3, 4.49, 4.8, 1, 0, 'matcha_latte.jpg'),
     (9, 'Ocha Green Tea', 'Refreshing hot Japanese green tea.', 3, 2.49, 4.4, 1, 0, 'ocha.jpg'),
     (10, 'Vanilla Ice Cream', 'Classic rich and creamy vanilla bean ice cream.', 4, 3.99, 5.0, 1, 0, 'vanilla_ice_cream.jpg'),
     (11, 'Matcha Ice Cream', 'Rich and creamy house-made green tea ice cream crafted with premium Uji Matcha.', 4, 4.99, 5.0, 1, 0, 'matcha_ice_cream.jpg')`
  );
  console.log("Seeded menu items.");
  
  await seedRecipes(db);
  console.log("Seeding completed successfully.");
}

module.exports = {
  getPool,
  query,
  initDb,
  seedRecipes
};
