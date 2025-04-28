// src/features/quickbooks/services/quickbooksPaymentService.js

const QuickBooks = require('node-quickbooks');
const { loadTokens, saveTokens } = require('../utils/tokenUtils');
const {
  clientId,
  clientSecret,
  environment
} = require('../../../config/quickbooks');

// Initialize a QuickBooks client for a given merchant
async function initQBO(merchantId) {
  const tokens = await loadTokens(merchantId);
  if (!tokens) {
    throw new Error(`No QuickBooks tokens found for merchant ${merchantId}`);
  }

  const qbo = new QuickBooks(
    clientId,
    clientSecret,
    tokens.accessToken,
    false,               // no token secret for OAuth2
    tokens.realmId,
    environment === 'production' ? false : true, // sandbox flag
    false,               // disable debug logging
    4,                   // minor version
    '2.0',
    tokens.refreshToken  // for auto-refresh
  );

  // Auto-refresh handler: save new tokens when they’re rotated
  qbo.refreshAccessToken((err, oauthResponse) => {
    if (!err && oauthResponse.token) {
      const { access_token, refresh_token, expires_in } = oauthResponse.token;
      const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();
      saveTokens({
        merchantId,
        realmId: oauthResponse.token.realmId || tokens.realmId,
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt
      }).catch(console.error);
    }
  });

  return qbo;
}

/**
 * Create a new Invoice in QuickBooks.
 * @param {number} merchantId
 * @param {object} invoicePayload  // per QuickBooks API spec
 * @returns {Promise<object>}  the created Invoice
 */
async function createInvoice(merchantId, invoicePayload) {
  const qbo = await initQBO(merchantId);
  return new Promise((resolve, reject) => {
    qbo.createInvoice(invoicePayload, (err, invoice) => {
      if (err) return reject(err);
      resolve(invoice);
    });
  });
}

/**
 * List invoices, optionally filtering by customer.
 * @param {number} merchantId
 * @param {string|null} customerRef
 * @returns {Promise<object[]>}
 */
async function listInvoices(merchantId, customerRef = null) {
  const qbo = await initQBO(merchantId);
  const sql = customerRef
    ? `SELECT * FROM Invoice WHERE CustomerRef='${customerRef}' ORDER BY TxnDate DESC`
    : `SELECT * FROM Invoice ORDER BY TxnDate DESC`;

  return new Promise((resolve, reject) => {
    qbo.query(sql, (err, response) => {
      if (err) return reject(err);
      resolve((response.QueryResponse.Invoice || []));
    });
  });
}

/**
 * Charge a customer (record a payment).
 * @param {number} merchantId
 * @param {object} paymentPayload  // per QuickBooks Payments API spec
 * @returns {Promise<object>}
 */
async function createPayment(merchantId, paymentPayload) {
  const qbo = await initQBO(merchantId);
  return new Promise((resolve, reject) => {
    qbo.createPayment(paymentPayload, (err, payment) => {
      if (err) return reject(err);
      resolve(payment);
    });
  });
}

/**
 * List past payments, optionally filtering by invoice.
 * @param {number} merchantId
 * @param {string|null} invoiceId
 * @returns {Promise<object[]>}
 */
async function listPayments(merchantId, invoiceId = null) {
  const qbo = await initQBO(merchantId);
  const sql = invoiceId
    ? `SELECT * FROM Payment WHERE InvoiceRef='${invoiceId}' ORDER BY TxnDate DESC`
    : `SELECT * FROM Payment ORDER BY TxnDate DESC`;

  return new Promise((resolve, reject) => {
    qbo.query(sql, (err, response) => {
      if (err) return reject(err);
      resolve((response.QueryResponse.Payment || []));
    });
  });
}

module.exports = {
  initQBO,
  createInvoice,
  listInvoices,
  createPayment,
  listPayments
};
