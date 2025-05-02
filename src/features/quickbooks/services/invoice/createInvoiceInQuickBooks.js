const { qboRequest } = require('../../utils/qboClient');

async function createInvoiceInQuickBooks(payload) {
  const { Invoice } = await qboRequest(
    '/invoice?minorversion=65',
    {
      method: 'POST',
      body: JSON.stringify(payload)
    }
  );
  return Invoice;
}

module.exports = createInvoiceInQuickBooks;
