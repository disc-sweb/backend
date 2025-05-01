require('dotenv').config();   // ← this must run before you `require('./utils/qboClient')`

// src/features/quickbooks/utils/qboClient.js
const fetch = require('node-fetch');
const { loadTokens, saveTokens } = require('./tokenUtils');
const {
  QB_CLIENT_ID,
  QB_CLIENT_SECRET,
  QBO_ENV,               // NEW
} = process.env;

// src/features/quickbooks/utils/qboClient.js
async function getAccessToken(merchantId) {
  let { accessToken, refreshToken, expiresAt, realmId } =
    await loadTokens(merchantId);

  // if it’s expired (or about to), hit the refresh endpoint:
  if (new Date() >= new Date(expiresAt)) {
    const url  = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
    console.log(  QB_CLIENT_ID,   QB_CLIENT_SECRET, 'CREDETIALS')
    const auth = Buffer.from(`${ QB_CLIENT_ID}:${QB_CLIENT_SECRET}`).toString('base64');
    const body = new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: refreshToken,
    });
    
    const resp = await fetch(url, {
      method:  'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type':'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });

    // debug output
    const text = await resp.text();
    console.error('QBO token refresh status:', resp.status, 'body:', text);

    if (!resp.ok) {
      // re-throw with the actual payload
      throw new Error(`Failed to refresh token: ${resp.status} — ${text}`);
    }

    const json = JSON.parse(text);
    accessToken  = json.access_token;
    refreshToken = json.refresh_token;
    expiresAt    = new Date(Date.now() + json.expires_in * 1000).toISOString();

    // save the new tokens
    await saveTokens({ merchantId, realmId, accessToken, refreshToken, expiresAt });
  }

  return { accessToken, realmId };
}


async function qboRequest(merchantId, path, options = {}) {
  const { accessToken, realmId } = await getAccessToken(merchantId);

  // choose sandbox vs. prod host
  const host =
    QBO_ENV === 'sandbox'
      ? 'https://sandbox-quickbooks.api.intuit.com'
      : 'https://quickbooks.api.intuit.com';

  const url = `${host}/v3/company/${realmId}${path}`;
  console.log('QBO URL →', url);
  console.log('Using realmId & token:', { realmId, accessToken: accessToken.slice(0, 10) + '…' });

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
    const err = await resp.json().catch(() => ({}));
    const msg = err.Fault?.Error?.[0]?.Message || resp.statusText;
    throw new Error(`QBO ${resp.status}: ${msg}`);
  }
  return resp.json();
}

module.exports = { qboRequest };
