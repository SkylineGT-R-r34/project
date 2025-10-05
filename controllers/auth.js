import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db/db.js';
import { safeRedirect } from '../middleware/auth.js';

const TOKEN_COOKIE_NAME = 'token';
const DEFAULT_EXPIRY = '1h';

function wantsJSON(req) {
  const accept = req.headers.accept || '';
  const contentType = req.headers['content-type'] || '';
  return accept.includes('application/json') || contentType.includes('application/json');
}

function createTokenPayload(user) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    role: user.role,
  };
}

function signToken(payload) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }
  const expiresIn = process.env.JWT_EXPIRES_IN || DEFAULT_EXPIRY;
  return jwt.sign(payload, secret, { expiresIn });
}

function renderLoginView(res, status, model) {
  return res.status(status).render('login', {
    title: 'Login',
    error: model.error || null,
    values: model.values || { email: '' },
    next: model.next || '/',
  });
}

export function renderLogin(req, res) {
  if (req.user) {
    return res.redirect('/');
  }

  const nextPath = safeRedirect(req.query.next);
  return renderLoginView(res, 200, {
    values: { email: '' },
    next: nextPath,
  });
}

export async function login(req, res, next) {
  try {
    const { email, password, next: nextPathFromBody } = req.body;
    const wantsJsonResponse = wantsJSON(req);

    if (!email || !password) {
      if (wantsJsonResponse) {
        return res.status(400).json({ error: 'Email and password are required.' });
      }
      return renderLoginView(res, 400, {
        error: 'Email and password are required.',
        values: { email: email || '' },
        next: safeRedirect(nextPathFromBody),
      });
    }

    const result = await pool.query(
      'SELECT id, email, password, full_name, role FROM users WHERE email = $1',
      [email.toLowerCase()],
    );

    if (result.rowCount === 0) {
      if (wantsJsonResponse) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }
      return renderLoginView(res, 401, {
        error: 'Invalid email or password.',
        values: { email },
        next: safeRedirect(nextPathFromBody),
      });
    }

    const user = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      if (wantsJsonResponse) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }
      return renderLoginView(res, 401, {
        error: 'Invalid email or password.',
        values: { email },
        next: safeRedirect(nextPathFromBody),
      });
    }

    const tokenPayload = createTokenPayload(user);
    const token = signToken(tokenPayload);
    const redirectTarget = safeRedirect(nextPathFromBody);

    const maxAge = Number(process.env.JWT_COOKIE_MAX_AGE_MS || 60 * 60 * 1000);
    res.cookie(TOKEN_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge,
    });

    if (wantsJsonResponse) {
      return res.json({ token, user: tokenPayload });
    }

    return res.redirect(redirectTarget);
  } catch (error) {
    if (error.message === 'JWT_SECRET is not configured') {
      return next(error);
    }
    return next(error);
  }
}

export function logout(req, res) {
  res.clearCookie(TOKEN_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  if (wantsJSON(req)) {
    return res.json({ success: true });
  }

  return res.redirect('/auth/login');
}
