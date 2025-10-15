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

// Reset DB and insert test user
test.beforeEach(async () => {
  await pool.query('TRUNCATE mood_logs, notifications, users RESTART IDENTITY CASCADE');
  await pool.query(`
    INSERT INTO users (id, email, password, full_name, role)
    VALUES (1, 'test@user.com', 'password', 'Test User', 'student')
  `);
});

// GET test
test('GET /moodTracking should return empty array initially', async () => {
  const server = await startServer();
  const port = server.address().port;

  const res = await makeRequest({
    hostname: 'localhost',
    port,
    path: '/moodTracking',
    method: 'GET'
  });

  assert.equal(res.status, 200);
  assert.deepEqual(res.body, []);

  server.close();
});

// POST test
test('POST /moodTracking adds a new mood', async () => {
  const server = await startServer();
  const port = server.address().port;

  const payload = {user_id: 1, score: 5, notes: 'Happy' };
  const postRes = await makeRequest({
    hostname: 'localhost',
    port,
    path: '/moodTracking',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, payload);

  assert.equal(postRes.status, 200);
  assert.equal(postRes.body.user_id, 1);
  assert.equal(postRes.body.score, 5);
  assert.equal(postRes.body.notes, 'Happy');
  server.close();
});

// Close DB pool after all tests
test.after(async () => {
  await pool.end();
});
