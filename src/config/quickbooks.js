// src/config/quickbooks.js
require('dotenv').config();

module.exports = {
  clientId: process.env.QB_CLIENT_ID,
  clientSecret: process.env.QB_CLIENT_SECRET,
  // 'sandbox' for dev/testing, switch to 'production' when you go live
  environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
  // Must exactly match what you configured in the Intuit Developer Portal
  redirectUri: process.env.QB_REDIRECT_URI,
  scopes: [
    'com.intuit.quickbooks.accounting',
    'com.intuit.quickbooks.payment'
    // add 'openid', 'profile', etc., here only if you need them
  ]
};
