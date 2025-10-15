
/**
 * Renders the index page with the specified title.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Function} next - The next middleware function.
 * @returns {Promise<void>} - A promise that resolves when the rendering is complete.
 */
// controllers/moodTracking.js
import { name } from 'ejs';
import pool from '../db/db.js';

export const index = async (req, res) => {
  try {
    // Fetch moods from DB
    const moods = await pool.query(
      'SELECT * FROM mood_logs ORDER BY created_at DESC'
    );

    // Render EJS view with moods
    res.render('moodTrackingUI', {title: 'Mood Tracking Page', moods: moods.rows, user: {id:1, name: 'Test User'}});
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error loading mood tracking page');
  }
};

