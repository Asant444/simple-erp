require('dotenv').config();
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const path = require('path');

const app = express();

// ---------- View engine ----------
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ---------- Middleware ----------
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(methodOverride('_method')); // allows <form> to send PUT/DELETE via ?_method=

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev_secret_change_me',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 8 }, // 8 hours
  })
);
app.use(flash());

// Make current user + flash messages available in all views
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.successMsg = req.flash('success');
  res.locals.errorMsg = req.flash('error');
  res.locals.currentPath = req.path;
  next();
});

// ---------- Routes ----------
app.get('/', (req, res) => res.redirect(req.session.user ? '/dashboard' : '/login'));

app.use('/', require('./routes/auth'));
app.use('/', require('./routes/dashboard'));
app.use('/', require('./routes/inventory'));
app.use('/', require('./routes/purchasing'));
app.use('/', require('./routes/sales'));
app.use('/', require('./routes/hr'));
app.use('/', require('./routes/accounting'));

// ---------- 404 ----------
app.use((req, res) => {
  res.status(404).render('404', { title: 'Not Found' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`ERP running at http://localhost:${PORT}`));
