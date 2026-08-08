# Simple ERP

A lightweight but functionally complete Enterprise Resource Planning system — **Inventory, Purchasing, Sales, HR, and Accounting** — built on Node.js, Express, and SQL Server. Every business event (a sale, a purchase receipt, a payroll run) automatically updates stock levels and posts to the general ledger in a single database transaction, the same way real ERP systems keep one source of truth across departments.

Built as a reference implementation for a senior capstone project: simple enough to explain end-to-end, but architecturally real — relational integrity, ACID transactions, and double-entry-style accounting instead of a disconnected CRUD demo.

![Node](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)
![SQL Server](https://img.shields.io/badge/SQL%20Server-T--SQL-CC2927?logo=microsoftsqlserver&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue.svg)

---

## Features

| Module | What it does |
|---|---|
| **Dashboard** | Cross-module KPIs, low-stock alerts, recent sales — one screen for the whole business |
| **Inventory** | Product catalog, stock adjustments with audit trail, automatic low-stock flagging |
| **Purchasing** | Suppliers, multi-line purchase orders, receiving flow that updates stock + ledger |
| **Sales** | Customers, multi-line sales orders with live stock validation, automatic revenue posting |
| **HR** | Employee records, one-click payroll run that posts to the ledger |
| **Accounting** | Chart of accounts, general ledger, manual journal entries, income statement report |

Every sale, purchase receipt, and payroll run wraps its database writes in a single transaction and posts a matching debit/credit pair to the ledger — so stock counts and account balances never drift out of sync with the operations that caused them.

## Tech Stack

- **Backend:** Node.js + Express
- **Database:** SQL Server (T-SQL), via the `mssql` driver
- **Views:** EJS (server-rendered, no separate frontend build)
- **Styling:** Custom design system — see [`DOCUMENTATION.md`](./DOCUMENTATION.md) for the full token/architecture writeup
- **Auth:** express-session + bcrypt

## Quick Start

\`\`\`bash
git clone https://github.com/<your-username>/simple-erp.git
cd simple-erp
npm install
cp .env.example .env   # then fill in your SQL Server credentials
npm run schema          # creates the database + tables
npm run seed             # creates the admin login + starter chart of accounts
npm start
\`\`\`

Open **http://localhost:3000** and log in with `admin@erp.com` / `admin123`.

For the full setup walkthrough (including SQL Server Mixed Mode auth setup, troubleshooting connection issues, and a suggested demo script), see **[DOCUMENTATION.md](./DOCUMENTATION.md)**.

## Project Structure

\`\`\`
simple-erp/
├── server.js              Entry point, middleware, route mounting
├── config/db.js           SQL Server connection pool
├── db/
│   ├── schema.sql          Full T-SQL schema
│   ├── run-schema.js       Node-based schema runner (no sqlcmd required)
│   └── seed.js              Admin user + chart of accounts seeding
├── routes/                 One file per module (auth, inventory, sales, ...)
├── views/                  EJS templates, one folder per module
├── public/css/style.css    Design system
└── DOCUMENTATION.md        Architecture, ER overview, full setup guide
\`\`\`

## Roadmap / Possible Extensions

- Multi-warehouse inventory
- Order approval workflows
- PDF invoice/PO generation
- REST API + mobile client
- Per-user audit trail on ledger entries

See [DOCUMENTATION.md](./DOCUMENTATION.md) for the full extended discussion.

## License

MIT — see [LICENSE](./LICENSE).