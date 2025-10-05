import jwt from 'jsonwebtoken';

function wantsJSON(req) {
  const accept = req.headers.accept || '';
  const contentType = req.headers['content-type'] || '';
  return accept.includes('application/json') || contentType.includes('application/json');
}

function safeRedirect(target) {
  if (!target) return '/';
  if (target.startsWith('http://') || target.startsWith('https://')) {
    return '/';
  }
  if (!target.startsWith('/')) {
    return '/';
  }
  if (target.startsWith('//')) {
    return '/';
  }
  return target;
}

export function attachUser(req, res, next) {
  const authorization = req.headers.authorization || '';
  const bearerToken = authorization.startsWith('Bearer ')
    ? authorization.slice(7)
    : null;
  const token = req.cookies?.token || bearerToken;

  if (!token) {
    req.user = null;
    res.locals.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    res.locals.user = decoded;
  } catch (error) {
    req.user = null;
    res.locals.user = null;
    if (req.cookies?.token) {
      res.clearCookie('token');
    }
  }

  next();
}

export function ensureAuthenticated(req, res, next) {
  if (req.user) {
    return next();
  }

  if (wantsJSON(req)) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const redirectTo = encodeURIComponent(safeRedirect(req.originalUrl));
  return res.redirect(`/auth/login?next=${redirectTo}`);
}

export { safeRedirect };
