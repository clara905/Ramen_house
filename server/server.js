const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const { initDb } = require('./config/db');

// Load environment configurations
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS
app.use(cors());

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded assets statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve frontend client statically if running combined, or just direct API responses
// Ensure we map standard upload directory
const uploadsDir = path.join(__dirname, 'uploads');
const fs = require('fs');
if (!fs.existsSync(uploadsDir)){
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Mount routes
const authRoutes = require('./routes/authRoutes');
const menuRoutes = require('./routes/menuRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const orderRoutes = require('./routes/orderRoutes');
const reportRoutes = require('./routes/reportRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reports', reportRoutes);

// Simple status route
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Ramen House API is running and healthy!' });
});

// Database checking and server start
async function startServer() {
  try {
    // Attempt DB connection & migrations
    await initDb();
    
    app.listen(PORT, () => {
      console.log(`==================================================`);
      console.log(`Ramen House Backend server running on port: ${PORT}`);
      console.log(`Access the APIs at http://localhost:${PORT}/api/health`);
      console.log(`==================================================`);
    });
  } catch (error) {
    console.error('Fatal: Server failed to start due to database error:', error.message);
  }
}

startServer();
