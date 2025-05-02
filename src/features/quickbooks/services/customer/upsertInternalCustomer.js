const supabase = require('../../../../config/supabase');

async function upsertInternalCustomer(internalCustomerId, fullName, email) {
  const { data, error } = await supabase
    .from('customers')
    .upsert(
      {
        id: internalCustomerId,
        name: fullName,
        email
      },
      { onConflict: 'id' }
    )
    .single();

  if (error) throw new Error(`Supabase error upserting internal customer: ${error.message}`);
  return data;
}

module.exports = upsertInternalCustomer;
