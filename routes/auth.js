import express from 'express';
import { login, register } from '../controllers/auth.js';
import { resetPassword } from '../controllers/auth.js';
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
