-- =========================================================
-- Simple ERP Database Schema — SQL Server (T-SQL) version
-- Modules: Auth, Inventory, Sales, Purchasing, HR, Accounting
-- Run this whole file in SSMS, or via:
--   sqlcmd -S localhost -U sa -P yourpassword -i schema.sql
-- =========================================================

IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'simple_erp')
BEGIN
    CREATE DATABASE simple_erp;
END
GO

USE simple_erp;
GO

-- ---------- AUTH ----------
CREATE TABLE users (
  id INT IDENTITY(1,1) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'staff' CHECK (role IN ('admin','manager','staff')),
  created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

-- ---------- HR ----------
CREATE TABLE employees (
  id INT IDENTITY(1,1) PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(150),
  phone VARCHAR(30),
  department VARCHAR(80),
  position VARCHAR(80),
  salary DECIMAL(12,2) NOT NULL DEFAULT 0,
  hire_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','on_leave','terminated')),
  created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

-- ---------- INVENTORY ----------
CREATE TABLE products (
  id INT IDENTITY(1,1) PRIMARY KEY,
  sku VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  description NVARCHAR(MAX),
  category VARCHAR(80),
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  cost_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  quantity INT NOT NULL DEFAULT 0,
  reorder_level INT NOT NULL DEFAULT 10,
  created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

CREATE TABLE stock_movements (
  id INT IDENTITY(1,1) PRIMARY KEY,
  product_id INT NOT NULL,
  change_qty INT NOT NULL, -- positive = stock in, negative = stock out
  reason VARCHAR(150),
  reference VARCHAR(100), -- e.g. SO-1002 or PO-2003
  created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
  CONSTRAINT FK_stockmovements_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);
GO

-- ---------- PURCHASING ----------
CREATE TABLE suppliers (
  id INT IDENTITY(1,1) PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  contact_person VARCHAR(100),
  email VARCHAR(150),
  phone VARCHAR(30),
  address VARCHAR(255),
  created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

CREATE TABLE purchase_orders (
  id INT IDENTITY(1,1) PRIMARY KEY,
  supplier_id INT NOT NULL,
  order_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','received','cancelled')),
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
  CONSTRAINT FK_po_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);
GO

CREATE TABLE purchase_order_items (
  id INT IDENTITY(1,1) PRIMARY KEY,
  po_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL,
  unit_cost DECIMAL(12,2) NOT NULL,
  CONSTRAINT FK_poitems_po FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  CONSTRAINT FK_poitems_product FOREIGN KEY (product_id) REFERENCES products(id)
);
GO

-- ---------- SALES ----------
CREATE TABLE customers (
  id INT IDENTITY(1,1) PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150),
  phone VARCHAR(30),
  address VARCHAR(255),
  created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

CREATE TABLE sales_orders (
  id INT IDENTITY(1,1) PRIMARY KEY,
  customer_id INT NOT NULL,
  order_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','cancelled')),
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
  CONSTRAINT FK_so_customer FOREIGN KEY (customer_id) REFERENCES customers(id)
);
GO

CREATE TABLE sales_order_items (
  id INT IDENTITY(1,1) PRIMARY KEY,
  so_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  CONSTRAINT FK_soitems_so FOREIGN KEY (so_id) REFERENCES sales_orders(id) ON DELETE CASCADE,
  CONSTRAINT FK_soitems_product FOREIGN KEY (product_id) REFERENCES products(id)
);
GO

-- ---------- ACCOUNTING ----------
CREATE TABLE accounts (
  id INT IDENTITY(1,1) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('asset','liability','equity','revenue','expense')),
  balance DECIMAL(14,2) NOT NULL DEFAULT 0
);
GO

CREATE TABLE transactions (
  id INT IDENTITY(1,1) PRIMARY KEY,
  txn_date DATE NOT NULL,
  description VARCHAR(255),
  debit_account_id INT NOT NULL,
  credit_account_id INT NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  reference VARCHAR(100),
  created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
  CONSTRAINT FK_txn_debit FOREIGN KEY (debit_account_id) REFERENCES accounts(id),
  CONSTRAINT FK_txn_credit FOREIGN KEY (credit_account_id) REFERENCES accounts(id)
);
GO
