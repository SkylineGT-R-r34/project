import express from 'express';
import { login, register } from '../controllers/auth.js';
import { resetPassword } from '../controllers/auth.js';
import { authenticateToken } from '../middleware/auth.js';
import bcrypt from 'bcryptjs';
import pool from '../db/db.js';
export const authRouter = express.Router();

//authRouter.post('/register', register);
authRouter.post('/login', login);
authRouter.get('/login', (req, res) => {
  res.render('login', { title: 'Login' });
});
authRouter.get('/register', (req, res) => {
  res.render('register', { title: 'Register' });
});
authRouter.post('/register', register);
authRouter.get('/reset_password', (req, res) => {
  res.render('resetPassword', { title: 'Reset Password' });
});
authRouter.post('/reset_password', resetPassword);
//== change password function
authRouter.post('/change_password',authenticateToken, async (req, res) => {
  try {
    // Assuming you store user info in session
    const user = req.user;
    const { newPassword } = req.body;

    if (!user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    if (!newPassword) {
      return res.status(400).json({ message: 'New password required' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashed, user.id]);

    return res.status(200).json({ message: 'Password changed successfully!' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Unable to change password' });
  }
});