const { calculateOrderTax } = require('../utils/taxEngine');

describe('MMS Centralized Tax Engine Unit Tests', () => {
  test('1. USA Tax Exclusive Mixed-Cart: $20 taxable @ 8% + $50 exempt @ 8% -> Subtotal $70.00, Tax $1.60, Total $71.60', () => {
    const items = [
      {
        medicineId: 1,
        name: 'OTC Ibuprofen',
        price: 20.00,
        quantity: 1,
        isTaxable: true,
        priceIncludesTax: false
      },
      {
        medicineId: 2,
        name: 'Rx Amoxicillin',
        price: 50.00,
        quantity: 1,
        isTaxable: false,
        priceIncludesTax: false
      }
    ];

    const business = {
      taxEnabled: true,
      taxRate: 0.08
    };

    const result = calculateOrderTax(items, business);

    // Verify per-item calculations
    expect(result.items[0].lineSubtotal).toBe(20.00); // Net revenue for line 1
    expect(result.items[0].lineTax).toBe(1.60);
    expect(result.items[0].lineTotal).toBe(21.60);

    expect(result.items[1].lineSubtotal).toBe(50.00); // Net revenue for line 2
    expect(result.items[1].lineTax).toBe(0.00);
    expect(result.items[1].lineTotal).toBe(50.00);

    // Verify order totals
    expect(result.subtotal).toBe(70.00);
    expect(result.taxAmount).toBe(1.60);
    expect(result.totalAmount).toBe(71.60);

    console.log('USA Mixed-Cart Result:', {
      item1_net: result.items[0].lineSubtotal,
      item1_tax: result.items[0].lineTax,
      item2_net: result.items[1].lineSubtotal,
      item2_tax: result.items[1].lineTax,
      order_subtotal: result.subtotal,
      order_tax: result.taxAmount,
      order_total: result.totalAmount
    });
  });

  test('2. UAE Tax Inclusive: AED 105.00 shelf price @ 5% VAT -> Subtotal AED 100.00, Tax AED 5.00, Total AED 105.00', () => {
    const items = [
      {
        medicineId: 3,
        name: 'UAE Paracetamol 500mg',
        price: 105.00,
        quantity: 1,
        isTaxable: true,
        priceIncludesTax: true
      }
    ];

    const business = {
      taxEnabled: true,
      taxRate: 0.05
    };

    const result = calculateOrderTax(items, business);

    expect(result.items[0].lineSubtotal).toBe(100.00); // Net revenue
    expect(result.items[0].lineTax).toBe(5.00);        // VAT backed out
    expect(result.items[0].lineTotal).toBe(105.00);

    expect(result.subtotal).toBe(100.00);
    expect(result.taxAmount).toBe(5.00);
    expect(result.totalAmount).toBe(105.00);

    console.log('UAE Tax-Inclusive Result:', {
      item_net: result.items[0].lineSubtotal,
      item_vat: result.items[0].lineTax,
      order_subtotal: result.subtotal,
      order_vat: result.taxAmount,
      order_total: result.totalAmount
    });
  });

  test('3. Tax Disabled Store: TaxEnabled = false -> Subtotal $100.00, Tax $0.00, Total $100.00', () => {
    const items = [
      {
        medicineId: 4,
        name: 'Generic Medicine',
        price: 50.00,
        quantity: 2,
        isTaxable: true,
        priceIncludesTax: false
      }
    ];

    const business = {
      taxEnabled: false,
      taxRate: 0.0825
    };

    const result = calculateOrderTax(items, business);

    expect(result.items[0].lineSubtotal).toBe(100.00);
    expect(result.items[0].lineTax).toBe(0.00);
    expect(result.subtotal).toBe(100.00);
    expect(result.taxAmount).toBe(0.00);
    expect(result.totalAmount).toBe(100.00);

    console.log('Tax-Disabled Result:', result.totalAmount);
  });

  test('4. 5-Decimal Tax Precision (NYC 8.875% = 0.08875): $100 -> Tax $8.88, Total $108.88', () => {
    const items = [
      {
        medicineId: 5,
        name: 'NYC Taxable Item',
        price: 100.00,
        quantity: 1,
        isTaxable: true,
        priceIncludesTax: false
      }
    ];

    const business = {
      taxEnabled: true,
      taxRate: 0.08875
    };

    const result = calculateOrderTax(items, business);

    expect(result.items[0].lineSubtotal).toBe(100.00);
    expect(result.items[0].lineTax).toBe(8.88);
    expect(result.subtotal).toBe(100.00);
    expect(result.taxAmount).toBe(8.88);
    expect(result.totalAmount).toBe(108.88);

    console.log('NYC 8.875% Tax Result:', { tax: result.taxAmount, total: result.totalAmount });
  });
});
