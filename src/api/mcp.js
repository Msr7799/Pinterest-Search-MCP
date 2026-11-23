import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { randomUUID } from 'node:crypto';
import { isAuthorized } from '../src/auth.js';
import { createMcpServer } from '../src/mcp.js';

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  const started = Date.now();
  const requestId = randomUUID();
  res.setHeader('X-Request-Id', requestId);
  res.setHeader('Cache-Control', 'no-store');
  res.once('finish', () => {
    console.info('[pinterest] request', JSON.stringify({
      request_id: requestId,
      path: '/api/mcp',
      method: req.method,
      status: res.statusCode,
      duration_ms: Date.now() - started,
    }));
  });

  const token = process.env.MCP_AUTH_TOKEN;
  // ChatGPT's No authentication mode cannot supply a static Bearer token.
  // Public mode is opt-in and only exposes read-only tools (downloads disabled).
  if (process.env.MCP_PUBLIC_READONLY !== 'true') {
    if (!token) {
      return sendJson(res, 503, { error: 'MCP_AUTH_TOKEN is not configured' });
    }
    if (!isAuthorized(req, token)) {
      res.setHeader('WWW-Authenticate', 'Bearer');
      return sendJson(res, 401, { error: 'Unauthorized' });
    }
  }

  // This is a stateless Streamable HTTP endpoint. A GET with an SSE Accept
  // header would otherwise hold a Vercel Function open until its timeout.
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Use POST for MCP requests; use GET /health for readiness.' });
  }

  const server = createMcpServer({ enableDownloads: false });
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('[pinterest] MCP HTTP request failed:', error);
    if (!res.headersSent) {
      sendJson(res, 500, { error: 'MCP request failed' });
    } else if (!res.writableEnded) {
      res.end();
    }
  } finally {
    await server.close();
  }
}
