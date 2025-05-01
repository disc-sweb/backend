// src/features/quickbooks/routes/customersRoutes.js
const express = require('express');
const { createCustomer } = require('../controller/quickbooksController');
const router = express.Router();

// POST /quickbooks/customers
router.post('/', createCustomer);

module.exports = router;
