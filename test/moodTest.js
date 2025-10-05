import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import bcrypt from 'bcryptjs';
import { app } from '../app.js';
import pool from '../db/db.js';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'testsecret';

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
  const hashedPassword = await bcrypt.hash('password', 10);
  await pool.query(
    `
    INSERT INTO users (id, email, password, full_name, role)
    VALUES (1, 'test@user.com', $1, 'Test User', 'student')
  `,
    [hashedPassword]
  );
});

async function loginAndGetToken(port) {
  const response = await makeRequest(
    {
      hostname: 'localhost',
      port,
      path: '/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    },
    { email: 'test@user.com', password: 'password' }
  );

  assert.equal(response.status, 200);
  assert.ok(response.body.token, 'Expected login response to include a token');
  return response.body.token;
}

// GET test
test('GET /moodTracking should return empty array initially', async () => {
  const server = await startServer();
  try {
    const port = server.address().port;
    const token = await loginAndGetToken(port);

    const res = await makeRequest({
      hostname: 'localhost',
      port,
      path: '/moodTracking',
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` }
    });

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);
  } finally {
    server.close();
  }
});

// POST test
test('POST /moodTracking adds a new mood', async () => {
  const server = await startServer();
  try {
    const port = server.address().port;
    const token = await loginAndGetToken(port);

    const payload = { score: 5, notes: 'Happy' };
    const postRes = await makeRequest({
      hostname: 'localhost',
      port,
      path: '/moodTracking',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    }, payload);

    assert.equal(postRes.status, 200);
    assert.equal(postRes.body.user_id, 1);
    assert.equal(postRes.body.score, 5);
    assert.equal(postRes.body.notes, 'Happy');
  } finally {
    server.close();
  }
});

// Close DB pool after all tests
test.after(async () => {
  await pool.end();
});
