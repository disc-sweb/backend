const supabase = require('../../../../config/supabase');

async function saveQboCustomerId(internalCustomerId, qboCustomerId) {
  const { error } = await supabase
    .from('customers')
    .update({ qbo_customer_id: qboCustomerId })
    .eq('id', internalCustomerId);

  if (error) throw new Error(`Supabase error saving qbo_customer_id: ${error.message}`);
}

module.exports = saveQboCustomerId;
