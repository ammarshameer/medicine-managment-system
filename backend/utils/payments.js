const Stripe = require('stripe');
const { query } = require('../config/database');
const { isPlatformAdmin, resolveBusinessId } = require('../middleware/auth');

function stripeUnavailable(res) {
  res.status(503).json({
    success: false,
    message: 'Stripe payments are not configured. Set STRIPE_SECRET_KEY on the server.'
  });
}

function normalizeCountry(country) {
  return String(country || '').trim().toUpperCase();
}

/**
 * POST /api/payments/create-intent (also /api/orders/:id/pay)
 * Creates a real Stripe PaymentIntent and records a pending PaymentTransactions
 * row. Never reports success unless Stripe actually returned a client secret.
 */
async function createPaymentIntent(req, res) {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey || /placeholder|change_me|your_/i.test(secretKey)) {
      return stripeUnavailable(res);
    }

    const orderId = parseInt(req.params.id || req.body.orderId, 10);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({ success: false, message: 'A valid orderId is required' });
    }

    const orders = await query(
      'SELECT OrderId, BusinessId, UserId, Status, TotalAmount, Currency FROM Orders WHERE OrderId = ?',
      [orderId]
    );
    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const order = orders[0];
    const scopedBusinessId = resolveBusinessId(req);
    const mustMatchBusiness = !isPlatformAdmin(req.user) || Boolean(scopedBusinessId);
    if (mustMatchBusiness && Number(order.BusinessId) !== Number(scopedBusinessId)) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    if (req.user.Role === 'CUSTOMER' && Number(order.UserId) !== Number(req.user.UserId)) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    if (order.Status === 'Cancelled') {
      return res.status(400).json({ success: false, message: 'Cannot pay for a cancelled order' });
    }

    const amount = Math.round((parseFloat(order.TotalAmount) || 0) * 100);
    if (amount <= 0) {
      return res.status(400).json({ success: false, message: 'Order has no payable amount' });
    }

    const currency = (order.Currency || 'USD').toLowerCase();
    const stripe = new Stripe(secretKey);
    const intent = await stripe.paymentIntents.create({
      amount,
      currency,
      metadata: {
        orderId: String(orderId),
        businessId: String(order.BusinessId)
      }
    });

    await query(
      `INSERT INTO PaymentTransactions
       (BusinessId, OrderId, Provider, ProviderReference, Amount, Currency, Status, PaymentMethod)
       VALUES (?, ?, 'stripe', ?, ?, ?, 'Pending', 'Card')`,
      [order.BusinessId, orderId, intent.id, parseFloat(order.TotalAmount), order.Currency || 'USD']
    );

    return res.json({
      success: true,
      message: 'Payment intent created',
      clientSecret: intent.client_secret,
      data: {
        clientSecret: intent.client_secret,
        paymentIntentId: intent.id,
        orderId,
        amount,
        currency: order.Currency || 'USD',
        status: intent.status
      }
    });
  } catch (error) {
    console.error('Create payment intent error:', error);
    return res.status(502).json({
      success: false,
      message: error.message || 'Unable to create Stripe payment intent'
    });
  }
}

/**
 * GET /api/payments/methods?country=USA|UAE|PK
 */
async function getPaymentMethods(req, res) {
  const country = normalizeCountry(req.query.country);
  let methods;

  if (['USA', 'US', 'UNITED STATES', 'UNITED STATES OF AMERICA'].includes(country)) {
    methods = ['Cash', 'Credit Card', 'Debit Card', 'Insurance Copay'];
  } else if (['UAE', 'AE', 'UNITED ARAB EMIRATES'].includes(country)) {
    methods = ['Cash', 'Credit Card', 'Debit Card', 'Bank Transfer'];
  } else if (['PK', 'PAKISTAN', 'PKR'].includes(country)) {
    methods = ['Cash', 'Card', 'JazzCash', 'Bank Transfer'];
  } else {
    methods = ['Cash', 'Card'];
  }

  return res.json({
    success: true,
    data: { country: country || null, methods }
  });
}

module.exports = { createPaymentIntent, getPaymentMethods, stripeUnavailable, normalizeCountry };
