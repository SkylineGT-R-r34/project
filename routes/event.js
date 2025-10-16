import express from "express";
import pool from "../db/db.js";
import { authenticateToken } from "../middleware/auth.js";
export const eventRouter = express.Router();
// Render events page

eventRouter.get('/event',authenticateToken,(req, res) => {
  const role = req.user?.role || 'student'; 
  res.render('event', {
    title: 'Events',
    role: req.user.role,      
    currentPath: req.path,
    user_id: req.user.id
  });
});
eventRouter.get("/", authenticateToken,async (req, res) => {
  try {
    const { search } = req.query;

    let sql = "SELECT * FROM events";
    let params = [];

    if (search) {
      sql += " WHERE title ILIKE $1";
      params.push(`%${search}%`);
    }

    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});
eventRouter.post("/", async (req, res) => {
  try {
    const { title, description, evDate, evTime, location, type, capacity } =
      req.body;

    const result = await pool.query(
      `INSERT INTO events (title, description, event_date, event_time, location, type, capacity)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [title, description, evDate, evTime, location, type, capacity],
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});
//book event
eventRouter.post("/book/:id",authenticateToken, async (req, res) => {
  const eventId = req.params.id;
   const user_id = req.user.id;

  if (!user_id) {
    return res.status(400).json({ message: 'User ID is required' });
  }

  try {
    // Check if the booking already exists
    const checkQuery = 'SELECT * FROM bookings WHERE user_id = $1 AND event_id = $2';
    const checkResult = await pool.query(checkQuery, [user_id, eventId]);

    if (checkResult.rows.length > 0) {
      return res.status(400).json({ message: 'You have already booked this event.' });
    }

    // Insert new booking
    const insertQuery = `
      INSERT INTO bookings (user_id, event_id, status)
      VALUES ($1, $2, 'booked')
      RETURNING *
    `;
    const result = await pool.query(insertQuery, [user_id, eventId]);

    res.status(201).json({ message: 'Event booked successfully', booking: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error while booking event' });
  }
});