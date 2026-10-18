import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { createApp } from '../../app.js';

test('HTTP foundation handles health, unknown routes, and invalid bodies', async (t) => {
  const server = createServer(createApp());
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  t.after(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  });

  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing test port.');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  await t.test('root identifies the API', async () => {
    const response = await fetch(baseUrl);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.apiVersion, 'v1');
    assert.equal(response.headers.get('x-powered-by'), null);
  });

  await t.test('liveness works without a database connection', async () => {
    const response = await fetch(`${baseUrl}/api/v1/health/live`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.status, 'live');
  });

  await t.test('readiness does not claim a disconnected database is ready', async () => {
    const response = await fetch(`${baseUrl}/api/v1/health/ready`);
    assert.equal(response.status, 503);
    assert.equal((await response.json()).data.status, 'not_ready');
  });

  await t.test('unknown endpoints have a traceable JSON error', async () => {
    const response = await fetch(`${baseUrl}/api/v1/not-implemented`);
    const body = await response.json();
    assert.equal(response.status, 404);
    assert.equal(body.error.code, 'NOT_FOUND');
    assert.ok(body.requestId);
    assert.equal(body.requestId, response.headers.get('x-request-id'));
  });

  await t.test('malformed JSON returns 400', async () => {
    const response = await fetch(`${baseUrl}/api/v1/not-implemented`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid',
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, 'INVALID_JSON');
  });

  await t.test('oversized JSON returns 413', async () => {
    const response = await fetch(`${baseUrl}/api/v1/not-implemented`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 'a'.repeat(110000) }),
    });
    assert.equal(response.status, 413);
    assert.equal((await response.json()).error.code, 'PAYLOAD_TOO_LARGE');
  });
});
