// scripts/createAdmin.js

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://nvzissdxnmfymgzkphmo.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY  // must be your service-role key
);
console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
async function run() {
  const email    = 'jerrybony5@gmail.com';
  const password = 'SuperSecret123!';

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    user_metadata: { role: 'admin' },
    email_confirm: true       // optional: auto-confirms the email
  });

  if (error) {
    console.error('Error creating admin user:', error);
    process.exit(1);
  }
  console.log('✅ Admin user created:', data);
}

run();
