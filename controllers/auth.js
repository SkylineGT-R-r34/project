import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db/db.js';

const TOKEN_EXPIRY = '1h';

function ensureSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return secret;
}

function normalizeUser(row) {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
  };
}

export async function register(req, res) {
  try {
    const { email, password, fullName, role } = req.body ?? {};

    if (!email || !password || !fullName) {
      return res.status(400).json({ message: 'Email, password, and fullName are required' });
    }

    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rowCount > 0) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const insertResult = await pool.query(
      `INSERT INTO users (email, password, full_name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, full_name, role`,
      [email, hashedPassword, fullName, role ?? null]
    );

    const user = normalizeUser(insertResult.rows[0]);
    const token = jwt.sign({ id: user.id, email: user.email }, ensureSecret(), { expiresIn: TOKEN_EXPIRY });

    return res.status(201).json({ token, user });
  } catch (error) {
    console.error('Error during registration:', error);
    return res.status(500).json({ message: 'Unable to register user' });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const userResult = await pool.query(
      'SELECT id, email, password, full_name, role FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rowCount === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const userRow = userResult.rows[0];
    const isMatch = await bcrypt.compare(password, userRow.password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = normalizeUser(userRow);
    const token = jwt.sign({ id: user.id, email: user.email }, ensureSecret(), { expiresIn: TOKEN_EXPIRY });

    return res.json({ token, user });
  } catch (error) {
    console.error('Error during login:', error);
    return res.status(500).json({ message: 'Unable to login' });
  }
}
