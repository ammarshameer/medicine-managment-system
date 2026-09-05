/**
 * Centralized Tax Calculation Engine for Medicine Management System (MMS)
 * 
 * Single source of truth for:
 * - Master business tax toggle (TaxEnabled)
 * - Exemption handling (IsTaxable: true/false)
 * - UAE-style tax-inclusive pricing (PriceIncludesTax: true)
 * - US-style tax-exclusive pricing (PriceIncludesTax: false)
 * - 5-decimal tax rate precision support
 * 
 * @param {Array} items - [{ medicineId, name, price, quantity, isTaxable, priceIncludesTax }]
 * @param {Object} business - { taxEnabled, taxRate }
 * @returns {Object} { items: [...with lineSubtotal (net), lineTax, lineTotal], subtotal, taxRate, taxAmount, totalAmount }
 */
function calculateOrderTax(items = [], business = {}) {
  const taxEnabled = Boolean(
    business.taxEnabled !== false &&
    business.TaxEnabled !== false &&
    business.taxEnabled !== 0 &&
    business.TaxEnabled !== 0
  );

  const rawTaxRate = business.taxRate !== undefined ? business.taxRate : business.TaxRate;
  const taxRate = taxEnabled ? (parseFloat(rawTaxRate) || 0) : 0;

  let orderSubtotal = 0;
  let orderTaxAmount = 0;
  const processedItems = [];

  for (const item of items) {
    const qty = parseInt(item.quantity, 10) || 1;
    const price = parseFloat(item.price) || 0;
    const isTaxable = Boolean(
      item.isTaxable !== false &&
      item.IsTaxable !== false &&
      item.isTaxable !== 0 &&
      item.IsTaxable !== 0
    );
    const priceIncludesTax = Boolean(
      item.priceIncludesTax ||
      item.PriceIncludesTax
    );

    const rawLineTotal = Math.round(price * qty * 100) / 100;
    let lineTax = 0;
    let lineSubtotal = rawLineTotal;

    if (!taxEnabled || !isTaxable || taxRate <= 0) {
      lineTax = 0;
      lineSubtotal = rawLineTotal;
    } else if (priceIncludesTax) {
      // UAE VAT Style: tax portion baked inside price
      // taxPortion = rawLineTotal - (rawLineTotal / (1 + taxRate))
      lineTax = Math.round((rawLineTotal - (rawLineTotal / (1 + taxRate))) * 100) / 100;
      lineSubtotal = Math.round((rawLineTotal - lineTax) * 100) / 100;
    } else {
      // US Sales Tax Style: tax added on top of shelf price
      // lineTax = rawLineTotal * taxRate
      lineTax = Math.round(rawLineTotal * taxRate * 100) / 100;
      lineSubtotal = rawLineTotal;
    }

    orderTaxAmount += lineTax;
    orderSubtotal += lineSubtotal;

    processedItems.push({
      ...item,
      quantity: qty,
      price: price,
      isTaxable,
      priceIncludesTax,
      lineSubtotal: Math.round(lineSubtotal * 100) / 100, // Net tax-excluded amount stored in OrderItems.Subtotal
      lineTax: Math.round(lineTax * 100) / 100,           // Tax amount stored in OrderItems.TaxAmount
      lineTotal: Math.round((lineSubtotal + lineTax) * 100) / 100
    });
  }

  orderSubtotal = Math.round(orderSubtotal * 100) / 100;
  orderTaxAmount = Math.round(orderTaxAmount * 100) / 100;
  const totalAmount = Math.round((orderSubtotal + orderTaxAmount) * 100) / 100;

  return {
    items: processedItems,
    subtotal: orderSubtotal,
    taxRate,
    taxAmount: orderTaxAmount,
    totalAmount
  };
}

module.exports = { calculateOrderTax };
