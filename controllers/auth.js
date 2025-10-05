import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db/db.js';

const DEFAULT_EXPIRY = '1h';
const TOKEN_COOKIE_NAME = 'token';

function requireSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }
  return secret;
}

function buildTokenPayload(user) {
  return {
    userId: user.id,
    email: user.email,
    fullName: user.full_name,
    role: user.role,
  };
}

function formatUserResponse(user, token) {
  return {
    success: true,
    data: {
      userId: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      token,
    },
  };
}

function wantsJSON(req) {
  const accept = req.headers.accept || '';
  const contentType = req.headers['content-type'] || '';
  return req.xhr || accept.includes('application/json') || contentType.includes('application/json');
}

function getCookieOptions() {
  const options = {
    httpOnly: true,
    sameSite: 'lax',
  };

  if (process.env.NODE_ENV === 'production') {
    options.secure = true;
  }

  return options;
}

function sendTokenCookie(res, token) {
  res.cookie(TOKEN_COOKIE_NAME, token, getCookieOptions());
}

function respondWithSuccess(req, res, status, user, token) {
  if (wantsJSON(req)) {
    return res.status(status).json(formatUserResponse(user, token));
  }

  sendTokenCookie(res, token);
  return res.redirect('/');
}

function respondWithError(req, res, status, message, view, values = {}) {
  if (wantsJSON(req)) {
    return res.status(status).json({ error: message });
  }

  return res.status(status === 401 ? 200 : status).render(`auth/${view}`, {
    title: view === 'signup' ? 'Create an account' : 'Sign in',
    error: message,
    values,
  });
}

async function fetchUserByEmail(email) {
  return pool.query(
    'SELECT id, email, password, full_name, role FROM users WHERE email = $1',
    [email],
  );
}

function normaliseEmail(email = '') {
  return email.trim().toLowerCase();
}

function getTokenExpiry() {
  return process.env.JWT_EXPIRES_IN || DEFAULT_EXPIRY;
}

function generateToken(user) {
  return jwt.sign(buildTokenPayload(user), requireSecret(), {
    expiresIn: getTokenExpiry(),
  });
}

export function showLogin(req, res) {
  if (req.user) {
    return res.redirect('/');
  }

  return res.render('auth/login', {
    title: 'Sign in',
    error: null,
    values: { email: '' },
  });
}

export function showSignup(req, res) {
  if (req.user) {
    return res.redirect('/');
  }

  return res.render('auth/signup', {
    title: 'Create an account',
    error: null,
    values: { email: '', fullName: '', role: '' },
  });
}

export async function signup(req, res, next) {
  try {
    const { email, password, fullName, role } = req.body;

    if (!email || !password || !fullName) {
      return respondWithError(
        req,
        res,
        400,
        'Email, password, and full name are required.',
        'signup',
        { email: email || '', fullName: fullName || '', role: role || '' },
      );
    }

    const normalizedEmail = normaliseEmail(email);

    const existingUser = await fetchUserByEmail(normalizedEmail);
    if (existingUser.rowCount > 0) {
      return respondWithError(
        req,
        res,
        409,
        'Email already registered.',
        'signup',
        { email: email || '', fullName: fullName || '', role: role || '' },
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const insertResult = await pool.query(
      `INSERT INTO users (email, password, full_name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, full_name, role`,
      [normalizedEmail, hashedPassword, fullName.trim(), role ? role.trim() : null],
    );

    const user = insertResult.rows[0];
    const token = generateToken(user);

    return respondWithSuccess(req, res, 201, user, token);
  } catch (error) {
    return next(error);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return respondWithError(
        req,
        res,
        400,
        'Email and password are required.',
        'login',
        { email: email || '' },
      );
    }

    const normalizedEmail = normaliseEmail(email);

    const result = await fetchUserByEmail(normalizedEmail);

    if (result.rowCount === 0) {
      return respondWithError(
        req,
        res,
        401,
        'Wrong details please check at once',
        'login',
        { email: email || '' },
      );
    }

    const user = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return respondWithError(
        req,
        res,
        401,
        'Wrong details please check at once',
        'login',
        { email: email || '' },
      );
    }

    const token = generateToken(user);

    return respondWithSuccess(req, res, 200, user, token);
  } catch (error) {
    return next(error);
  }
}

export function logout(req, res) {
  res.clearCookie(TOKEN_COOKIE_NAME, getCookieOptions());

  if (wantsJSON(req)) {
    return res.status(200).json({ success: true });
  }

  return res.redirect('/auth/login');
}
