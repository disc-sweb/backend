// src/features/quickbooks/routes/quickbooksRoutes.js
const express = require('express');
const {
  connectQuickBooks,
  handleQuickBooksCallback
} = require('../controller/quickbooksController');

const router = express.Router();

// (No authMiddleware or requireAdmin here!)
router.get('/auth', connectQuickBooks);
router.get('/callback', handleQuickBooksCallback);

module.exports = router;
