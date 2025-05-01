const supabase = require('../config/supabase');


async function adminMiddleware(req, res, next) {
  console.log(req.user, 'user')
  if (req.user?.user_metadata?.role === 'admin') {
    return next();
  }
  return res.status(403).json({ error: 'Admin privileges required' });
}


module.exports = adminMiddleware;