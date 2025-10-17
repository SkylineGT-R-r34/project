import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db/db.js';

const TOKEN_EXPIRY = '1h';

function ensureSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is not set');
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

// ================= REGISTER =================
export async function register(req, res) {
  try {
    const { email, password, fullName, role } = req.body ?? {};

    if (!email || !password || !fullName)
      return res.status(400).json({ message: 'Email, password, and full name required' });

    const existing = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
    if (existing.rowCount > 0) return res.status(409).json({ message: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 10);
    const insert = await pool.query(
      `INSERT INTO users (email, password, full_name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, full_name, role`,
      [email, hashed, fullName, role ?? 'student']
    );

    const user = normalizeUser(insert.rows[0]);
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, ensureSecret(), { expiresIn: TOKEN_EXPIRY });

    // ✅ Set token cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: false, // set true if using HTTPS
      sameSite: 'Strict',
      maxAge: 60 * 60 * 1000,
    });

    res.status(201).json({ message: 'Registration successful', user });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Unable to register' });
  }
}

// ================= LOGIN =================
export async function login(req, res) {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password)
      return res.status(400).json({ message: 'Email and password required' });

    const userRes = await pool.query(
      'SELECT id, email, password, full_name, role FROM users WHERE email = $1',
      [email]
    );
    if (userRes.rowCount === 0)
      return res.status(401).json({ message: 'Please check your email or password' });

    const userRow = userRes.rows[0];
    const isMatch = await bcrypt.compare(password, userRow.password);
    if (!isMatch) return res.status(401).json({ message: 'Please check your email or password' });

    const user = normalizeUser(userRow);
    const token = jwt.sign({ id: user.id,name:user.fullName, email: user.email, role: user.role }, ensureSecret(), { expiresIn: TOKEN_EXPIRY });

    res.cookie('token', token, {
      httpOnly: true,
      secure: false,
      sameSite: 'Strict',
      maxAge: 60 * 60 * 1000,
    });

    res.json({ message: 'Login successful', user });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Unable to login' });
  }
}
// ================= RESET PASSWORD =================
export async function resetPassword(req, res) {
  try {
    const { email, newPassword } = req.body ?? {};

    if (!email || !newPassword) {
      return res.status(400).json({ message: 'Email and new password required' });
    }

    // Check if user exists
    const userRes = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userRes.rowCount === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Hash the new password
    const hashed = await bcrypt.hash(newPassword, 10);

    // Update the password in the database
    await pool.query('UPDATE users SET password = $1 WHERE email = $2', [hashed, email]);
    res.redirect('/auth/login');
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Unable to reset password' });
  }
}
