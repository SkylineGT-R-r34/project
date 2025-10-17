import express from 'express';
import pool from '../db/db.js';
import { authenticateToken } from '../middleware/auth.js';

export const dashboardRouter = express.Router();

    dashboardRouter.get('/', authenticateToken, async (req, res) => {
    const forcedJson = typeof req.query.format === 'string' && req.query.format.toLowerCase() === 'json';
    const accepted = req.accepts(['html', 'json']);
    const wantsJson = forcedJson || accepted === 'json' || req.xhr;

    if (!wantsJson) {
        const resolvedPath = req.baseUrl
        ? `${req.baseUrl}${req.path === '/' ? '' : req.path}`
        : req.path;

        return res.render('dashboard', {
        title: 'Dashboard',
        user: req.user,
        role: req.user?.role,
        currentPath: resolvedPath
        });
    }

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

    try {
        const fromParam = parseDate(req.query.from);
        const toParam = parseDate(req.query.to);

        const now = new Date();
        const defaultTo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        const toDate = toParam ?? defaultTo;
        const defaultFrom = new Date(toDate);
        defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 13);
        const fromDate = fromParam ?? defaultFrom;

        if (fromDate > toDate) {
        return res.status(400).json({
            error: 'Invalid date range: `from` must be before or equal to `to`.',
        });
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

        const response = {
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

        res.json(response);
    } catch (error) {
        console.error('Error building dashboard metrics:', error);
        res.status(500).json({
        error: 'Unable to build dashboard metrics.',
        details: error.message,
        });
    }
    });
