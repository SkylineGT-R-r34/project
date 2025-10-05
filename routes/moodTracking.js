import express from 'express';
import pool from '../db/db.js';
import { authenticateToken } from '../middleware/auth.js';
export const moodTrackingRouter = express.Router();

// Require authentication for all mood tracking routes
moodTrackingRouter.use(authenticateToken);

// Get all mood of authenticated user
moodTrackingRouter.get('/', async (req, res) => {
  try {
    const getMood = await pool.query(
      'SELECT * FROM mood_logs WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(getMood.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('cant find query');
  }
});

// Add a new mood
moodTrackingRouter.post('/', async (req, res) => {
  try {
    const { score, notes } = req.body;
    if (typeof score === 'undefined') {
      return res.status(400).json({ message: 'score is required' });
    }
    const newMood = await pool.query(
      'INSERT INTO mood_logs (user_id, score, notes) VALUES ($1, $2, $3) RETURNING *',
      [req.user.id, score, notes ?? null]
    );
    res.json(newMood.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('cant post query');
  }
});
// sennd help message to staff
moodTrackingRouter.post('/help', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ message: 'message is required' });
    }
    const newHelpRequest = await pool.query(
      'INSERT INTO notifications (user_id, message) VALUES ($1, $2) RETURNING *',
      [req.user.id, message]
    );
    res.json(newHelpRequest.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('cant post query');
  }
});
// graph data
moodTrackingRouter.get('/graph', async (req, res) => {
  try {
    const graphData = await pool.query(
      "SELECT date_trunc('day', created_at) AS day, AVG(score) AS average_score FROM mood_logs WHERE user_id = $1 GROUP BY day ORDER BY day DESC LIMIT 7",
      [req.user.id]
    );
    res.json(graphData.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('cant find query');
  }
});
