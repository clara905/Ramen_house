const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// 1. Register User
async function register(req, res) {
  try {
    const { name, email, password, phone, address } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide name, email and password.' });
    }

    // Check if user exists
    const users = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (users.length > 0) {
      return res.status(400).json({ success: false, message: 'Email is already registered.' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Save user
    await db.query(
      'INSERT INTO users (name, email, password, role, phone, address) VALUES (?, ?, ?, ?, ?, ?)',
      [name, email, hashedPassword, 'customer', phone || null, address || null]
    );

    return res.status(201).json({ success: true, message: 'Registration successful! Please log in.' });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

// 2. Login User
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password.' });
    }

    // Find user
    const users = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid email or password.' });
    }

    const user = users[0];

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid email or password.' });
    }

    // Issue token
    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'ramenhouse_super_secure_secret_key_2026',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return res.json({
      success: true,
      message: 'Login successful!',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        address: user.address,
        profile_picture: user.profile_picture
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

// 3. Forgot Password (Mock)
async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Please provide an email address.' });
    }

    const users = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'Email address not found.' });
    }

    // In production, send a mail. For university demo, return a simulated code.
    return res.json({ 
      success: true, 
      message: 'Password reset instructions have been sent to your email. (Demo: You can use standard default passwords to log back in)' 
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

// 4. Get Current Profile
async function getProfile(req, res) {
  try {
    const users = await db.query('SELECT id, name, email, role, phone, address, profile_picture, created_at FROM users WHERE id = ?', [req.user.id]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    return res.json({ success: true, user: users[0] });
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

// 5. Update Profile
async function updateProfile(req, res) {
  try {
    const { name, phone, address } = req.body;
    const userId = req.user.id;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Name is required.' });
    }

    let profilePicture = null;
    if (req.file) {
      profilePicture = req.file.filename;
    }

    if (profilePicture) {
      await db.query(
        'UPDATE users SET name = ?, phone = ?, address = ?, profile_picture = ? WHERE id = ?',
        [name, phone || null, address || null, profilePicture, userId]
      );
    } else {
      await db.query(
        'UPDATE users SET name = ?, phone = ?, address = ? WHERE id = ?',
        [name, phone || null, address || null, userId]
      );
    }

    const updatedUsers = await db.query('SELECT id, name, email, role, phone, address, profile_picture FROM users WHERE id = ?', [userId]);
    return res.json({
      success: true,
      message: 'Profile updated successfully!',
      user: updatedUsers[0]
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

// 6. Change Password
async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Please provide current and new passwords.' });
    }

    // Get current user password
    const users = await db.query('SELECT password FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const user = users[0];

    // Check current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Incorrect current password.' });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Save
    await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedNewPassword, userId]);

    return res.json({ success: true, message: 'Password changed successfully!' });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

module.exports = {
  register,
  login,
  forgotPassword,
  getProfile,
  updateProfile,
  changePassword
};
