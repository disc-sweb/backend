// src/features/quickbooks/services/quickbooksAuthService.js
const QuickBooks = require('node-quickbooks');
const {
  clientId,
  clientSecret,
  environment,
  redirectUri,
  scopes
} = require('../../../config/quickbooks');
const { loadTokens, saveTokens } = require('../utils/tokenUtils');

// Initialize the Intuit OAuth client
const oauthClient = new QuickBooks.OAuthClient({
  clientId,
  clientSecret,
  environment,   // 'sandbox' or 'production'
  redirectUri    // must match your env var and QuickBooks app settings
});

/**
 * Generate the URL that the merchant must visit to consent to your app.
 * @param {string} state  A CSRF token or random string to validate the callback
 * @returns {string}      Full OAuth2 consent URL
 */
function generateConsentUrl(state) {
  return oauthClient.authorizeUri({
    scope: scopes,  // e.g. ['com.intuit.quickbooks.accounting','com.intuit.quickbooks.payment']
    state
  });
}

/**
 * After QuickBooks redirects back to your callback endpoint, exchange
 * the full callback URL (with code & realmId) for access & refresh tokens,
 * then persist them.
 *
 * @param {string} callbackUrl     full req.url from Express (including ?code=…&realmId=…)
 * @param {number} merchantId      your internal ID for this merchant
 * @returns {Promise<{
 *   realmId: string,
 *   accessToken: string,
 *   refreshToken: string,
 *   expiresAt: string
 * }>}
 */
async function handleAuthCallback(callbackUrl, merchantId) {
  // Exchange the authorization code for tokens
  const authResponse = await oauthClient.createToken(callbackUrl);

  // Extract the JSON and relevant fields
  const tokenJson = authResponse.getJson();
  const { access_token, refresh_token, expires_in } = tokenJson;
  const realmId = authResponse.token.realmId;

  // Calculate an absolute expiry timestamp
  const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

  // Persist into Supabase via our tokenUtils
  await saveTokens({
    merchantId,
    realmId,
    accessToken: access_token,
    refreshToken: refresh_token,
    expiresAt
  });

  return { realmId, accessToken: access_token, refreshToken: refresh_token, expiresAt };
}

module.exports = {
  generateConsentUrl,
  handleAuthCallback
};
