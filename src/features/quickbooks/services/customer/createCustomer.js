const buildCustomerPayload = require('./buildCustomerPayload');
const upsertInternalCustomer = require('./upsertInternalCustomer');
const createCustomerInQuickBooks = require('./createCustomerInQuickBooks');
const saveQboCustomerId = require('./saveQboCustomerId');

async function createCustomer({ internalCustomerId, firstName, lastName, email }) {
  if (!internalCustomerId || !firstName || !lastName || !email) {
    throw new Error('Missing required fields to create customer.');
  }

  const { fullName, payload } = buildCustomerPayload(firstName, lastName, email);

  // 1) Upsert the internal customer record
  await upsertInternalCustomer(internalCustomerId, fullName, email);

  // 2) Create the customer in QuickBooks 
  const qboCustomer = await createCustomerInQuickBooks(payload);

  // 3) Save the QuickBooks customer ID back to your internal record
  await saveQboCustomerId(internalCustomerId, qboCustomer.Id);

  return {
    internalCustomerId,
    qboCustomerId: qboCustomer.Id,
    fullName
  };
}

module.exports = createCustomer;
