import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';

// Keep the API smoke tests independent of a developer's real .env and MySQL.
process.env.DB_NAME = '';
process.env.DB_USER = '';
const { app } = await import('../src/app.js');
const { env } = await import('../src/config/env.js');
let server;
let base;

before(async () => {
  server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    instance.once('error', reject);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server)
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
});

test('server health does not require MySQL credentials', async () => {
  const response = await fetch(`${base}/api/health`);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.success, true);
  assert.equal(data.database, 'not_configured');
  assert.equal(response.headers.get('x-powered-by'), null);
});

test('database health reports missing configuration rather than success', async () => {
  const response = await fetch(`${base}/api/health/database`);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).success, false);
});

test('marketplace reports missing MySQL configuration with a localized error', async () => {
  const response = await fetch(`${base}/api/marketplace/listings`);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).success, false);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('unknown endpoints return a localized JSON 404', async () => {
  const response = await fetch(`${base}/api/unknown`);
  assert.equal(response.status, 404);
  assert.equal((await response.json()).message, 'অনুরোধ করা ঠিকানাটি খুঁজে পাওয়া যায়নি।');
});

test('configured frontend origin receives CORS headers', async () => {
  const response = await fetch(`${base}/api/health`, { headers: { Origin: env.clientOrigin } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), env.clientOrigin);
});

test('an unrelated origin is rejected', async () => {
  const response = await fetch(`${base}/api/health`, {
    headers: { Origin: 'https://untrusted.example' },
  });
  assert.equal(response.status, 403);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
});

test('malformed JSON returns a localized error without a stack trace', async () => {
  const response = await fetch(`${base}/api/unknown`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{',
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { success: false, message: 'অনুরোধের তথ্য সঠিক নয়।' });
});
