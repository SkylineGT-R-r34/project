import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import pool from '../db/db.js'; // make sure pool is your pg Pool instance
import { name } from 'ejs';

export const dash = express.Router();

// ---------------- Dashboard Home ----------------
dash.get('/', authenticateToken, (req, res) => {
  res.render('dashboard', {
    title: 'Dashboard',
    name: req.user.name,
    role: req.user.role,
    currentPath: req.path,
    user_id: req.user.id
  });
});

// ---------------- User Details ---------------- (all roles)
dash.get('/userDetails', authenticateToken, async (req, res) => {
  try {
    const userRes = await pool.query(
      'SELECT id, email, full_name, role FROM users WHERE id=$1',
      [req.user.id]
    );
    const user = userRes.rows[0];
    res.json({
      user_id: user.id,
      email: user.email,
      name: user.full_name,
      role: user.role
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Unable to fetch user details' });
  }
});

// ---------------- Current Mood ---------------- (student only)
dash.get('/currentMood', authenticateToken, async (req, res) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ message: 'Only students can access current mood' });
  }
  try {
    const moodRes = await pool.query(
      'SELECT score, notes, created_at FROM mood_logs WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1',
      [req.user.id]
    );
    const mood = moodRes.rows[0];
    res.json({
      currentMood: mood ? { score: mood.score, notes: mood.notes } : { score: null, notes: null }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Unable to fetch current mood' });
  }
});

// ---------------- Recent Alert ---------------- (student only)
dash.get('/recentAlert', authenticateToken, async (req, res) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ message: 'Only students can access recent alerts' });
  }
  try {
    const alertRes = await pool.query(
      'SELECT message, type, created_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1',
      [req.user.id]
    );
    const alert = alertRes.rows[0];
    res.json({
      recentAlert: alert || { message: 'No alerts', type: null }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Unable to fetch recent alert' });
  }
});

// ---------------- Alert Stats ---------------- (staff only)
dash.get('/alertStats', authenticateToken, async (req, res) => {
  if (req.user.role !== 'staff') {
    return res.status(403).json({ message: 'Only staff can access alert stats' });
  }
  try {
    // Example: count notifications of type 'help' grouped by students
    const statsRes = await pool.query(
      `SELECT user_id, COUNT(*) AS help_count 
       FROM notifications 
       WHERE type='help' 
       GROUP BY user_id`
    );
    res.json({
      alertStats: statsRes.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Unable to fetch alert stats' });
  }
});

// ---------------- Staff Details ---------------- (staff/admin only)
dash.get('/staffDetails', authenticateToken, async (req, res) => {
  if (!['staff', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Access denied' });
  }
  try {
    const staffRes = await pool.query(
      'SELECT id, full_name, email FROM users WHERE role IN ($1, $2)',
      ['staff', 'admin']
    );
    res.json({
      staffDetails: staffRes.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Unable to fetch staff details' });
  }
});

// ---------------- Event Bookings ---------------- (staff/admin only)
dash.get('/eventBookings', authenticateToken, async (req, res) => {
  if (!['staff', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Access denied' });
  }
  try {
    const bookingsRes = await pool.query(
      `SELECT b.id AS booking_id, u.full_name AS student_name, e.title AS event_title, b.status
       FROM bookings b
       JOIN users u ON b.user_id = u.id
       JOIN events e ON b.event_id = e.id`
    );
    res.json({
      eventBookings: bookingsRes.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Unable to fetch event bookings' });
  }
});
//--student own booking 
dash.get('/myBookings', authenticateToken, async (req, res) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ message: 'Only students can access their bookings' });
  }

  try {
    const bookingsRes = await pool.query(
      `SELECT e.id AS event_id, e.title, e.type, e.location, e.event_date, e.event_time, b.status
       FROM bookings b
       JOIN events e ON b.event_id = e.id
       WHERE b.user_id = $1`,
      [req.user.id]
    );

    res.json({
      bookedEvents: bookingsRes.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Unable to fetch your booked events' });
  }
});
