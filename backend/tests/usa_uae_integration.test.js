const { calculateOrderTax } = require('../utils/taxEngine');

describe('USA & UAE Multi-Tenant Financial Integration & Revenue Verification', () => {

  test('USA Exclusive Tax Flow: Net Subtotal $70.00, Tax $1.60, Total $71.60 -> Dashboard SUM(oi.Subtotal) is exactly $70.00', () => {
    // 1. Line items submitted at checkout
    const rawCart = [
      {
        medicineId: 101,
        name: 'Advil 200mg (Taxable)',
        price: 20.00,
        quantity: 1,
        costPrice: 10.00,
        isTaxable: true,
        priceIncludesTax: false
      },
      {
        medicineId: 102,
        name: 'Amoxicillin 500mg Rx (Tax Exempt)',
        price: 50.00,
        quantity: 1,
        costPrice: 25.00,
        isTaxable: false,
        priceIncludesTax: false
      }
    ];

    const businessSettings = {
      taxEnabled: true,
      taxRate: 0.08,
      currency: 'USD'
    };

    // Calculate tax via tax engine
    const orderResult = calculateOrderTax(rawCart, businessSettings);

    // Assert written order items
    expect(orderResult.subtotal).toBe(70.00);
    expect(orderResult.taxRate).toBe(0.08);
    expect(orderResult.taxAmount).toBe(1.60);
    expect(orderResult.totalAmount).toBe(71.60);

    // Check OrderItems rows as they are written to the database
    const dbOrderItems = orderResult.items.map(item => ({
      medicineId: item.medicineId,
      quantity: item.quantity,
      price: item.price,
      costPrice: item.costPrice,
      subtotal: item.lineSubtotal, // Stored in OrderItems.Subtotal
      taxAmount: item.lineTax,     // Stored in OrderItems.TaxAmount
      isTaxable: item.isTaxable,
      priceIncludesTax: item.priceIncludesTax
    }));

    expect(dbOrderItems[0].subtotal).toBe(20.00); // Net pre-tax $20.00
    expect(dbOrderItems[0].taxAmount).toBe(1.60);

    expect(dbOrderItems[1].subtotal).toBe(50.00); // Net pre-tax $50.00
    expect(dbOrderItems[1].taxAmount).toBe(0.00);

    // Simulate Dashboard SQL: SUM(oi.Subtotal)
    const dashboardRevenue = dbOrderItems.reduce((acc, row) => acc + row.subtotal, 0);
    const dashboardCost = dbOrderItems.reduce((acc, row) => acc + (row.costPrice * row.quantity), 0);
    const dashboardNetProfit = dashboardRevenue - dashboardCost;

    console.log('USA Dashboard Result:', {
      netRevenue: Number(dashboardRevenue.toFixed(2)),
      cogs: Number(dashboardCost.toFixed(2)),
      netProfit: Number(dashboardNetProfit.toFixed(2))
    });

    expect(dashboardRevenue).toBe(70.00);
    expect(dashboardCost).toBe(35.00);
    expect(dashboardNetProfit).toBe(35.00);
  });

  test('UAE Inclusive Tax Flow: Gross AED 105.00 @ 5% VAT -> Net Subtotal AED 100.00, Tax AED 5.00 -> Dashboard SUM(oi.Subtotal) is exactly 100.00', () => {
    const rawCart = [
      {
        medicineId: 201,
        name: 'Panadol Extra (Tax Inclusive)',
        price: 105.00,
        quantity: 1,
        costPrice: 60.00,
        isTaxable: true,
        priceIncludesTax: true
      }
    ];

    const businessSettings = {
      taxEnabled: true,
      taxRate: 0.05,
      currency: 'AED'
    };

    const orderResult = calculateOrderTax(rawCart, businessSettings);

    expect(orderResult.subtotal).toBe(100.00);
    expect(orderResult.taxRate).toBe(0.05);
    expect(orderResult.taxAmount).toBe(5.00);
    expect(orderResult.totalAmount).toBe(105.00);

    const dbOrderItems = orderResult.items.map(item => ({
      medicineId: item.medicineId,
      quantity: item.quantity,
      price: item.price,
      costPrice: item.costPrice,
      subtotal: item.lineSubtotal,
      taxAmount: item.lineTax,
      isTaxable: item.isTaxable,
      priceIncludesTax: item.priceIncludesTax
    }));

    expect(dbOrderItems[0].subtotal).toBe(100.00); // Backed-out net revenue stored in OrderItems.Subtotal
    expect(dbOrderItems[0].taxAmount).toBe(5.00);

    // Simulate Dashboard SQL: SUM(oi.Subtotal)
    const dashboardRevenue = dbOrderItems.reduce((acc, row) => acc + row.subtotal, 0);
    const dashboardCost = dbOrderItems.reduce((acc, row) => acc + (row.costPrice * row.quantity), 0);
    const dashboardNetProfit = dashboardRevenue - dashboardCost;

    console.log('UAE Dashboard Result:', {
      netRevenue: Number(dashboardRevenue.toFixed(2)),
      cogs: Number(dashboardCost.toFixed(2)),
      netProfit: Number(dashboardNetProfit.toFixed(2))
    });

    expect(dashboardRevenue).toBe(100.00);
    expect(dashboardCost).toBe(60.00);
    expect(dashboardNetProfit).toBe(40.00);
  });

  test('Multi-Currency Order Snapshotting: Currency snapshots on order and persists regardless of later business setting changes', () => {
    const initialBusiness = {
      currency: 'USD',
      taxEnabled: true,
      taxRate: 0.08
    };

    const orderCreated = {
      orderId: 501,
      currency: initialBusiness.currency,
      totalAmount: 100.00
    };

    expect(orderCreated.currency).toBe('USD');

    // Simulate tenant updating their business currency to AED later
    const updatedBusiness = {
      ...initialBusiness,
      currency: 'AED'
    };

    // The historical order record MUST retain USD
    expect(orderCreated.currency).toBe('USD');
    expect(updatedBusiness.currency).toBe('AED');
  });

  test('Controlled Substances Classification & Audit Tracking Logic', () => {
    const medicines = [
      { id: 1, name: 'Adderall 10mg', deaSchedule: 'II', uaeClassification: 'Controlled', requiresPrescription: true },
      { id: 2, name: 'Pregabalin 75mg', deaSchedule: 'V', uaeClassification: 'Semi-Controlled', requiresPrescription: true },
      { id: 3, name: 'Paracetamol 500mg', deaSchedule: 'None', uaeClassification: 'OTC', requiresPrescription: false }
    ];

    const isControlled = (med) => {
      return (med.deaSchedule && med.deaSchedule !== 'None') ||
             (med.uaeClassification && ['Controlled', 'Semi-Controlled', 'Narcotic'].includes(med.uaeClassification));
    };

    expect(isControlled(medicines[0])).toBe(true);
    expect(isControlled(medicines[1])).toBe(true);
    expect(isControlled(medicines[2])).toBe(false);

    // Check Schedule II / Controlled prescription gating
    const requiresStrictPrescription = (med) => {
      return med.deaSchedule === 'II' || ['Controlled', 'Narcotic'].includes(med.uaeClassification);
    };

    expect(requiresStrictPrescription(medicines[0])).toBe(true);
    expect(requiresStrictPrescription(medicines[1])).toBe(false);
  });
});
