import express from "express";
import pool from "../db/db.js";
import { authenticateToken } from "../middleware/auth.js";

export const socialRouter = express.Router();

socialRouter.get("/", authenticateToken, (req, res) => {
  const resolvedPath = req.baseUrl
    ? `${req.baseUrl}${req.path === '/' ? '' : req.path}`
    : req.path;

  res.render("social", {
    title: "Social hub",
    user: req.user,
    currentPath: resolvedPath,
    results: [],
    requests: { incoming: [], outgoing: [] },
    connections: []
  });
});

// ==================== POSTS ENDPOINTS ====================

socialRouter.get('/people', authenticateToken, async (req, res) => {
  const searchTerm = (req.query.q || '').toString().trim();
  if (searchTerm.length < 2) {
    return res.json([]);
  }
  try {
    const result = await pool.query(
      `SELECT id, full_name, email
       FROM users
       WHERE id <> $1
         AND (full_name ILIKE $2 OR email ILIKE $2)
       ORDER BY full_name ASC
       LIMIT 20`,
      [req.user.id, `%${searchTerm}%`]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('People search error:', error);
    res.status(500).json({ message: 'Unable to search people' });
  }
});

// GET /posts - Get all posts (with optional user filter)
socialRouter.get("/posts", async (req, res) => {
  try {
    const { user_id, limit = 50, offset = 0 } = req.query;

    let sql = `
      SELECT p.*, u.full_name, u.email 
      FROM posts p 
      JOIN users u ON p.user_id = u.id
    `;
    let params = [];
    let paramCount = 0;

    if (user_id) {
      sql += ` WHERE p.user_id = $${++paramCount}`;
      params.push(user_id);
    }

    sql += ` ORDER BY p.created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// POST /posts - Create a new post
socialRouter.post("/posts", async (req, res) => {
  try {
    const { user_id, content } = req.body;

    if (!user_id || !content) {
      return res.status(400).json({ error: "user_id and content are required" });
    }

    const result = await pool.query(
      `INSERT INTO posts (user_id, content) 
       VALUES ($1, $2) 
       RETURNING *`,
      [user_id, content]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// ==================== CONNECTIONS/FRIENDS ENDPOINTS ====================

// GET /connections - Get user's connections (friends)
socialRouter.get("/connections", async (req, res) => {
  try {
    const { user_id, status = 'connected' } = req.query;

    if (!user_id) {
      return res.status(400).json({ error: "user_id is required" });
    }

    const sql = `
      SELECT 
        c.id as connection_id,
        c.status,
        c.connected_at,
        c.created_at,
        CASE 
          WHEN c.user1_id = $1 THEN u2.id
          ELSE u1.id
        END as friend_id,
        CASE 
          WHEN c.user1_id = $1 THEN u2.full_name
          ELSE u1.full_name
        END as friend_name,
        CASE 
          WHEN c.user1_id = $1 THEN u2.email
          ELSE u1.email
        END as friend_email
      FROM connections c
      JOIN users u1 ON c.user1_id = u1.id
      JOIN users u2 ON c.user2_id = u2.id
      WHERE (c.user1_id = $1 OR c.user2_id = $1)
      AND c.status = $2
      ORDER BY c.connected_at DESC
    `;

    const result = await pool.query(sql, [user_id, status]);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// GET /connections/requests - Get pending friend requests
socialRouter.get("/connections/requests", async (req, res) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({ error: "user_id is required" });
    }

    const sql = `
      SELECT 
        c.id as connection_id,
        c.status,
        c.created_at,
        c.requester_id,
        u.full_name as requester_name,
        u.email as requester_email
      FROM connections c
      JOIN users u ON c.requester_id = u.id
      WHERE (c.user1_id = $1 OR c.user2_id = $1)
      AND c.status = 'pending'
      ORDER BY c.created_at DESC
    `;

    const result = await pool.query(sql, [user_id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// POST /connections - Send friend request
socialRouter.post("/connections", async (req, res) => {
  try {
    const { requester_id, target_user_id } = req.body;

    if (!requester_id || !target_user_id) {
      return res.status(400).json({ error: "requester_id and target_user_id are required" });
    }

    if (requester_id === target_user_id) {
      return res.status(400).json({ error: "Cannot send friend request to yourself" });
    }

    // Check if users exist
    const userCheck = await pool.query(
      `SELECT id FROM users WHERE id IN ($1, $2)`,
      [requester_id, target_user_id]
    );

    if (userCheck.rows.length !== 2) {
      return res.status(400).json({ error: "One or both users do not exist" });
    }

    // Check if connection already exists
    const existingConnection = await pool.query(
      `SELECT id, status FROM connections 
       WHERE (user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1)`,
      [requester_id, target_user_id]
    );

    if (existingConnection.rows.length > 0) {
      const connection = existingConnection.rows[0];
      if (connection.status === 'connected') {
        return res.status(400).json({ error: "Users are already connected" });
      } else if (connection.status === 'pending') {
        return res.status(400).json({ error: "Friend request already pending" });
      }
    }

    // Create friend request (always store smaller user_id first for consistency)
    const user1_id = Math.min(requester_id, target_user_id);
    const user2_id = Math.max(requester_id, target_user_id);

    const result = await pool.query(
      `INSERT INTO connections (user1_id, user2_id, requester_id, status) 
       VALUES ($1, $2, $3, 'pending') 
       RETURNING *`,
      [user1_id, user2_id, requester_id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// PUT /connections/:connection_id - Accept or reject friend request
socialRouter.put("/connections/:connection_id", async (req, res) => {
  try {
    const { connection_id } = req.params;
    const { user_id, action } = req.body; // action: 'accept' or 'reject'

    if (!user_id || !action) {
      return res.status(400).json({ error: "user_id and action are required" });
    }

    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({ error: "action must be 'accept' or 'reject'" });
    }

    // Check if connection exists and user is part of it
    const connectionCheck = await pool.query(
      `SELECT * FROM connections 
       WHERE id = $1 AND (user1_id = $2 OR user2_id = $2) AND status = 'pending'`,
      [connection_id, user_id]
    );

    if (connectionCheck.rows.length === 0) {
      return res.status(404).json({ error: "Connection not found or not pending" });
    }

    const newStatus = action === 'accept' ? 'connected' : 'rejected';
    const connectedAt = action === 'accept' ? 'NOW()' : null;

    const result = await pool.query(
      `UPDATE connections 
       SET status = $1, connected_at = ${connectedAt}
       WHERE id = $2 
       RETURNING *`,
      [newStatus, connection_id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// DELETE /connections/:connection_id - Remove friend connection
socialRouter.delete("/connections/:connection_id", async (req, res) => {
  try {
    const { connection_id } = req.params;
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: "user_id is required" });
    }

    // Check if connection exists and user is part of it
    const connectionCheck = await pool.query(
      `SELECT * FROM connections 
       WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)`,
      [connection_id, user_id]
    );

    if (connectionCheck.rows.length === 0) {
      return res.status(404).json({ error: "Connection not found" });
    }

    await pool.query(`DELETE FROM connections WHERE id = $1`, [connection_id]);

    res.json({ message: "Connection removed successfully" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});
