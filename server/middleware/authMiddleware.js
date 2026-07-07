const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access Denied: No Token Provided!' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'ramenhouse_super_secure_secret_key_2026');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ success: false, message: 'Invalid or Expired Token!' });
  }
}

function isAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    return res.status(403).json({ success: false, message: 'Access Denied: Requires Admin Role!' });
  }
}

function isCustomer(req, res, next) {
  if (req.user && req.user.role === 'customer') {
    next();
  } else {
    return res.status(403).json({ success: false, message: 'Access Denied: Requires Customer Role!' });
  }
}

module.exports = {
  verifyToken,
  isAdmin,
  isCustomer
};
