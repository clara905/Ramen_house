CREATE DATABASE IF NOT EXISTS `ramen_house`;
USE `ramen_house`;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(100) UNIQUE NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `role` VARCHAR(20) DEFAULT 'customer', -- 'admin' or 'customer'
  `phone` VARCHAR(20) DEFAULT NULL,
  `address` TEXT DEFAULT NULL,
  `profile_picture` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Categories Table
CREATE TABLE IF NOT EXISTS `categories` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(50) UNIQUE NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Ingredients Table
CREATE TABLE IF NOT EXISTS `ingredients` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `category` VARCHAR(100) NOT NULL,
  `stock` DECIMAL(10, 2) DEFAULT 0.00,
  `unit` VARCHAR(20) NOT NULL,
  `supplier` VARCHAR(100) DEFAULT NULL,
  `purchase_price` DECIMAL(10, 2) DEFAULT 0.00,
  `status` VARCHAR(20) DEFAULT 'Available', -- 'Available', 'Low Stock', 'Out of Stock'
  `last_updated` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Menu Table
CREATE TABLE IF NOT EXISTS `menu` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `category_id` INT NOT NULL,
  `price` DECIMAL(10, 2) NOT NULL,
  `rating` DECIMAL(2, 1) DEFAULT 5.0,
  `availability` TINYINT(1) DEFAULT 1, -- 1 for Available, 0 for Unavailable
  `spice_level` INT DEFAULT 0, -- 0 (None), 1 (Mild), 2 (Medium), 3 (Hot)
  `image` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Orders Table
CREATE TABLE IF NOT EXISTS `orders` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `order_date` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `total_price` DECIMAL(10, 2) NOT NULL,
  `status` VARCHAR(20) DEFAULT 'Waiting', -- 'Waiting', 'Cooking', 'Ready', 'Completed', 'Cancelled'
  `name` VARCHAR(100) NOT NULL,
  `phone` VARCHAR(20) NOT NULL,
  `address` TEXT NOT NULL,
  `notes` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Order Details Table
CREATE TABLE IF NOT EXISTS `order_details` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `order_id` INT NOT NULL,
  `menu_id` INT NOT NULL,
  `quantity` INT NOT NULL,
  `price` DECIMAL(10, 2) NOT NULL,
  `subtotal` DECIMAL(10, 2) NOT NULL,
  FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`menu_id`) REFERENCES `menu` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. Payments Table
CREATE TABLE IF NOT EXISTS `payments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `order_id` INT NOT NULL,
  `payment_method` VARCHAR(50) NOT NULL, -- 'QRIS', 'Bank Transfer', 'Cash'
  `payment_status` VARCHAR(20) DEFAULT 'Pending', -- 'Pending', 'Paid', 'Failed'
  `payment_date` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `amount` DECIMAL(10, 2) NOT NULL,
  FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. Menu Ingredients (Recipe) Table
CREATE TABLE IF NOT EXISTS `menu_ingredients` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `menu_id` INT NOT NULL,
  `ingredient_id` INT NOT NULL,
  `quantity_needed` DECIMAL(10, 2) NOT NULL, -- Quantity of ingredient needed per 1 unit of menu item
  FOREIGN KEY (`menu_id`) REFERENCES `menu` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`ingredient_id`) REFERENCES `ingredients` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
