// // scripts/promoteAdmin.js
// require('dotenv').config();
// const { createClient } = require('@supabase/supabase-js');

// // Admin client with service‐role key
// const supabaseAdmin = createClient(
//   process.env.SUPABASE_URL,
//   process.env.SUPABASE_SERVICE_ROLE_KEY
// );

// async function run() {
//   // Paste the Auth user ID you got from /auth/me
//   const userId = '528e4d28-b24a-47f1-a66b-d7ddd507b7b9';
//   const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
//     user_metadata: { role: 'admin' }
//   });
//   if (error) {
//     console.error('Error promoting to admin:', error);
//     process.exit(1);
//   }
//   console.log('✅ User promoted to admin:', data);
//   process.exit(0);
// }

// run();
