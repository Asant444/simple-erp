const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { ensureAuth } = require('../middleware/auth');

// List all products
router.get('/inventory', ensureAuth, async (req, res) => {
  const [products] = await pool.query('SELECT * FROM products ORDER BY name');
  res.render('inventory/index', { title: 'Inventory', products });
});

// New product form
router.get('/inventory/new', ensureAuth, (req, res) => {
  res.render('inventory/form', { title: 'Add Product', product: {} });
});

// Create product
router.post('/inventory', ensureAuth, async (req, res) => {
  const { sku, name, description, category, unit_price, cost_price, quantity, reorder_level } = req.body;
  try {
    await pool.query(
      `INSERT INTO products (sku, name, description, category, unit_price, cost_price, quantity, reorder_level)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [sku, name, description, category, unit_price, cost_price || 0, quantity || 0, reorder_level || 10]
    );
    req.flash('success', 'Product added.');
    res.redirect('/inventory');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Could not add product. SKU may already exist.');
    res.redirect('/inventory/new');
  }
});

// Edit product form
router.get('/inventory/:id/edit', ensureAuth, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
  if (!rows[0]) {
    req.flash('error', 'Product not found.');
    return res.redirect('/inventory');
  }
  res.render('inventory/form', { title: 'Edit Product', product: rows[0] });
});

// Update product
router.put('/inventory/:id', ensureAuth, async (req, res) => {
  const { sku, name, description, category, unit_price, cost_price, quantity, reorder_level } = req.body;
  await pool.query(
    `UPDATE products SET sku=?, name=?, description=?, category=?, unit_price=?, cost_price=?, quantity=?, reorder_level=?
     WHERE id=?`,
    [sku, name, description, category, unit_price, cost_price, quantity, reorder_level, req.params.id]
  );
  req.flash('success', 'Product updated.');
  res.redirect('/inventory');
});

// Delete product
router.delete('/inventory/:id', ensureAuth, async (req, res) => {
  await pool.query('DELETE FROM products WHERE id = ?', [req.params.id]);
  req.flash('success', 'Product deleted.');
  res.redirect('/inventory');
});

// Adjust stock (manual stock in/out, e.g. damage, correction)
router.post('/inventory/:id/adjust', ensureAuth, async (req, res) => {
  const { change_qty, reason } = req.body;
  const qty = parseInt(change_qty, 10);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('UPDATE products SET quantity = quantity + ? WHERE id = ?', [qty, req.params.id]);
    await conn.query(
      'INSERT INTO stock_movements (product_id, change_qty, reason, reference) VALUES (?, ?, ?, ?)',
      [req.params.id, qty, reason || 'Manual adjustment', 'ADJ']
    );
    await conn.commit();
    req.flash('success', 'Stock adjusted.');
  } catch (err) {
    await conn.rollback();
    console.error(err);
    req.flash('error', 'Stock adjustment failed.');
  } finally {
    conn.release();
  }
  res.redirect('/inventory');
});

module.exports = router;
