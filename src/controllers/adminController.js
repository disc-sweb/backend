// src/controllers/adminController.js
const supabaseAdmin = require('../config/supabaseAdmin');

const adminController = {
  /**
   * POST /admin/create
   * { email, password, username, firstname?, lastname? }
   * Creates a Supabase Auth user + inserts metadata.role='admin'
   */
  async createAdmin(req, res) {
    try {
      const { email, password, username, firstname, lastname } = req.body;
      if (!email || !password || !username) {
        return res.status(400).json({ error: 'email, password & username required' });
      }

      // 1) Create the Auth user with admin metadata
      const { data: user, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          user_metadata: { role: 'admin' },
          email_confirm: true
        });

      if (authError) {
        return res.status(400).json({ error: authError.message });
      }

      // 2) Insert into your users table (if you’re mirroring Auth → DB)
      const { data: profile, error: dbError } = await supabaseAdmin
        .from('users')
        .insert([{
          id:        user.id,
          email,
          username,
          firstname: firstname || null,
          lastname:  lastname  || null,
          role:      'admin'
        }])
        .select()
        .single();

      if (dbError) {
        return res.status(500).json({ error: dbError.message });
      }

      res.status(201).json({
        message: 'Admin user created',
        user: profile
      });
    } catch (err) {
      console.error('createAdmin error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
};

module.exports = adminController;
