import cookieParser from 'cookie-parser';
import logger from 'morgan';
import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set the server port
export const port = 3000;


/**
 * Set up the server with boilerplate middleware
 * 
 * @param {Object} app - The Express application object.
 */
export function setup (app) {
    // Register bootstrap middleware
    app.use(logger('dev'));
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));
    app.use(cookieParser());
    app.use(express.static(path.join(__dirname, '..', 'public')));

    // view engine setup
    app.set('views', path.join(__dirname, '..', 'views'));
    app.set('view engine', 'ejs');
};

/**
 * Handles error for the application.
 * 
 * @param {Object} app - The Express app object.
 */
export function errorHandling(app) {
    // catch 404 and render not-found page
    app.use((req, res) => {
        res.status(404);
        res.render('notFound', { title: 'Page not found' });
    });

    // Default Error handler
    app.use((err, req, res, next) => {
        // Set locals, only providing error details in development
        res.locals.message = err.message;
        res.locals.error = req.app.get('env') === 'development' ? err : {};
    
        // Render the error page
        res.status(err.status || 500);
        res.render('error', { title: 'Error' });
    });
}