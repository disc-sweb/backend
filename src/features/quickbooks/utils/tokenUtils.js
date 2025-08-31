// src/features/quickbooks/utils/tokenUtils.js
// Helpers for loading and saving QuickBooks tokens using Supabase

// Import your initialized Supabase client
const supabase = require('../../../../config/supabase');

/**
 * Fetch stored QuickBooks tokens for a given merchant.
 * @param {number} merchantId
 * @returns {Promise<{
 *   merchantId: number,
 *   realmId: string,
 *   accessToken: string,
 *   refreshToken: string,
 *   expiresAt: string
 * }|null>}
 */
async function loadTokens(merchantId) {
  const { data, error } = await supabase
    .from('quickbooks_tokens')
    .select('merchant_id, realm_id, access_token, refresh_token, expires_at')
    .eq('merchant_id', merchantId)
    .single();

  if (error) {
    // If no row found, return null; otherwise, propagate error
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return {
    merchantId:    data.merchant_id,
    realmId:       data.realm_id,
    accessToken:   data.access_token,
    refreshToken:  data.refresh_token,
    expiresAt:     data.expires_at
  };
}

/**
 * Insert or update QuickBooks tokens for a merchant.
 * Relies on a unique constraint on `merchant_id` for upsert.
 * @param {Object} params
 * @param {number} params.merchantId
 * @param {string} params.realmId
 * @param {string} params.accessToken
 * @param {string} params.refreshToken
 * @param {Date|string} params.expiresAt
 */
async function saveTokens({ merchantId, realmId, accessToken, refreshToken, expiresAt }) {
  const { error } = await supabase
    .from('quickbooks_tokens')
    .upsert(
      {
        merchant_id:   merchantId,
        realm_id:      realmId,
        access_token:  accessToken,
        refresh_token: refreshToken,
        expires_at:    expiresAt,
        updated_at:    new Date().toISOString()
      },
      { onConflict: 'merchant_id' }
    );

  if (error) throw error;
}

module.exports = {
  loadTokens,
  saveTokens
};
