import express from 'express';
import { login, logout, showLogin, showSignup, signup } from '../controllers/auth.js';

export const authRouter = express.Router();

authRouter.get('/login', showLogin);
authRouter.post('/login', login);
authRouter.post('/logout', logout);
authRouter.get('/signup', showSignup);
authRouter.post('/signup', signup);
