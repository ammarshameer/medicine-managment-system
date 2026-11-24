const express = require('express');
const { authenticateToken, requireTenant } = require('../middleware/auth');
const { createPaymentIntent, getPaymentMethods } = require('../utils/payments');

const router = express.Router();

// Public: the catalog of supported payment methods can be shown before login.
// GET /api/payments/methods?country=USA|UAE|PK
router.get('/methods', getPaymentMethods);

// Authenticated and tenant scoped.
// POST /api/payments/create-intent
router.post('/create-intent', authenticateToken, requireTenant, createPaymentIntent);

module.exports = router;
