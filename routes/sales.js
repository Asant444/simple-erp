const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { ensureAuth } = require('../middleware/auth');

// ---------- CUSTOMERS ----------
router.get('/customers', ensureAuth, async (req, res) => {
  const [customers] = await pool.query('SELECT * FROM customers ORDER BY name');
  res.render('sales/customers', { title: 'Customers', customers });
});

router.post('/customers', ensureAuth, async (req, res) => {
  const { name, email, phone, address } = req.body;
  await pool.query(
    'INSERT INTO customers (name, email, phone, address) VALUES (?, ?, ?, ?)',
    [name, email, phone, address]
  );
  req.flash('success', 'Customer added.');
  res.redirect('/customers');
});

router.delete('/customers/:id', ensureAuth, async (req, res) => {
  await pool.query('DELETE FROM customers WHERE id = ?', [req.params.id]);
  req.flash('success', 'Customer removed.');
  res.redirect('/customers');
});

// ---------- SALES ORDERS ----------
router.get('/sales-orders', ensureAuth, async (req, res) => {
  const [orders] = await pool.query(
    `SELECT so.*, c.name AS customer_name FROM sales_orders so
     JOIN customers c ON so.customer_id = c.id ORDER BY so.created_at DESC`
  );
  res.render('sales/orders', { title: 'Sales Orders', orders });
});

router.get('/sales-orders/new', ensureAuth, async (req, res) => {
  const [customers] = await pool.query('SELECT * FROM customers ORDER BY name');
  const [products] = await pool.query('SELECT * FROM products ORDER BY name');
  res.render('sales/order_form', { title: 'New Sales Order', customers, products });
});

// Create SO with line items. Stock is deducted immediately (simple model).
router.post('/sales-orders', ensureAuth, async (req, res) => {
  const { customer_id, order_date, product_id, quantity, unit_price } = req.body;
  const productIds = [].concat(product_id || []);
  const quantities = [].concat(quantity || []);
  const prices = [].concat(unit_price || []);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Validate stock availability first
    for (let i = 0; i < productIds.length; i++) {
      if (!productIds[i]) continue;
      const [[product]] = await conn.query('SELECT quantity, name FROM products WHERE id = ?', [productIds[i]]);
      if (!product || product.quantity < parseInt(quantities[i], 10)) {
        throw new Error(`Insufficient stock for ${product ? product.name : 'product'}`);
      }
    }

    let total = 0;
    for (let i = 0; i < productIds.length; i++) {
      total += parseFloat(prices[i]) * parseInt(quantities[i], 10);
    }

    const [result] = await conn.query(
      `INSERT INTO sales_orders (customer_id, order_date, status, total) VALUES (?, ?, 'completed', ?)`,
      [customer_id, order_date, total]
    );
    const soId = result.insertId;

    for (let i = 0; i < productIds.length; i++) {
      if (!productIds[i]) continue;
      await conn.query(
        'INSERT INTO sales_order_items (so_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)',
        [soId, productIds[i], quantities[i], prices[i]]
      );
      await conn.query('UPDATE products SET quantity = quantity - ? WHERE id = ?', [quantities[i], productIds[i]]);
      await conn.query(
        `INSERT INTO stock_movements (product_id, change_qty, reason, reference) VALUES (?, ?, 'Sale', ?)`,
        [productIds[i], -quantities[i], `SO-${soId}`]
      );
    }

    // Accounting entry: Debit Cash, Credit Sales Revenue
    const [[cashAcct]] = await conn.query("SELECT id FROM accounts WHERE name = 'Cash'");
    const [[revenueAcct]] = await conn.query("SELECT id FROM accounts WHERE name = 'Sales Revenue'");
    if (cashAcct && revenueAcct) {
      await conn.query(
        `INSERT INTO transactions (txn_date, description, debit_account_id, credit_account_id, amount, reference)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [order_date, `Sale SO-${soId}`, cashAcct.id, revenueAcct.id, total, `SO-${soId}`]
      );
      await conn.query('UPDATE accounts SET balance = balance + ? WHERE id = ?', [total, cashAcct.id]);
      await conn.query('UPDATE accounts SET balance = balance + ? WHERE id = ?', [total, revenueAcct.id]);
    }

    await conn.commit();
    req.flash('success', 'Sales order created and stock updated.');
    res.redirect('/sales-orders');
  } catch (err) {
    await conn.rollback();
    console.error(err);
    req.flash('error', err.message || 'Could not create sales order.');
    res.redirect('/sales-orders/new');
  } finally {
    conn.release();
  }
});

module.exports = router;
