import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db/db.js';

const DEFAULT_EXPIRY = '1h';

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

export async function signup(req, res, next) {
  try {
    const { email, password, fullName, role } = req.body;

    if (!email || !password || !fullName) {
      return res.status(400).json({ error: 'Email, password, and fullName are required.' });
    }

    const normalizedEmail = email.toLowerCase();

    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existingUser.rowCount > 0) {
      return res.status(409).json({ error: 'Email already registered.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const insertResult = await pool.query(
      `INSERT INTO users (email, password, full_name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, full_name, role`,
      [normalizedEmail, hashedPassword, fullName, role || null],
    );

    const user = insertResult.rows[0];
    const token = jwt.sign(buildTokenPayload(user), requireSecret(), {
      expiresIn: process.env.JWT_EXPIRES_IN || DEFAULT_EXPIRY,
    });

    return res.status(201).json(formatUserResponse(user, token));
  } catch (error) {
    return next(error);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const normalizedEmail = email.toLowerCase();

    const result = await pool.query(
      'SELECT id, email, password, full_name, role FROM users WHERE email = $1',
      [normalizedEmail],
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ error: 'Wrong details please check at once' });
    }

    const user = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Wrong details please check at once' });
    }

    const token = jwt.sign(buildTokenPayload(user), requireSecret(), {
      expiresIn: process.env.JWT_EXPIRES_IN || DEFAULT_EXPIRY,
    });

    return res.status(200).json(formatUserResponse(user, token));
  } catch (error) {
    return next(error);
  }
}
