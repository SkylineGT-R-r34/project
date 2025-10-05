import jwt from 'jsonwebtoken';

function getTokenFromRequest(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return null;
}

function requireSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }
  return secret;
}

export function attachUser(req, res, next) {
  const token = getTokenFromRequest(req);

  if (!token) {
    req.user = null;
    res.locals.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, requireSecret());
    req.user = decoded;
    res.locals.user = decoded;
  } catch (error) {
    req.user = null;
    res.locals.user = null;
  }

  return next();
}

export function ensureAuthenticated(req, res, next) {
  const token = getTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, requireSecret());
    req.user = decoded;
    return next();
  } catch (error) {
    const message = error.message === 'JWT_SECRET is not configured'
      ? 'Server misconfiguration: JWT secret missing'
      : 'Invalid or expired token';
    const status = error.message === 'JWT_SECRET is not configured' ? 500 : 401;
    return res.status(status).json({ error: message });
  }
}
