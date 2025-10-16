import express from 'express';
import pool from '../db/db.js';

export const dashboardRouter = express.Router();

const parseDate = (value) => {
  if (!value) {
    return null;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDate = (date) => {
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  return utcDate.toISOString().split('T')[0];
};

const buildDashboardData = async ({ from: fromRaw, to: toRaw }) => {
  const fromParam = parseDate(fromRaw);
  const toParam = parseDate(toRaw);

  const now = new Date();
  const defaultTo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const toDate = toParam ?? defaultTo;
  const defaultFrom = new Date(toDate);
  defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 13);
  const fromDate = fromParam ?? defaultFrom;

  if (fromDate > toDate) {
    const error = new Error('Invalid date range: `from` must be before or equal to `to`.');
    error.statusCode = 400;
    throw error;
  }

  const fromDateStr = formatDate(fromDate);
  const toDateStr = formatDate(toDate);

  const [hasMoodScoreResult, eventCategoryColumnResult] = await Promise.all([
    pool.query(
      `SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'mood_logs'
          AND column_name = 'mood_score'
      ) AS has_mood_score`
    ),
    pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_name = 'events'
         AND column_name IN ('category', 'type')
       ORDER BY CASE WHEN column_name = 'category' THEN 0 ELSE 1 END
       LIMIT 1`
    ),
  ]);

  const hasMoodScore = Boolean(hasMoodScoreResult.rows[0]?.has_mood_score);
  const availableEventCategoryColumn = eventCategoryColumnResult.rows[0]?.column_name;
  const eventCategoryColumn = ['category', 'type'].includes(availableEventCategoryColumn)
    ? availableEventCategoryColumn
    : 'type';

  const [
    upcomingEventsCountResult,
    eventsByCategoryTop5Result,
    moodLogsTotalResult,
    connectionsTotalResult,
    moodTrendDailyResult,
    eventsByCategoryResult,
    upcomingEventsListResult,
    recentMoodsResult,
    recentConnectionsResult,
  ] = await Promise.all([
    pool.query(`SELECT COUNT(*) AS count FROM events WHERE event_date >= NOW()`),
    pool.query(
      `SELECT ${eventCategoryColumn} AS category, COUNT(*) AS count
       FROM events
       GROUP BY ${eventCategoryColumn}
       ORDER BY count DESC
       LIMIT 5`
    ),
    pool.query(
      `SELECT COUNT(*) AS count
       FROM mood_logs
       WHERE created_at::date BETWEEN $1 AND $2`,
      [fromDateStr, toDateStr]
    ),
    pool.query(`SELECT COUNT(*) AS count FROM connections`),
    pool.query(
      `SELECT TO_CHAR(created_at::date, 'YYYY-MM-DD') AS day, COUNT(*) AS count
       FROM mood_logs
       WHERE created_at::date BETWEEN $1 AND $2
       GROUP BY day
       ORDER BY day`,
      [fromDateStr, toDateStr]
    ),
    pool.query(
      `SELECT ${eventCategoryColumn} AS category, COUNT(*) AS count
       FROM events
       GROUP BY ${eventCategoryColumn}
       ORDER BY count DESC`
    ),
    pool.query(
      `SELECT id, title, ${eventCategoryColumn} AS category, event_date, event_time, location
       FROM events
       WHERE event_date >= NOW()
       ORDER BY event_date ASC, event_time ASC
       LIMIT 10`
    ),
    pool.query(
      `SELECT *
       FROM mood_logs
       ORDER BY created_at DESC
       LIMIT 10`
    ),
    pool.query(
      `SELECT *
       FROM connections
       ORDER BY created_at DESC
       LIMIT 10`
    ),
  ]);

  const weeklyAvgMoodResult = hasMoodScore
    ? await pool.query(
        `SELECT TO_CHAR(date_trunc('week', created_at), 'IYYY-IW') AS week, AVG(mood_score)::numeric(10,2) AS avg_score
         FROM mood_logs
         WHERE created_at::date BETWEEN $1 AND $2
         GROUP BY week
         ORDER BY week`,
        [fromDateStr, toDateStr]
      )
    : null;

  return {
    filters: {
      from: fromDateStr,
      to: toDateStr,
    },
    kpis: {
      upcomingEvents: Number(upcomingEventsCountResult.rows[0]?.count ?? 0),
      eventsByCategoryTop5: eventsByCategoryTop5Result.rows.map((row) => ({
        category: row.category,
        count: Number(row.count),
      })),
      moodLogsTotalInRange: Number(moodLogsTotalResult.rows[0]?.count ?? 0),
      connectionsTotal: Number(connectionsTotalResult.rows[0]?.count ?? 0),
      weeklyAvgMood: hasMoodScore
        ? weeklyAvgMoodResult.rows.map((row) => ({
            week: row.week,
            avgScore: Number(row.avg_score),
          }))
        : null,
    },
    charts: {
      moodTrendDaily: moodTrendDailyResult.rows.map((row) => ({
        day: row.day,
        count: Number(row.count),
      })),
      eventsByCategory: eventsByCategoryResult.rows.map((row) => ({
        category: row.category,
        count: Number(row.count),
      })),
    },
    tables: {
      upcomingEvents: upcomingEventsListResult.rows,
      recentMoods: recentMoodsResult.rows,
      recentConnections: recentConnectionsResult.rows,
    },
    meta: {
      hasMoodScore,
      notes: [
        'Date filters default to the last 14 days when not provided.',
        'Aggregated metrics derived from events, mood_logs, and connections tables.',
        `Event category aggregations use the "${eventCategoryColumn}" column when available.`,
      ],
    },
  };
};

const respondWithError = (res, error) => {
  console.error('Error building dashboard metrics:', error);
  const status = error.statusCode ?? 500;
  res.status(status).json({
    error: 'Unable to build dashboard metrics.',
    details: error.message,
  });
};

dashboardRouter.get('/data', async (req, res) => {
  try {
    const dashboard = await buildDashboardData(req.query);
    res.json(dashboard);
  } catch (error) {
    respondWithError(res, error);
  }
});

dashboardRouter.get('/', async (req, res) => {
  const wantsJson = req.query.format === 'json' || req.accepts(['html', 'json']) === 'json';

  try {
    const dashboard = await buildDashboardData(req.query);

    if (wantsJson) {
      return res.json(dashboard);
    }

    res.render('dashboard/index', {
      title: 'Wellness Dashboard',
      dashboard,
    });
  } catch (error) {
    if (wantsJson) {
      return respondWithError(res, error);
    }

    console.error('Error rendering dashboard UI:', error);
    res.status(error.statusCode ?? 500).render('error', {
      title: 'Dashboard Error',
      message: 'Unable to load dashboard metrics.',
      error,
    });
  }
});

export { buildDashboardData };
