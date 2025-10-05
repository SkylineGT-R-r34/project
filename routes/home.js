import express from 'express';
import * as home from '../controllers/home.js';

export const homeRouter = express.Router()

// Below are all the routes for the home
homeRouter.get('/', home.index);




