const supabase = require('../config/supabase');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const cookieToken = req.cookies.session;

    const token = authHeader ? authHeader.split(' ')[1] : cookieToken;

    if (!token) {
      return res.status(401).json({ error: 'No session token provided' });
    }

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res
        .status(401)
        .json({ error: 'Invalid or expired session token' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = authMiddleware;

// src/middleware/adminMiddleware.js
module.exports = function requireAdmin(req, res, next) {
  // supabase user metadata is under user_metadata
  console.log(req.user)
  if (req.user?.user_metadata?.role === 'admin') {
    return next();
  }
  return res.status(403).json({ error: 'Admin privileges required' });
};
