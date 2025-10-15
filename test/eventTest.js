import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { app } from '../app.js';
import pool from '../db/db.js';

// Helper: start server
function startServer(port = 0) {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(port, () => resolve(server));
  });
}

// Helper: make HTTP request
function makeRequest(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

// Reset DB and insert test events
test.beforeEach(async () => {
  await pool.query('TRUNCATE events, bookings, users RESTART IDENTITY CASCADE');
  await pool.query(`
    INSERT INTO events (title, description, event_date, event_time, location, type, capacity)
    VALUES 
      ('Study Group', 'Math study session', '2024-01-15', '14:00:00', 'Library Room A', 'academic', 10),
      ('Campus Tour', 'New student orientation', '2024-01-20', '10:00:00', 'Main Campus', 'social', 25),
      ('Career Workshop', 'Resume building workshop', '2024-01-25', '16:00:00', 'Career Center', 'professional', 15)
  `);
});

// GET /events tests
test('GET /events should return all events', async () => {
  const server = await startServer();
  const port = server.address().port;

  const res = await makeRequest({
    hostname: 'localhost',
    port,
    path: '/events',
    method: 'GET'
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.length, 3);
  assert.equal(res.body[0].title, 'Study Group');
  assert.equal(res.body[1].title, 'Campus Tour');
  assert.equal(res.body[2].title, 'Career Workshop');

  server.close();
});

test('GET /events?search=study should return filtered events', async () => {
  const server = await startServer();
  const port = server.address().port;

  const res = await makeRequest({
    hostname: 'localhost',
    port,
    path: '/events?search=study',
    method: 'GET'
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.length, 1);
  assert.equal(res.body[0].title, 'Study Group');

  server.close();
});

test('GET /events?search=campus should return filtered events', async () => {
  const server = await startServer();
  const port = server.address().port;

  const res = await makeRequest({
    hostname: 'localhost',
    port,
    path: '/events?search=campus',
    method: 'GET'
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.length, 1);
  assert.equal(res.body[0].title, 'Campus Tour');

  server.close();
});

test('GET /events?search=nonexistent should return empty array', async () => {
  const server = await startServer();
  const port = server.address().port;

  const res = await makeRequest({
    hostname: 'localhost',
    port,
    path: '/events?search=nonexistent',
    method: 'GET'
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.length, 0);

  server.close();
});

// POST /events tests
test('POST /events should create a new event', async () => {
  const server = await startServer();
  const port = server.address().port;

  const payload = {
    title: 'New Event',
    description: 'Test event description',
    evDate: '2024-02-01',
    evTime: '18:00:00',
    location: 'Test Location',
    type: 'test',
    capacity: 20
  };

  const res = await makeRequest({
    hostname: 'localhost',
    port,
    path: '/events',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, payload);

  assert.equal(res.status, 201);
  assert.ok(res.body.title, 'Response should have title');
  assert.ok(res.body.id, 'Response should have ID');

  server.close();
});

test('POST /events with minimal data should create event', async () => {
  const server = await startServer();
  const port = server.address().port;

  const payload = {
    title: 'Minimal Event',
    description: null,
    evDate: '2024-02-01',
    evTime: '12:00:00',
    location: null,
    type: null,
    capacity: null
  };

  const res = await makeRequest({
    hostname: 'localhost',
    port,
    path: '/events',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, payload);

  assert.equal(res.status, 201);
  assert.ok(res.body.title, 'Response should have title');
  assert.ok(res.body.id, 'Response should have ID');

  server.close();
});

// Error handling tests
test('POST /events with missing required fields should handle error', async () => {
  const server = await startServer();
  const port = server.address().port;

  const payload = {
    // Missing title and other required fields
    description: 'Test description'
  };

  const res = await makeRequest({
    hostname: 'localhost',
    port,
    path: '/events',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, payload);

  // Should return 500 due to database constraint violation
  assert.equal(res.status, 500);
  assert.equal(res.body, 'Server error');

  server.close();
});

test('GET /events should handle database errors gracefully', async () => {
  const server = await startServer();
  const port = server.address().port;

  // Create a new pool to simulate database error
  const { Pool } = await import('pg');
  const badPool = new Pool({
    host: 'invalid-host',
    user: 'invalid-user',
    password: 'invalid-password',
    database: 'invalid-db',
    port: 9999
  });

  // Mock the pool.query to throw an error
  const originalQuery = pool.query;
  pool.query = () => Promise.reject(new Error('Database connection failed'));

  const res = await makeRequest({
    hostname: 'localhost',
    port,
    path: '/events',
    method: 'GET'
  });

  assert.equal(res.status, 500);
  assert.equal(res.body, 'Server error');

  // Restore original query method
  pool.query = originalQuery;
  await badPool.end();

  server.close();
});

// Close DB pool after all tests
test.after(async () => {
  try {
    await pool.end();
  } catch (err) {
    console.error(err.message);
  }
});
