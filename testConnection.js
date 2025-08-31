const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testDB() {
  const { data, error } = await supabase.from('courses').select('*').limit(1);

  if (error) {
    console.error('❌ Connection Failed:', error.message);
  } else {
    console.log('✅ Connection Successful! Sample data:', data);
  }
}

testDB();
