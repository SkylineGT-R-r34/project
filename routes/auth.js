import express from 'express';
import { login, logout, renderLogin } from '../controllers/auth.js';

export const authRouter = express.Router();

authRouter.get('/login', renderLogin);
authRouter.post('/login', login);
authRouter.post('/logout', logout);
