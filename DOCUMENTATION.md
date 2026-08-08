# Simple ERP System — Documentation

A lightweight but functionally complete Enterprise Resource Planning (ERP) web application covering the modules that matter most in a modern small/medium business: **Inventory, Purchasing, Sales, HR, and Accounting** — all tied together so that a single business event (a sale, a purchase, a payroll run) automatically updates stock levels and the general ledger.

Built as a senior project reference implementation: simple enough to explain in a viva/defense, but architecturally real (transactions, relational integrity, double-entry-style accounting) rather than a toy CRUD demo.

---

## 1. Why This Matters (Project Motivation)

Most small businesses run their inventory, sales, purchasing, HR, and books as disconnected spreadsheets. An ERP's core value proposition is **one source of truth**: when you sell a product, stock drops and revenue is recorded in the same transaction — no manual reconciliation. This project demonstrates that integration pattern at a scale that's realistic to build, defend, and demo within a single project cycle, while still touching on real enterprise-software concerns:

- Relational data modeling across departments
- ACID transactions for multi-table business events
- Role-based access control
- Double-entry-inspired accounting (every transaction has a debit and credit account)
- A believable audit trail (stock movements, ledger transactions)

---

## 2. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Runtime | Node.js | Simple async I/O, fast to build with |
| Web framework | Express.js | Minimal, well understood, easy to explain in a defense |
| Database | SQL Server (T-SQL) | Relational integrity, foreign keys, transactions — matches how real ERPs model data |
| Templating | EJS | Server-rendered HTML, no separate frontend build step — fastest path to a working demo |
| Styling | Bootstrap 5 (CDN) | Clean UI with zero custom CSS framework work |
| Auth | express-session + bcryptjs | Session-based login, hashed passwords |
| DB driver | mssql | Connection pooling + async/await via a mysql2-compatible shim (config/db.js), supports transactions |

**Why not React/a SPA?** For a single-day build and a senior project demo, a server-rendered app removes an entire layer of complexity (API design, CORS, client state management) while still producing a fully interactive, professional-looking app. You can mention this tradeoff explicitly in your project report as a deliberate scope decision.

---

## 3. Architecture Overview

```
Browser (EJS-rendered pages, Bootstrap)
        │  HTTP (session cookie)
        ▼
Express.js server (server.js)
        │
        ├── routes/          → one file per module, defines endpoints
        ├── middleware/auth  → session guard + role guard
        ├── views/           → EJS templates, one folder per module
        └── config/db.js     → SQL Server connection pool
                │
                ▼
        SQL Server database (simple_erp)
```

Every route follows the same pattern:
1. Check auth (`ensureAuth` middleware)
2. Run one or more SQL queries via the connection pool
3. For multi-table business events (sales, purchases, payroll), open a **transaction** (`pool.getConnection()` → `beginTransaction()` → queries → `commit()`/`rollback()`) so partial failures never corrupt data
4. Render an EJS view or redirect with a flash message

### Data flow example: making a sale
1. User submits a Sales Order form with product lines
2. Server checks stock availability for every line
3. Inside one DB transaction: insert the sales order, insert line items, **decrement product stock**, log a `stock_movements` row, and **post a ledger transaction** (Debit Cash / Credit Sales Revenue)
4. If anything fails, the whole transaction rolls back — no half-completed sale

This same pattern (business event → stock/HR change → ledger entry, all in one transaction) is used for Purchase Order receiving and Payroll runs.

---

## 4. Database Schema (ER Overview)

```
users ──────────────────────────────────────── (auth only, not FK'd to business data)

employees                          accounts ─┐
                                              │ (chart of accounts)
products ──┬── stock_movements                transactions (debit_account_id, credit_account_id)
           ├── purchase_order_items ── purchase_orders ── suppliers
           └── sales_order_items    ── sales_orders    ── customers
```

**Key tables:**
- `products` — SKU, price, cost, quantity, reorder_level (drives low-stock alerts)
- `stock_movements` — append-only audit log of every stock change and why
- `suppliers` / `purchase_orders` / `purchase_order_items` — procurement side
- `customers` / `sales_orders` / `sales_order_items` — sales side
- `employees` — HR records with salary, used by the payroll routine
- `accounts` — chart of accounts (asset/liability/equity/revenue/expense) with running balances
- `transactions` — general ledger; every row has a debit account, credit account, and amount (double-entry style)

Full DDL is in `db/schema.sql`.

---

## 5. Modules & Features

| Module | Features |
|---|---|
| **Auth** | Login, registration, role-based session (`admin` / `manager` / `staff`) |
| **Dashboard** | Cross-module KPIs: product count, low-stock count, active employees, pending sales/purchase orders, total revenue; low-stock alert table; recent sales table |
| **Inventory** | Product CRUD, manual stock adjustment (with reason logging), automatic low-stock flagging |
| **Purchasing** | Supplier CRUD, multi-line Purchase Orders, "Receive" action that increases stock and posts an accounting entry |
| **Sales** | Customer CRUD, multi-line Sales Orders with live stock validation, automatic stock deduction and revenue posting |
| **HR** | Employee CRUD, one-click "Run Payroll" that posts a single Salaries Expense transaction for all active employees |
| **Accounting** | Chart of accounts with live balances, general ledger, manual journal entries, simple Income Statement report |

---

## 6. Setup & Run Guide (SQL Server)

### Prerequisites
- Node.js 18+ and npm
- SQL Server (Express, Developer, or Standard edition) running locally
- **SQL Server Authentication (Mixed Mode) enabled**, with a SQL login — the `mssql` npm package is pure JavaScript and does not support Windows Integrated Authentication. If your instance is Windows-Auth-only:
  1. Open **SQL Server Management Studio (SSMS)** → right-click your server → **Properties** → **Security** → select **"SQL Server and Windows Authentication mode"** → OK
  2. Restart the SQL Server service (Services app → find your `MSSQLSERVER` or `SQLEXPRESS` service → Restart)
  3. In SSMS, expand **Security → Logins** → right-click → **New Login** → create a SQL login (e.g. `erp_user`) with a password, and grant it `sysadmin` or `db_owner` rights for simplicity in a dev/demo environment

### Steps

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   ```
   Edit `.env`:
   - `DB_HOST` — `localhost` for a default instance, or `localhost\SQLEXPRESS` (with the backslash) if you installed a named instance, which is the default for SQL Server Express
   - `DB_USER` / `DB_PASSWORD` — the SQL login you created above (or `sa` if you enabled the built-in `sa` account)

3. **Create the database schema**

   The schema file uses `GO` batch separators, which only SSMS/`sqlcmd` understand — not a plain query call. Two ways to run it:

   **Option A — via the included Node script (no extra tools needed):**
   ```bash
   npm run schema
   ```

   **Option B — via SSMS:** open `db/schema.sql` in SSMS and click **Execute**.

   **Option C — via `sqlcmd`** (if installed):
   ```bash
   sqlcmd -S localhost -U erp_user -P yourpassword -i db/schema.sql
   ```

   This creates the `simple_erp` database and all tables.

4. **Seed initial data**
   ```bash
   npm run seed
   ```
   This creates:
   - An admin login: **admin@erp.com / admin123**
   - A starter chart of accounts (Cash, Inventory, Accounts Payable, Sales Revenue, Salaries Expense, etc.)

5. **Run the app**
   ```bash
   npm start
   # or during development:
   npm run dev
   ```

6. Open **http://localhost:3000** and log in with the seeded admin account.

### Troubleshooting

| Problem | Fix |
|---|---|
| `Login failed for user` | SQL Server Authentication isn't enabled, or the login/password in `.env` is wrong — see Prerequisites above |
| `Failed to connect to localhost:1433` | SQL Server service isn't running, or you're using a named instance (need `localhost\SQLEXPRESS` as `DB_HOST`, and TCP/IP protocol enabled via SQL Server Configuration Manager) |
| `Could not find server` with named instance | Open **SQL Server Configuration Manager** → **SQL Server Network Configuration** → enable **TCP/IP** for your instance, then restart the service |
| Schema run fails partway | Some batches already applied — drop the `simple_erp` database in SSMS and re-run `npm run schema` |

### Suggested demo flow for your project defense
1. Log in as admin
2. Add a product in Inventory
3. Add a supplier, create and receive a Purchase Order → watch stock increase and check the Ledger for the new Inventory/AP entry
4. Add a customer, create a Sales Order → watch stock decrease and check the Ledger for the Cash/Revenue entry
5. Add an employee, click "Run Payroll" → check the Ledger and Income Statement update
6. Show the Dashboard tying all of it together

---

## 7. Design Decisions Worth Mentioning in Your Report

- **Server-rendered EJS instead of a SPA** — reduces moving parts, faster to build and demo, still fully interactive via forms and small vanilla-JS enhancements (dynamic order line items, auto-fill price).
- **Simplified double-entry accounting** — every business event posts a debit/credit pair to `transactions` and updates `accounts.balance` directly, mirroring real accounting systems without implementing a full ledger engine.
- **Stock deducted at sale time, not at "shipment"** — a deliberate simplification; a production ERP would separate "order placed" from "goods shipped." This is a good place to discuss extensions in your report (see below).
- **DB transactions everywhere multiple tables change together** — demonstrates understanding of data integrity, a common senior-project evaluation point.

## 8. Possible Extensions (good "future work" section)
- Multi-warehouse inventory
- Order approval workflows (manager sign-off before PO/SO is finalized)
- Partial shipments/receipts instead of all-or-nothing
- PDF invoice/PO generation
- REST API layer + a mobile or SPA frontend
- Multi-currency support
- Audit log of who changed what (tie `stock_movements`/`transactions` to `users.id`)

---

## 9. Project Structure Reference

```
erp/
├── server.js              Entry point, middleware, route mounting
├── config/db.js           SQL Server connection pool
├── middleware/auth.js     ensureAuth, requireRole
├── db/
│   ├── schema.sql         Full DDL (T-SQL, run via SSMS/sqlcmd or npm run schema)
│   ├── run-schema.js      Node-based schema runner (splits GO batches)
│   └── seed.js            Admin user + chart of accounts seeding
├── routes/
│   ├── auth.js
│   ├── dashboard.js
│   ├── inventory.js
│   ├── purchasing.js
│   ├── sales.js
│   ├── hr.js
│   └── accounting.js
├── views/                 EJS templates (one folder per module)
├── public/css/style.css
├── package.json
└── .env.example
```
