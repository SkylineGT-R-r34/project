import express from 'express';
import pool from '../db/db.js';
import { authenticateToken } from '../middleware/auth.js';

export const dashboardRouter = express.Router();

dashboardRouter.get('/', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.redirect('/auth/login');
    }

    const [upcomingEventsCountResult, upcomingEventsResult, recentMoodsResult, connectionsCountResult, moodDaysResult] =
      await Promise.all([
        pool.query('SELECT COUNT(*) AS count FROM events WHERE event_date >= CURRENT_DATE'),
        pool.query(
          `SELECT id, title, event_date, event_time, location
             FROM events
            WHERE event_date >= CURRENT_DATE
            ORDER BY event_date ASC, event_time ASC
            LIMIT 5`
        ),
        pool.query(
          `SELECT id, score, notes, created_at
             FROM mood_logs
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT 5`,
          [user.id]
        ),
        pool.query(
          `SELECT COUNT(*) AS count
             FROM connections
            WHERE user1_id = $1 OR user2_id = $1`,
          [user.id]
        ),
        pool.query(
          `SELECT created_at::date AS day
             FROM mood_logs
            WHERE user_id = $1
            ORDER BY day DESC
            LIMIT 30`,
          [user.id]
        ),
      ]);

    const upcomingEventsCount = Number(upcomingEventsCountResult.rows[0]?.count ?? 0);
    const connectionsCount = Number(connectionsCountResult.rows[0]?.count ?? 0);

    const uniqueMoodDays = [];
    const seenMoodDays = new Set();
    moodDaysResult.rows.forEach(({ day }) => {
      if (!day) return;
      const dayStr = day instanceof Date ? day.toISOString().slice(0, 10) : String(day);
      if (!seenMoodDays.has(dayStr)) {
        seenMoodDays.add(dayStr);
        uniqueMoodDays.push(dayStr);
      }
    });

    uniqueMoodDays.sort((a, b) => (a === b ? 0 : a < b ? 1 : -1));

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    let streak = 0;
    let cursor = new Date(today);

    for (const dayStr of uniqueMoodDays) {
      const dayDate = new Date(`${dayStr}T00:00:00Z`);
      if (dayDate.getTime() === cursor.getTime()) {
        streak += 1;
        cursor = new Date(cursor);
        cursor.setUTCDate(cursor.getUTCDate() - 1);
      } else if (dayDate.getTime() > cursor.getTime()) {
        // Skip duplicate entries within the same day that might appear later in the array
        continue;
      } else {
        break;
      }
    }

    const currentPath = (`${req.baseUrl || ''}${req.path || ''}`).replace(/\/+$/, '') || '/';

    res.render('dashboard', {
      title: 'Dashboard',
      user,
      role: user.role,
      currentPath,
      stats: {
        upcomingEventsCount,
        moodStreakDays: streak,
        connectionsCount,
      },
      recentEvents: upcomingEventsResult.rows,
      recentMoods: recentMoodsResult.rows,
    });
  } catch (error) {
    console.error('Error loading dashboard:', error);
    res.status(500).render('error', {
      title: 'Dashboard Error',
      message: 'Unable to load dashboard right now.',
      error,
    });
  }
});
