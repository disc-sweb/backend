// src/features/quickbooks/controller/quickbooksController.js

const { generateConsentUrl, handleAuthCallback } = require('../services/quickbooksAuthService');

/**
 * Redirect merchant to Intuit’s consent screen
 */
async function connectQuickBooks(req, res, next) {
  try {
    const state = Math.random().toString(36).substring(2);
    const url = generateConsentUrl(state);
    console.log('→ redirecting to Intuit:', url);
    res.redirect(url);
  } catch (err) {
    console.error('connectQuickBooks ERROR:', err);
    next(err);
  }
}

/**
 * Handle Intuit’s redirect back to your app:
 * store tokens, then confirm connection.
 */


// src/features/quickbooks/controller/quickbooksController.js
async function handleQuickBooksCallback(req, res, next) {
  try {
    console.log('→ full callback URL:', req.protocol + '://' + req.get('host') + req.originalUrl);
    const merchantId = 1; // hard-coded for now
    const out = await handleAuthCallback(req.originalUrl, merchantId);
    console.log('✅ tokens saved →', out);
    return res.send('QuickBooks connected successfully!');
  } catch (err) {
    // dump literally everything
    console.error('handleQuickBooksCallback RAW error:', err);
    console.error('keys:', Object.getOwnPropertyNames(err));
    return res.status(500).json({
      message: err.message ?? '[no message]',
      stack:   err.stack   ?? '[no stack]',
      raw:     err
    });
  }
}



module.exports = {
  connectQuickBooks,
  handleQuickBooksCallback
};
