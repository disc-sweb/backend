// src/features/quickbooks/controller/quickbooksController.js

const { generateConsentUrl, handleAuthCallback } = require('../services/auth/quickbooksAuthService');
const createInvoiceService = require('../services/invoice/createInvoice');
const { qboRequest } = require('../utils/qboClient');
const supabase = require('../../../config/supabase');

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
async function handleQuickBooksCallback(req, res, next) {
  try {
    console.log('→ full callback URL:', req.protocol + '://' + req.get('host') + req.originalUrl);
    const out = await handleAuthCallback(req.originalUrl);
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

/**
 * Create an invoice
 */
async function createInvoice(req, res, next) {
  try {
    const invoice = await createInvoiceService(req.body);
    res.status(201).json(invoice);
  } catch (err) {
    next(err);
  }
}

/**
 * Create a customer
 * POST /api/customers
 * body: { internalCustomerId, firstName, lastName, email }
 */
async function createCustomer(req, res, next) {
  try {
    const { internalCustomerId, firstName, lastName, email } = req.body;

    if (!internalCustomerId || !firstName || !lastName || !email) {
      return res.status(400).json({
        error: 'internalCustomerId, firstName, lastName & email are required'
      });
    }

    // 1) Upsert the internal customer row
    const fullName = `${firstName} ${lastName}`;
    const { data: user, error: upsertErr } = await supabase
      .from('customers')
      .upsert(
        {
          id:    internalCustomerId,
          name:  fullName,
          email
        },
        { onConflict: 'id' }
      )
      .single();
    if (upsertErr) throw upsertErr;

    // 2) Create in QuickBooks
    const payload = {
      GivenName:       firstName,
      FamilyName:      lastName,
      DisplayName:     fullName,
      PrimaryEmailAddr:{ Address: email }
    };
    const { Customer: qboCustomer } = await qboRequest(
      '/customer?minorversion=65',
      {
        method: 'POST',
        body:   JSON.stringify(payload)
      }
    );

    // 3) Save QBO customer ID back on your row
    const { error: updateErr } = await supabase
      .from('customers')
      .update({ qbo_customer_id: qboCustomer.Id })
      .eq('id', internalCustomerId);
    if (updateErr) throw updateErr;

    res.status(201).json({
      internalCustomerId,
      qboCustomerId: qboCustomer.Id,
      fullName
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  connectQuickBooks,
  handleQuickBooksCallback,
  createInvoice,
  createCustomer
};
