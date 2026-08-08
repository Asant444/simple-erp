// Seeds the database with a default admin user and base chart of accounts.
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

async function seed() {
  try {
    const hashed = await bcrypt.hash('admin123', 10);

    await pool.query(
      `IF NOT EXISTS (SELECT 1 FROM users WHERE email = ?)
       BEGIN
         INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'admin')
       END`,
      ['admin@erp.com', 'Admin User', 'admin@erp.com', hashed]
    );

    const accounts = [
      ['Cash', 'asset'],
      ['Accounts Receivable', 'asset'],
      ['Inventory', 'asset'],
      ['Accounts Payable', 'liability'],
      ['Owner Equity', 'equity'],
      ['Sales Revenue', 'revenue'],
      ['Cost of Goods Sold', 'expense'],
      ['Salaries Expense', 'expense'],
      ['General Expense', 'expense'],
    ];

    for (const [name, type] of accounts) {
      await pool.query(
        `IF NOT EXISTS (SELECT 1 FROM accounts WHERE name = ?)
         BEGIN
           INSERT INTO accounts (name, type) VALUES (?, ?)
         END`,
        [name, name, type]
      );
    }

    console.log('Seed complete.');
    console.log('Login with: admin@erp.com / admin123');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
}

seed();
