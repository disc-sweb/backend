// src/features/quickbooks/routes/quickbooksRoutes.js
const express = require('express');
const {
  connectQuickBooks,
  handleQuickBooksCallback,
  createInvoice
} = require('../controller/quickbooksController');
const  authMiddleware  = require('../../../middleware/authMiddleware');
const adminMiddleware  = require('../../../middleware/adminMiddleware');

// --- TEMPORARY “mock user” middleware ---------------
function mockUser(req, res, next) {
  // hard-code whatever user shape you need:
  req.user = { id: 1, user_metadata: { role: 'admin' } };
  next();
}
// mount the mock BEFORE any real handler


const router = express.Router();
router.use(mockUser);

// (No authMiddleware or requireAdmin here!)
// new invoice route
router.post(
  '/invoice',
  createInvoice
);
router.get('/auth',  connectQuickBooks);
router.get('/callback',   handleQuickBooksCallback);

module.exports = router;
