import express from 'express';
import pool from '../db/db.js';
import * as moodTracking from '../controllers/moodTracking.js';
export const moodTrackingRouter = express.Router();
moodTrackingRouter.get('/moodTrackingPage', moodTracking.index);
// Get all mood of user
moodTrackingRouter.get('/', async (req, res) => {
  try {
    const getMood = await pool.query('SELECT * FROM mood_logs ORDER BY created_at DESC');
    res.json(getMood.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('cant find query');
  }
});

// Add a new mood 
moodTrackingRouter.post('/', async (req, res) => {
  try {
    const { user_id, score, notes } = req.body;
    const newMood = await pool.query(
      'INSERT INTO mood_logs (user_id, score, notes) VALUES ($1, $2, $3) RETURNING *',
      [user_id, score, notes]
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
    const { user_id, message } = req.body;  
    const type='Help Request from student';
    const newHelpRequest = await pool.query(
      'INSERT INTO notifications (user_id, message,type) VALUES ($1, $2,$3) RETURNING *',
      [user_id, message,type]
    );
    res.json(newHelpRequest.rows[0]);
  } 
    catch (err) {
    console.error(err.message);
    res.status(500).send('cant post query');
  } 
});
// graph data 
moodTrackingRouter.get('/graph', async (req, res) => {
  try { 
    const graphData = await pool.query('SELECT date_trunc(\'day\', created_at) AS day, AVG(score) AS average_score FROM mood_logs GROUP BY day ORDER BY day DESC LIMIT 7');
    res.json(graphData.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('cant find query');
  } 
});
