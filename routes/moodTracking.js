import express from 'express';
import pool from '../db/db.js';
import * as moodTracking from '../controllers/moodTrackingController.js';
import { authenticateToken } from '../middleware/auth.js';

export const moodTrackingRouter = express.Router();

moodTrackingRouter.get('/moodTrackingPage', authenticateToken, moodTracking.index);

// Get moods for logged-in user
moodTrackingRouter.get('/', authenticateToken, async (req, res) => {
  try {
    const user_id = req.query.user_id;
    if (!user_id) return res.status(400).send('User ID missing');

    const result = await pool.query(
      'SELECT * FROM mood_logs WHERE user_id = $1 ORDER BY created_at DESC',
      [user_id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Cannot fetch moods');
  }
});

// Add new mood
moodTrackingRouter.post('/add', authenticateToken, async (req, res) => {
  try {
    const { user_id, score, notes } = req.body;
    if (!user_id || !score) return res.status(400).send('Missing required fields');

    const result = await pool.query(
      'INSERT INTO mood_logs (user_id, score, notes) VALUES ($1, $2, $3) RETURNING *',
      [user_id, score, notes || '']
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Cannot post mood');
  }
});

// Send help request
moodTrackingRouter.post('/help', authenticateToken, async (req, res) => {
  try {
    const { user_id, message } = req.body;
    if (!user_id || !message) return res.status(400).send('Missing required fields');

    const type = 'Help Request from student';
    const result = await pool.query(
      'INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, $3) RETURNING *',
      [user_id, message, type]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Cannot send help request');
  }
});

// Get mood graph
moodTrackingRouter.get('/graph', authenticateToken, async (req, res) => {
  try {
    const user_id = req.query.user_id;
    if (!user_id) return res.status(400).send('User ID missing');

    const result = await pool.query(
      `SELECT date_trunc('day', created_at) AS day, AVG(score) AS average_score
       FROM mood_logs
       WHERE user_id = $1
       GROUP BY day
       ORDER BY day DESC
       LIMIT 7`,
      [user_id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Cannot fetch graph data');
  }
});
