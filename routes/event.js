import express from "express";
import pool from "../db/db.js";

export const eventRouter = express.Router();

eventRouter.get("/", async (req, res) => {
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
