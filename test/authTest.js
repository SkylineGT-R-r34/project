import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { app } from '../app.js';
import pool from '../db/db.js';

function startServer(port = 0) {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(port, () => resolve(server));
  });
}

function requestJSON(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      const setCookie = res.headers['set-cookie'];
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        let parsed = body;
        try { parsed = JSON.parse(body); } catch {}
        resolve({ status: res.statusCode, headers: res.headers, setCookie, body: parsed });
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

function requestWithCookie(options, cookie) {
  const opts = { ...options, headers: { ...(options.headers || {}), Cookie: cookie } };
  return new Promise((resolve, reject) => {
    const req = http.request(opts, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        let parsed = body;
        try { parsed = JSON.parse(body); } catch {}
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// Reset users before each test
test.beforeEach(async () => {
  await pool.query('TRUNCATE users RESTART IDENTITY CASCADE');
});

test('Register -> Login -> Access protected route with cookie JWT', async () => {
  const server = await startServer();
  const port = server.address().port;

  // Register
  const registerRes = await requestJSON({
    hostname: 'localhost',
    port,
    path: '/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'test@user.com', password: 'secret', fullName: 'Test User' });

  assert.equal(registerRes.status, 201);
  assert.equal(registerRes.body.user.email, 'test@user.com');
  // In current flow register also sets cookie; accept either here or via login

  // Login
  const loginRes = await requestJSON({
    hostname: 'localhost',
    port,
    path: '/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'test@user.com', password: 'secret' });

  assert.equal(loginRes.status, 200);
  assert.equal(loginRes.body.message, 'Login successful');
  const cookieHeader = loginRes.setCookie?.find(c => c.startsWith('token='));
  assert.ok(cookieHeader, 'Expected Set-Cookie: token=...');
  const cookie = cookieHeader.split(';')[0]; // token=...

  // Access a protected route
  const protectedRes = await requestWithCookie({
    hostname: 'localhost',
    port,
    path: '/events',
    method: 'GET'
  }, cookie);

  // Should not be redirected to login and not forbidden
  assert.notEqual(protectedRes.status, 302);
  assert.notEqual(protectedRes.status, 403);

  server.close();
});

test('Login fails with wrong password', async () => {
  const server = await startServer();
  const port = server.address().port;

  // Create user via register to ensure proper hashing
  await requestJSON({
    hostname: 'localhost',
    port,
    path: '/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'seed@user.com', password: 'password', fullName: 'Seed User' });

  const res = await requestJSON({
    hostname: 'localhost',
    port,
    path: '/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'seed@user.com', password: 'wrong' });

  assert.equal(res.status, 401);
  server.close();
});

// Close DB pool after tests
test.after(async () => {
  try { await pool.end(); } catch {}
});


