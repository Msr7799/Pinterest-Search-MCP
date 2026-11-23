import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import healthHandler from '../api/health.js';
import handler from '../api/mcp.js';

test('Vercel MCP endpoint requires a configured bearer token and omits downloads', async () => {
  const previousToken = process.env.MCP_AUTH_TOKEN;
  const token = 'test-secret-token';
  delete process.env.MCP_AUTH_TOKEN;

  const httpServer = http.createServer((req, res) => {
    void (req.url.startsWith('/api/health') ? healthHandler(req, res) : handler(req, res));
  });
  await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve));

  const address = httpServer.address();
  const endpoint = `http://127.0.0.1:${address.port}/api/mcp`;
  const client = new Client({ name: 'vercel-test', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  });

  try {
    const unconfigured = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(unconfigured.status, 500);
    const healthUnconfigured = await fetch(new URL('/api/health', endpoint));
    assert.equal(healthUnconfigured.status, 503);

    process.env.MCP_AUTH_TOKEN = token;
    const unauthorized = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(unauthorized.status, 401);
    const health = await fetch(new URL('/api/health', endpoint));
    assert.equal(health.status, 200);
    assert.equal((await health.json()).status, 'ready');
    const unauthorizedCheck = await fetch(new URL('/api/health?check=pinterest', endpoint));
    assert.equal(unauthorizedCheck.status, 401);

    await client.connect(transport);
    const { tools } = await client.listTools();
    assert.ok(tools.some((tool) => tool.name === 'pinterest_search'));
    assert.ok(tools.some((tool) => tool.name === 'pinterest_diagnostics'));
    assert.ok(!tools.some((tool) => tool.name === 'pinterest_download'));

    const diagnosis = await client.callTool({ name: 'pinterest_diagnostics', arguments: {} });
    assert.deepEqual(JSON.parse(diagnosis.content[0].text), {
      status: 'ready',
      checks: { server: 'ready', pinterest: 'not_checked' },
    });
  } finally {
    await client.close();
    await new Promise((resolve, reject) => httpServer.close((error) => (error ? reject(error) : resolve())));
    if (previousToken === undefined) delete process.env.MCP_AUTH_TOKEN;
    else process.env.MCP_AUTH_TOKEN = previousToken;
  }
});
