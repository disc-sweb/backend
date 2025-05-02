require('dotenv').config();   // ← this must run before you `require('./utils/qboClient')`

// src/features/quickbooks/utils/qboClient.js
const fetch = require('node-fetch');
const { loadTokens, saveTokens } = require('./tokenUtils');
const {
  QB_CLIENT_ID,
  QB_CLIENT_SECRET,
  QBO_ENV,
} = process.env;

/**
 * Retrieve (and refresh, if needed) the current OAuth tokens & realm ID.
 */
async function getAccessToken() {
  let { accessToken, refreshToken, expiresAt, realmId } = await loadTokens();

  // Refresh if expired or about to expire
  if (new Date() >= new Date(expiresAt)) {
    const url  = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
    const auth = Buffer.from(`${QB_CLIENT_ID}:${QB_CLIENT_SECRET}`).toString('base64');
    const body = new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: refreshToken,
    });

    const resp = await fetch(url, {
      method:  'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });

    const text = await resp.text();
    if (!resp.ok) {
      throw new Error(`Failed to refresh token: ${resp.status} — ${text}`);
    }

    const json = JSON.parse(text);
    accessToken  = json.access_token;
    refreshToken = json.refresh_token;
    expiresAt    = new Date(Date.now() + json.expires_in * 1000).toISOString();

    // Persist updated tokens 
    await saveTokens({ realmId, accessToken, refreshToken, expiresAt });
  }

  return { accessToken, realmId };
}

/**
 * Make a QuickBooks Online API request.
 * @param {string} path    e.g. '/customer?minorversion=65'
 * @param {object} options fetch options (method, body, headers, etc.)
 */
async function qboRequest(path, options = {}) {
  const { accessToken, realmId } = await getAccessToken();

  // Determine host based on environment
  const host = QBO_ENV === 'sandbox'
    ? 'https://sandbox-quickbooks.api.intuit.com'
    : 'https://quickbooks.api.intuit.com';

  const url = `${host}/v3/company/${realmId}${path}`;
  console.log('QBO URL →', url);

  const resp = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept:        'application/json',
      'Content-Type':'application/json',
      ...(options.headers || {})
    }
  });

  if (!resp.ok) {
    // Attempt to parse error response
    const err = await resp.json().catch(() => ({}));
    const msg = err.Fault?.Error?.[0]?.Message || resp.statusText;
    throw new Error(`QBO ${resp.status}: ${msg}`);
  }

  return resp.json();
}

module.exports = { qboRequest };
