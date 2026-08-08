const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { ensureAuth } = require('../middleware/auth');

router.get('/dashboard', ensureAuth, async (req, res) => {
  try {
    const [[{ productCount }]] = await pool.query('SELECT COUNT(*) AS productCount FROM products');
    const [[{ lowStockCount }]] = await pool.query(
      'SELECT COUNT(*) AS lowStockCount FROM products WHERE quantity <= reorder_level'
    );
    const [[{ employeeCount }]] = await pool.query(
      "SELECT COUNT(*) AS employeeCount FROM employees WHERE status = 'active'"
    );
    const [[{ pendingSales }]] = await pool.query(
      "SELECT COUNT(*) AS pendingSales FROM sales_orders WHERE status = 'pending'"
    );
    const [[{ pendingPOs }]] = await pool.query(
      "SELECT COUNT(*) AS pendingPOs FROM purchase_orders WHERE status = 'pending'"
    );
    const [[{ revenue }]] = await pool.query(
      "SELECT COALESCE(SUM(total),0) AS revenue FROM sales_orders WHERE status = 'completed'"
    );
    const [lowStockItems] = await pool.query(
      'SELECT TOP 5 name, sku, quantity, reorder_level FROM products WHERE quantity <= reorder_level'
    );
    const [recentSales] = await pool.query(
      `SELECT TOP 5 so.id, c.name AS customer_name, so.total, so.status, so.order_date
       FROM sales_orders so JOIN customers c ON so.customer_id = c.id
       ORDER BY so.created_at DESC`
    );

    res.render('dashboard', {
      title: 'Dashboard',
      stats: { productCount, lowStockCount, employeeCount, pendingSales, pendingPOs, revenue },
      lowStockItems,
      recentSales,
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Could not load dashboard.');
    res.render('dashboard', {
      title: 'Dashboard',
      stats: {},
      lowStockItems: [],
      recentSales: [],
    });
  }
});

module.exports = router;
