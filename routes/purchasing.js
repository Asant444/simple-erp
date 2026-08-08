const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { ensureAuth } = require('../middleware/auth');

// ---------- SUPPLIERS ----------
router.get('/suppliers', ensureAuth, async (req, res) => {
  const [suppliers] = await pool.query('SELECT * FROM suppliers ORDER BY name');
  res.render('purchasing/suppliers', { title: 'Suppliers', suppliers });
});

router.post('/suppliers', ensureAuth, async (req, res) => {
  const { name, contact_person, email, phone, address } = req.body;
  await pool.query(
    'INSERT INTO suppliers (name, contact_person, email, phone, address) VALUES (?, ?, ?, ?, ?)',
    [name, contact_person, email, phone, address]
  );
  req.flash('success', 'Supplier added.');
  res.redirect('/suppliers');
});

router.delete('/suppliers/:id', ensureAuth, async (req, res) => {
  await pool.query('DELETE FROM suppliers WHERE id = ?', [req.params.id]);
  req.flash('success', 'Supplier removed.');
  res.redirect('/suppliers');
});

// ---------- PURCHASE ORDERS ----------
router.get('/purchase-orders', ensureAuth, async (req, res) => {
  const [orders] = await pool.query(
    `SELECT po.*, s.name AS supplier_name FROM purchase_orders po
     JOIN suppliers s ON po.supplier_id = s.id ORDER BY po.created_at DESC`
  );
  res.render('purchasing/orders', { title: 'Purchase Orders', orders });
});

router.get('/purchase-orders/new', ensureAuth, async (req, res) => {
  const [suppliers] = await pool.query('SELECT * FROM suppliers ORDER BY name');
  const [products] = await pool.query('SELECT * FROM products ORDER BY name');
  res.render('purchasing/order_form', { title: 'New Purchase Order', suppliers, products });
});

// Create PO with line items. Expects arrays: product_id[], quantity[], unit_cost[]
router.post('/purchase-orders', ensureAuth, async (req, res) => {
  const { supplier_id, order_date, product_id, quantity, unit_cost } = req.body;
  const productIds = [].concat(product_id || []);
  const quantities = [].concat(quantity || []);
  const costs = [].concat(unit_cost || []);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    let total = 0;
    for (let i = 0; i < productIds.length; i++) {
      total += parseFloat(costs[i]) * parseInt(quantities[i], 10);
    }

    const [result] = await conn.query(
      `INSERT INTO purchase_orders (supplier_id, order_date, status, total) VALUES (?, ?, 'pending', ?)`,
      [supplier_id, order_date, total]
    );
    const poId = result.insertId;

    for (let i = 0; i < productIds.length; i++) {
      if (!productIds[i]) continue;
      await conn.query(
        'INSERT INTO purchase_order_items (po_id, product_id, quantity, unit_cost) VALUES (?, ?, ?, ?)',
        [poId, productIds[i], quantities[i], costs[i]]
      );
    }

    await conn.commit();
    req.flash('success', 'Purchase order created.');
    res.redirect('/purchase-orders');
  } catch (err) {
    await conn.rollback();
    console.error(err);
    req.flash('error', 'Could not create purchase order.');
    res.redirect('/purchase-orders/new');
  } finally {
    conn.release();
  }
});

// Mark PO as received -> increases stock and logs accounting entry (Inventory debit / AP credit)
router.post('/purchase-orders/:id/receive', ensureAuth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [items] = await conn.query('SELECT * FROM purchase_order_items WHERE po_id = ?', [req.params.id]);
    for (const item of items) {
      await conn.query('UPDATE products SET quantity = quantity + ? WHERE id = ?', [item.quantity, item.product_id]);
      await conn.query(
        `INSERT INTO stock_movements (product_id, change_qty, reason, reference) VALUES (?, ?, 'Purchase received', ?)`,
        [item.product_id, item.quantity, `PO-${req.params.id}`]
      );
    }

    await conn.query(`UPDATE purchase_orders SET status = 'received' WHERE id = ?`, [req.params.id]);

    // Simple accounting entry: Debit Inventory, Credit Accounts Payable
    const [[po]] = await conn.query('SELECT * FROM purchase_orders WHERE id = ?', [req.params.id]);
    const [[inventoryAcct]] = await conn.query("SELECT id FROM accounts WHERE name = 'Inventory'");
    const [[apAcct]] = await conn.query("SELECT id FROM accounts WHERE name = 'Accounts Payable'");
    if (inventoryAcct && apAcct) {
      await conn.query(
        `INSERT INTO transactions (txn_date, description, debit_account_id, credit_account_id, amount, reference)
         VALUES (GETDATE(), ?, ?, ?, ?, ?)`,
        [`Goods received PO-${req.params.id}`, inventoryAcct.id, apAcct.id, po.total, `PO-${req.params.id}`]
      );
      await conn.query('UPDATE accounts SET balance = balance + ? WHERE id = ?', [po.total, inventoryAcct.id]);
      await conn.query('UPDATE accounts SET balance = balance + ? WHERE id = ?', [po.total, apAcct.id]);
    }

    await conn.commit();
    req.flash('success', 'Purchase order marked as received and stock updated.');
  } catch (err) {
    await conn.rollback();
    console.error(err);
    req.flash('error', 'Could not receive purchase order.');
  } finally {
    conn.release();
  }
  res.redirect('/purchase-orders');
});

module.exports = router;
