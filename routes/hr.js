const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { ensureAuth } = require('../middleware/auth');

router.get('/employees', ensureAuth, async (req, res) => {
  const [employees] = await pool.query('SELECT * FROM employees ORDER BY full_name');
  res.render('hr/index', { title: 'Employees', employees });
});

router.get('/employees/new', ensureAuth, (req, res) => {
  res.render('hr/form', { title: 'Add Employee', employee: {} });
});

router.post('/employees', ensureAuth, async (req, res) => {
  const { full_name, email, phone, department, position, salary, hire_date, status } = req.body;
  await pool.query(
    `INSERT INTO employees (full_name, email, phone, department, position, salary, hire_date, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [full_name, email, phone, department, position, salary || 0, hire_date, status || 'active']
  );
  req.flash('success', 'Employee added.');
  res.redirect('/employees');
});

router.get('/employees/:id/edit', ensureAuth, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM employees WHERE id = ?', [req.params.id]);
  if (!rows[0]) {
    req.flash('error', 'Employee not found.');
    return res.redirect('/employees');
  }
  res.render('hr/form', { title: 'Edit Employee', employee: rows[0] });
});

router.put('/employees/:id', ensureAuth, async (req, res) => {
  const { full_name, email, phone, department, position, salary, hire_date, status } = req.body;
  await pool.query(
    `UPDATE employees SET full_name=?, email=?, phone=?, department=?, position=?, salary=?, hire_date=?, status=?
     WHERE id=?`,
    [full_name, email, phone, department, position, salary, hire_date, status, req.params.id]
  );
  req.flash('success', 'Employee updated.');
  res.redirect('/employees');
});

router.delete('/employees/:id', ensureAuth, async (req, res) => {
  await pool.query('DELETE FROM employees WHERE id = ?', [req.params.id]);
  req.flash('success', 'Employee removed.');
  res.redirect('/employees');
});

// Run payroll for all active employees: posts one accounting transaction (Debit Salaries Expense / Credit Cash)
router.post('/employees/run-payroll', ensureAuth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[{ totalSalary }]] = await conn.query(
      "SELECT COALESCE(SUM(salary),0) AS totalSalary FROM employees WHERE status = 'active'"
    );

    const [[salariesAcct]] = await conn.query("SELECT id FROM accounts WHERE name = 'Salaries Expense'");
    const [[cashAcct]] = await conn.query("SELECT id FROM accounts WHERE name = 'Cash'");

    if (totalSalary > 0 && salariesAcct && cashAcct) {
      await conn.query(
        `INSERT INTO transactions (txn_date, description, debit_account_id, credit_account_id, amount, reference)
         VALUES (GETDATE(), 'Monthly payroll run', ?, ?, ?, 'PAYROLL')`,
        [salariesAcct.id, cashAcct.id, totalSalary]
      );
      await conn.query('UPDATE accounts SET balance = balance + ? WHERE id = ?', [totalSalary, salariesAcct.id]);
      await conn.query('UPDATE accounts SET balance = balance - ? WHERE id = ?', [totalSalary, cashAcct.id]);
    }

    await conn.commit();
    req.flash('success', `Payroll run complete. Total: $${Number(totalSalary).toFixed(2)}`);
  } catch (err) {
    await conn.rollback();
    console.error(err);
    req.flash('error', 'Payroll run failed.');
  } finally {
    conn.release();
  }
  res.redirect('/employees');
});

module.exports = router;
