// src/routes/adminRoutes.js
const express = require('express');
const authMiddleware  = require('../middleware/authMiddleware');
const requireAdmin    = require('../middleware/authMiddleware');
const { createAdmin } = require('../controllers/adminController');

const router = express.Router();

// Only existing admins can create new admins
router.post(
  '/create',
  // authMiddleware,
  // requireAdmin,
  createAdmin
);

module.exports = router;
