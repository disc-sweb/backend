// src/routes/debugRoutes.js
const express = require('express');
const  authMiddleware  = require('../../../middleware/authMiddleware');
const router = express.Router();

router.get('/me', authMiddleware, (req, res) => {
  // should print your Supabase user object
  res.json({ youAre: req.user });
});

module.exports = router;
 