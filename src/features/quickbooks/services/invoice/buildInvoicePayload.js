function buildInvoicePayload(customerId, { lineItems, dueDate, memo }) {
  return {
    CustomerRef: { value: customerId },
    Line: lineItems.map(item => ({
      DetailType: item.DetailType,
      Amount:     item.Amount,
      Description:item.Description,
      SalesItemLineDetail: {
        ItemRef:   item.SalesItemLineDetail.ItemRef,
        UnitPrice: item.SalesItemLineDetail.UnitPrice ?? item.Amount,
        Qty:       item.SalesItemLineDetail.Qty
      }
    })),
    DueDate:     dueDate,
    PrivateNote: memo
  };
}


module.exports = buildInvoicePayload;
