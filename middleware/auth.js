// Simple session-based auth guard. Attach as middleware on protected routes.
function ensureAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  req.flash('error', 'Please log in to continue.');
  return res.redirect('/login');
}

// Restrict a route to specific roles, e.g. requireRole('admin')
function requireRole(...roles) {
  return (req, res, next) => {
    if (req.session && req.session.user && roles.includes(req.session.user.role)) {
      return next();
    }
    req.flash('error', 'You do not have permission to do that.');
    return res.redirect('/dashboard');
  };
}

module.exports = { ensureAuth, requireRole };
