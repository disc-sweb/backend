const { qboRequest } = require('../../../utils/qboClient');

async function createCustomerInQuickBooks(qboPayload) {
  const { Customer } = await qboRequest(
    '/customer?minorversion=65',
    {
      method: 'POST',
      body: JSON.stringify(qboPayload)
    }
  );

  return Customer;
}

module.exports = createCustomerInQuickBooks;
