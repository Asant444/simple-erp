const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { ensureAuth } = require('../middleware/auth');

// Chart of accounts with balances
router.get('/accounts', ensureAuth, async (req, res) => {
  const [accounts] = await pool.query('SELECT * FROM accounts ORDER BY type, name');
  res.render('accounting/accounts', { title: 'Chart of Accounts', accounts });
});

router.post('/accounts', ensureAuth, async (req, res) => {
  const { name, type } = req.body;
  await pool.query('INSERT INTO accounts (name, type) VALUES (?, ?)', [name, type]);
  req.flash('success', 'Account added.');
  res.redirect('/accounts');
});

// General ledger - all transactions
router.get('/ledger', ensureAuth, async (req, res) => {
  const [transactions] = await pool.query(
    `SELECT t.*, da.name AS debit_account, ca.name AS credit_account
     FROM transactions t
     JOIN accounts da ON t.debit_account_id = da.id
     JOIN accounts ca ON t.credit_account_id = ca.id
     ORDER BY t.txn_date DESC, t.id DESC`
  );
  res.render('accounting/ledger', { title: 'General Ledger', transactions });
});

// Manual journal entry
router.get('/ledger/new', ensureAuth, async (req, res) => {
  const [accounts] = await pool.query('SELECT * FROM accounts ORDER BY name');
  res.render('accounting/entry_form', { title: 'New Journal Entry', accounts });
});

router.post('/ledger', ensureAuth, async (req, res) => {
  const { txn_date, description, debit_account_id, credit_account_id, amount } = req.body;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `INSERT INTO transactions (txn_date, description, debit_account_id, credit_account_id, amount, reference)
       VALUES (?, ?, ?, ?, ?, 'MANUAL')`,
      [txn_date, description, debit_account_id, credit_account_id, amount]
    );
    await conn.query('UPDATE accounts SET balance = balance + ? WHERE id = ?', [amount, debit_account_id]);
    await conn.query('UPDATE accounts SET balance = balance + ? WHERE id = ?', [amount, credit_account_id]);
    await conn.commit();
    req.flash('success', 'Journal entry recorded.');
  } catch (err) {
    await conn.rollback();
    console.error(err);
    req.flash('error', 'Could not record journal entry.');
  } finally {
    conn.release();
  }
  res.redirect('/ledger');
});

// Simple income statement (Revenue - Expenses)
router.get('/reports/income-statement', ensureAuth, async (req, res) => {
  const [revenue] = await pool.query("SELECT name, balance FROM accounts WHERE type = 'revenue'");
  const [expenses] = await pool.query("SELECT name, balance FROM accounts WHERE type = 'expense'");
  const totalRevenue = revenue.reduce((sum, a) => sum + Number(a.balance), 0);
  const totalExpense = expenses.reduce((sum, a) => sum + Number(a.balance), 0);
  res.render('accounting/income_statement', {
    title: 'Income Statement',
    revenue,
    expenses,
    totalRevenue,
    totalExpense,
    netIncome: totalRevenue - totalExpense,
  });
});

module.exports = router;
