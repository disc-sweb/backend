// src/features/quickbooks/services/quickbooksAuthService.js

const OAuthClient = require('intuit-oauth');
const {
  clientId,
  clientSecret,
  environment,
  redirectUri,
  scopes
} = require('../../../config/quickbooks');
const { loadTokens, saveTokens } = require('../utils/tokenUtils');

// Initialize the Intuit OAuth client
const oauthClient = new OAuthClient({
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
    scope: scopes.join(' '),  // space-separated
    state
  });
}

/**
 * After QuickBooks redirects back to your callback endpoint, exchange
 * the full callback URL (with code & realmId) for tokens and persist them.
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
  let authResponse;
  try {
    authResponse = await oauthClient.createToken(callbackUrl);
  } catch (e) {
    console.error('⚠️ createToken threw:', e, Object.getOwnPropertyNames(e));
    throw e;
  }

  const { access_token, refresh_token, expires_in } = authResponse.getJson();
  const realmId = authResponse.token.realmId;
  const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

  try {
    await saveTokens({
      merchantId,
      realmId,
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt
    });
  } catch (e) {
    console.error('⚠️ saveTokens threw:', e, Object.getOwnPropertyNames(e));
    throw e;
  }

  return { realmId, accessToken: access_token, refreshToken: refresh_token, expiresAt };
}


module.exports = {
  generateConsentUrl,
  handleAuthCallback
};
