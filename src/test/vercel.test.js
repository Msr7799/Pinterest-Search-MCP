import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import handler from '../api/mcp.js';

test('Vercel MCP endpoint requires a configured bearer token and omits downloads', async () => {
  const previousToken = process.env.MCP_AUTH_TOKEN;
  const token = 'test-secret-token';
  delete process.env.MCP_AUTH_TOKEN;

  const httpServer = http.createServer((req, res) => {
    void handler(req, res);
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

    process.env.MCP_AUTH_TOKEN = token;
    const unauthorized = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(unauthorized.status, 401);

    await client.connect(transport);
    const { tools } = await client.listTools();
    assert.ok(tools.some((tool) => tool.name === 'pinterest_search'));
    assert.ok(!tools.some((tool) => tool.name === 'pinterest_download'));
  } finally {
    await client.close();
    await new Promise((resolve, reject) => httpServer.close((error) => (error ? reject(error) : resolve())));
    if (previousToken === undefined) delete process.env.MCP_AUTH_TOKEN;
    else process.env.MCP_AUTH_TOKEN = previousToken;
  }
});
