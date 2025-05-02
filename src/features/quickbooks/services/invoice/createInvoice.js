// src/features/quickbooks/services/invoice/createInvoice.js
const buildInvoicePayload        = require('./buildInvoicePayload');
const createInvoiceInQuickBooks = require('./createInvoiceInQuickBooks');
const persistInvoiceToSupabase   = require('./persistInvoiceToSupabase');
const supabase                  = require('../../../../config/supabase');

async function createInvoiceService({
  internalCustomerId,
  lineItems,
  dueDate,
  memo
}) {
  if (!internalCustomerId) {
    throw new Error('internalCustomerId is required');
  }

  // 1) Look up the QBO customer ID (text) by your internal UUID
  const { data: cust, error: custErr } = await supabase
    .from('customers')
    .select('qbo_customer_id')
    .eq('id', internalCustomerId)
    .single();
  if (custErr || !cust?.qbo_customer_id) {
    throw new Error(`No QuickBooks customer found for ${internalCustomerId}`);
  }
  const qboCustomerId = cust.qbo_customer_id;

  // 2) Build the payload using the QBO ID
  const payload = buildInvoicePayload(qboCustomerId, {
    lineItems,
    dueDate,
    memo
  });

  // 3) Send it to QuickBooks
  const invoice = await createInvoiceInQuickBooks(payload);

  // 4) Persist the result, storing your UUID in `customer_id`
  await persistInvoiceToSupabase(internalCustomerId, invoice);

  return invoice;
}

module.exports = createInvoiceService;
