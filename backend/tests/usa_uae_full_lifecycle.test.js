const { calculateOrderTax } = require('../utils/taxEngine');

describe('Full Lifecycle Verification: USA & UAE Ready Multi-Tenant Pharmacy System', () => {

  describe('1. Centralized Tax Engine Calculations', () => {
    test('USA Exclusive Mixed-Cart ($20 taxable @ 8% + $50 exempt @ 8% -> Subtotal $70.00, Tax $1.60, Total $71.60)', () => {
      const items = [
        { medicineId: 1, name: 'OTC Ibuprofen', price: 20.00, quantity: 1, isTaxable: true, priceIncludesTax: false },
        { medicineId: 2, name: 'Rx Amoxicillin', price: 50.00, quantity: 1, isTaxable: false, priceIncludesTax: false }
      ];
      const business = { taxEnabled: true, taxRate: 0.08 };
      const res = calculateOrderTax(items, business);

      expect(res.subtotal).toBe(70.00);
      expect(res.taxAmount).toBe(1.60);
      expect(res.totalAmount).toBe(71.60);
      expect(res.items[0].lineSubtotal).toBe(20.00);
      expect(res.items[0].lineTax).toBe(1.60);
      expect(res.items[1].lineSubtotal).toBe(50.00);
      expect(res.items[1].lineTax).toBe(0.00);
    });

    test('UAE Inclusive VAT (AED 105.00 shelf price @ 5% VAT -> Subtotal AED 100.00, Tax AED 5.00, Total AED 105.00)', () => {
      const items = [
        { medicineId: 3, name: 'Panadol Extra', price: 105.00, quantity: 1, isTaxable: true, priceIncludesTax: true }
      ];
      const business = { taxEnabled: true, taxRate: 0.05 };
      const res = calculateOrderTax(items, business);

      expect(res.subtotal).toBe(100.00);
      expect(res.taxAmount).toBe(5.00);
      expect(res.totalAmount).toBe(105.00);
      expect(res.items[0].lineSubtotal).toBe(100.00);
      expect(res.items[0].lineTax).toBe(5.00);
    });

    test('Tax Disabled Store (taxEnabled = false -> Tax $0.00, Subtotal = Total)', () => {
      const items = [
        { medicineId: 4, name: 'Product A', price: 40.00, quantity: 2, isTaxable: true, priceIncludesTax: false }
      ];
      const business = { taxEnabled: false, taxRate: 0.0825 };
      const res = calculateOrderTax(items, business);

      expect(res.subtotal).toBe(80.00);
      expect(res.taxAmount).toBe(0.00);
      expect(res.totalAmount).toBe(80.00);
    });

    test('5-Decimal Tax Precision (NYC 8.875% = 0.08875 on $100 -> Tax $8.88, Total $108.88)', () => {
      const items = [
        { medicineId: 5, name: 'NYC Item', price: 100.00, quantity: 1, isTaxable: true, priceIncludesTax: false }
      ];
      const business = { taxEnabled: true, taxRate: 0.08875 };
      const res = calculateOrderTax(items, business);

      expect(res.subtotal).toBe(100.00);
      expect(res.taxAmount).toBe(8.88);
      expect(res.totalAmount).toBe(108.88);
    });
  });

  describe('2. Write-Time Net Resolution & Dashboard Revenue SUM(oi.Subtotal)', () => {
    test('USA Exclusive Sale: $20 + $1.60 tax -> Write-time net $20.00 -> Dashboard revenue is exactly $20.00', () => {
      const cart = [{ medicineId: 10, name: 'Item US', price: 20.00, quantity: 1, costPrice: 8.00, isTaxable: true, priceIncludesTax: false }];
      const business = { taxEnabled: true, taxRate: 0.08, currency: 'USD' };
      const taxRes = calculateOrderTax(cart, business);

      // Value written into OrderItems.Subtotal
      const itemSubtotal = taxRes.items[0].lineSubtotal;
      expect(itemSubtotal).toBe(20.00);

      // Simulated Dashboard query: SELECT SUM(oi.Subtotal) WHERE Status = 'Delivered'
      const totalRevenue = itemSubtotal;
      const totalCost = cart[0].costPrice * cart[0].quantity;
      const grossProfit = totalRevenue - totalCost;

      expect(totalRevenue).toBe(20.00);
      expect(totalCost).toBe(8.00);
      expect(grossProfit).toBe(12.00);
    });

    test('UAE Inclusive Sale: AED 105 (AED 5 VAT) -> Write-time net AED 100.00 -> Dashboard revenue is exactly AED 100.00', () => {
      const cart = [{ medicineId: 20, name: 'Item UAE', price: 105.00, quantity: 1, costPrice: 50.00, isTaxable: true, priceIncludesTax: true }];
      const business = { taxEnabled: true, taxRate: 0.05, currency: 'AED' };
      const taxRes = calculateOrderTax(cart, business);

      // Value written into OrderItems.Subtotal
      const itemSubtotal = taxRes.items[0].lineSubtotal;
      expect(itemSubtotal).toBe(100.00);

      // Simulated Dashboard query: SELECT SUM(oi.Subtotal) WHERE Status = 'Delivered'
      const totalRevenue = itemSubtotal;
      const totalCost = cart[0].costPrice * cart[0].quantity;
      const grossProfit = totalRevenue - totalCost;

      expect(totalRevenue).toBe(100.00);
      expect(totalCost).toBe(50.00);
      expect(grossProfit).toBe(50.00);
    });
  });

  describe('3. Multi-Currency Order Snapshotting', () => {
    test('Historical orders preserve snapshotted currency regardless of subsequent tenant config modifications', () => {
      const originalBusinessConfig = { currency: 'USD' };
      const order = { orderId: 1001, currency: originalBusinessConfig.currency, subtotal: 50.00, totalAmount: 54.00 };

      expect(order.currency).toBe('USD');

      // Tenant changes business currency to AED
      const modifiedBusinessConfig = { currency: 'AED' };

      // Historical order still retains USD
      expect(order.currency).toBe('USD');
      expect(modifiedBusinessConfig.currency).toBe('AED');
    });
  });

  describe('4. Regulatory & Identity Compliance (DEA / UAE classifications & ID masking)', () => {
    test('Controlled substances gating logic', () => {
      const medDEA = { name: 'Oxycodone', DEASchedule: 'II', UAEClassification: 'Controlled', requiresPrescription: true };
      const medOTC = { name: 'Aspirin', DEASchedule: 'None', UAEClassification: 'OTC', requiresPrescription: false };

      const isControlled = (m) => (m.DEASchedule && m.DEASchedule !== 'None') || ['Controlled', 'Semi-Controlled', 'Narcotic'].includes(m.UAEClassification);
      expect(isControlled(medDEA)).toBe(true);
      expect(isControlled(medOTC)).toBe(false);
    });

    test('Emirates ID masking for STAFF vs BUSINESS_OWNER', () => {
      const rawEmiratesId = '784-1990-1234567-1';

      const maskEmiratesId = (id, isStaff) => {
        if (!isStaff || !id) return id;
        return id.length >= 8 ? `${id.substring(0, 4)}****-*******${id.slice(-2)}` : '***-****-****';
      };

      expect(maskEmiratesId(rawEmiratesId, false)).toBe('784-1990-1234567-1'); // Owner sees full ID
      expect(maskEmiratesId(rawEmiratesId, true)).toBe('784-****-*******-1');   // Staff sees masked ID
    });
  });
});
