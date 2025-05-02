// src/features/quickbooks/utils/tokenUtils.js

const supabase = require('../../../config/supabase');

async function loadTokens() {
  const { data, error } = await supabase
    .from('quickbooks_tokens')
    .select('realm_id, access_token, refresh_token, expires_at')
    .limit(1)
    .single();

  if (error) {
    throw new Error(`Could not load QuickBooks tokens: ${error.message}`);
  }

  return {
    realmId:      data.realm_id,
    accessToken:  data.access_token,
    refreshToken: data.refresh_token,
    expiresAt:    data.expires_at
  };
}

async function saveTokens({ realmId, accessToken, refreshToken, expiresAt }) {
  const { error } = await supabase
    .from('quickbooks_tokens')
    .upsert(
      {
        realm_id:      realmId,
        access_token:  accessToken,
        refresh_token: refreshToken,
        expires_at:    expiresAt,
        updated_at:    new Date().toISOString()
      },
      { onConflict: 'realm_id' } // this assumes you have a unique constraint on `realm_id` or just one row anyway
    );

  if (error) {
    throw new Error(`Failed to save QuickBooks tokens: ${error.message}`);
  }
}

module.exports = {
  loadTokens,
  saveTokens
};
