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

// Reset DB and insert test users
test.beforeEach(async () => {
  await pool.query('TRUNCATE posts, connections, users RESTART IDENTITY CASCADE');
  await pool.query(`
    INSERT INTO users (id, email, password, full_name, role)
    VALUES 
      (1, 'user1@test.com', 'password1', 'User One', 'student'),
      (2, 'user2@test.com', 'password2', 'User Two', 'student'),
      (3, 'user3@test.com', 'password3', 'User Three', 'student')
  `);
});

// ==================== POSTS TESTS ====================

test('GET /social/posts should return all posts', async () => {
  const server = await startServer();
  const port = server.address().port;

  // Insert test posts
  await pool.query(`
    INSERT INTO posts (user_id, content)
    VALUES 
      (1, 'First post by user 1'),
      (2, 'First post by user 2'),
      (1, 'Second post by user 1')
  `);

  const res = await makeRequest({
    hostname: 'localhost',
    port,
    path: '/social/posts',
    method: 'GET'
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.length, 3);
  assert.equal(res.body[0].content, 'Second post by user 1'); // Most recent first
  assert.equal(res.body[0].full_name, 'User One');

  server.close();
});

test('GET /social/posts with user_id filter should return user posts only', async () => {
  const server = await startServer();
  const port = server.address().port;

  // Insert test posts
  await pool.query(`
    INSERT INTO posts (user_id, content)
    VALUES 
      (1, 'Post by user 1'),
      (2, 'Post by user 2')
  `);

  const res = await makeRequest({
    hostname: 'localhost',
    port,
    path: '/social/posts?user_id=1',
    method: 'GET'
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.length, 1);
  assert.equal(res.body[0].content, 'Post by user 1');
  assert.equal(res.body[0].user_id, 1);

  server.close();
});

test('POST /social/posts should create a new post', async () => {
  const server = await startServer();
  const port = server.address().port;

  const payload = {
    user_id: 1,
    content: 'Test post content'
  };

  const res = await makeRequest({
    hostname: 'localhost',
    port,
    path: '/social/posts',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, payload);

  assert.equal(res.status, 201);
  assert.equal(res.body.user_id, 1);
  assert.equal(res.body.content, 'Test post content');
  assert.ok(res.body.id);

  server.close();
});

test('POST /social/posts with missing fields should return error', async () => {
  const server = await startServer();
  const port = server.address().port;

  const payload = {
    user_id: 1
    // Missing content
  };

  const res = await makeRequest({
    hostname: 'localhost',
    port,
    path: '/social/posts',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, payload);

  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'user_id and content are required');

  server.close();
});

// ==================== CONNECTIONS TESTS ====================

test('POST /social/connections should send friend request', async () => {
  const server = await startServer();
  const port = server.address().port;

  const payload = {
    requester_id: 1,
    target_user_id: 2
  };

  const res = await makeRequest({
    hostname: 'localhost',
    port,
    path: '/social/connections',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, payload);

  assert.equal(res.status, 201);
  assert.equal(res.body.status, 'pending');
  assert.equal(res.body.requester_id, 1);
  assert.ok(res.body.id);

  server.close();
});

test('POST /social/connections with same user should return error', async () => {
  const server = await startServer();
  const port = server.address().port;

  const payload = {
    requester_id: 1,
    target_user_id: 1
  };

  const res = await makeRequest({
    hostname: 'localhost',
    port,
    path: '/social/connections',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, payload);

  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'Cannot send friend request to yourself');

  server.close();
});

test('POST /social/connections with duplicate should return error', async () => {
  const server = await startServer();
  const port = server.address().port;

  // Create initial connection
  await pool.query(`
    INSERT INTO connections (user1_id, user2_id, requester_id, status)
    VALUES (1, 2, 1, 'pending')
  `);

  const payload = {
    requester_id: 1,
    target_user_id: 2
  };

  const res = await makeRequest({
    hostname: 'localhost',
    port,
    path: '/social/connections',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, payload);

  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'Friend request already pending');

  server.close();
});

test('GET /social/connections should return user friends', async () => {
  const server = await startServer();
  const port = server.address().port;

  // Create connected users
  await pool.query(`
    INSERT INTO connections (user1_id, user2_id, requester_id, status, connected_at)
    VALUES (1, 2, 1, 'connected', NOW())
  `);

  const res = await makeRequest({
    hostname: 'localhost',
    port,
    path: '/social/connections?user_id=1',
    method: 'GET'
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.length, 1);
  assert.equal(res.body[0].friend_id, 2);
  assert.equal(res.body[0].friend_name, 'User Two');
  assert.equal(res.body[0].status, 'connected');

  server.close();
});

test('GET /social/connections/requests should return pending requests', async () => {
  const server = await startServer();
  const port = server.address().port;

  // Create pending request
  await pool.query(`
    INSERT INTO connections (user1_id, user2_id, requester_id, status)
    VALUES (1, 2, 1, 'pending')
  `);

  const res = await makeRequest({
    hostname: 'localhost',
    port,
    path: '/social/connections/requests?user_id=2',
    method: 'GET'
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.length, 1);
  assert.equal(res.body[0].requester_id, 1);
  assert.equal(res.body[0].requester_name, 'User One');
  assert.equal(res.body[0].status, 'pending');

  server.close();
});

test('PUT /social/connections/:id should accept friend request', async () => {
  const server = await startServer();
  const port = server.address().port;

  // Create pending request
  const connectionResult = await pool.query(`
    INSERT INTO connections (user1_id, user2_id, requester_id, status)
    VALUES (1, 2, 1, 'pending')
    RETURNING id
  `);
  const connectionId = connectionResult.rows[0].id;

  const payload = {
    user_id: 2,
    action: 'accept'
  };

  const res = await makeRequest({
    hostname: 'localhost',
    port,
    path: `/social/connections/${connectionId}`,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' }
  }, payload);

  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'connected');
  assert.ok(res.body.connected_at);

  server.close();
});

test('PUT /social/connections/:id should reject friend request', async () => {
  const server = await startServer();
  const port = server.address().port;

  // Create pending request
  const connectionResult = await pool.query(`
    INSERT INTO connections (user1_id, user2_id, requester_id, status)
    VALUES (1, 2, 1, 'pending')
    RETURNING id
  `);
  const connectionId = connectionResult.rows[0].id;

  const payload = {
    user_id: 2,
    action: 'reject'
  };

  const res = await makeRequest({
    hostname: 'localhost',
    port,
    path: `/social/connections/${connectionId}`,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' }
  }, payload);

  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'rejected');

  server.close();
});

test('DELETE /social/connections/:id should remove connection', async () => {
  const server = await startServer();
  const port = server.address().port;

  // Create connected users
  const connectionResult = await pool.query(`
    INSERT INTO connections (user1_id, user2_id, requester_id, status, connected_at)
    VALUES (1, 2, 1, 'connected', NOW())
    RETURNING id
  `);
  const connectionId = connectionResult.rows[0].id;

  const payload = {
    user_id: 1
  };

  const res = await makeRequest({
    hostname: 'localhost',
    port,
    path: `/social/connections/${connectionId}`,
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' }
  }, payload);

  assert.equal(res.status, 200);
  assert.equal(res.body.message, 'Connection removed successfully');

  // Verify connection is deleted
  const checkResult = await pool.query(
    'SELECT * FROM connections WHERE id = $1',
    [connectionId]
  );
  assert.equal(checkResult.rows.length, 0);

  server.close();
});

// ==================== INTEGRATION TESTS ====================

test('Complete friend request workflow', async () => {
  const server = await startServer();
  const port = server.address().port;

  // Step 1: User 1 sends friend request to User 2
  const requestPayload = {
    requester_id: 1,
    target_user_id: 2
  };

  const requestRes = await makeRequest({
    hostname: 'localhost',
    port,
    path: '/social/connections',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, requestPayload);

  assert.equal(requestRes.status, 201);
  const connectionId = requestRes.body.id;

  // Step 2: User 2 sees pending request
  const pendingRes = await makeRequest({
    hostname: 'localhost',
    port,
    path: '/social/connections/requests?user_id=2',
    method: 'GET'
  });

  assert.equal(pendingRes.status, 200);
  assert.equal(pendingRes.body.length, 1);

  // Step 3: User 2 accepts request
  const acceptPayload = {
    user_id: 2,
    action: 'accept'
  };

  const acceptRes = await makeRequest({
    hostname: 'localhost',
    port,
    path: `/social/connections/${connectionId}`,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' }
  }, acceptPayload);

  assert.equal(acceptRes.status, 200);
  assert.equal(acceptRes.body.status, 'connected');

  // Step 4: Both users see each other as friends
  const friends1Res = await makeRequest({
    hostname: 'localhost',
    port,
    path: '/social/connections?user_id=1',
    method: 'GET'
  });

  const friends2Res = await makeRequest({
    hostname: 'localhost',
    port,
    path: '/social/connections?user_id=2',
    method: 'GET'
  });

  assert.equal(friends1Res.status, 200);
  assert.equal(friends2Res.status, 200);
  assert.equal(friends1Res.body.length, 1);
  assert.equal(friends2Res.body.length, 1);

  server.close();
});

// ==================== ERROR HANDLING TESTS ====================

test('Social API should handle database errors gracefully', async () => {
  const server = await startServer();
  const port = server.address().port;

  // Mock the pool.query to throw an error
  const originalQuery = pool.query;
  pool.query = () => Promise.reject(new Error('Database connection failed'));

  const res = await makeRequest({
    hostname: 'localhost',
    port,
    path: '/social/posts',
    method: 'GET'
  });

  assert.equal(res.status, 500);
  assert.equal(res.body, 'Server error');

  // Restore original query method
  pool.query = originalQuery;

  server.close();
});

// Close DB pool after all tests
test.after(async () => {
  try {
    await pool.end();
  } catch (err) {
    // Pool might already be closed
  }
});
