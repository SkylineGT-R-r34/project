import express from 'express';
import { login, signup } from '../controllers/auth.js';

export const authRouter = express.Router();

authRouter.post('/login', login);
authRouter.post('/signup', signup);
import { login, logout, renderLogin } from '../controllers/auth.js';

export const authRouter = express.Router();

authRouter.get('/login', renderLogin);
authRouter.post('/login', login);
authRouter.post('/logout', logout);
