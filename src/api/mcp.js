import { timingSafeEqual } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpServer } from '../src/mcp.js';

function isAuthorized(req, token) {
  const authorization = req.headers.authorization || '';
  if (!authorization.startsWith('Bearer ')) return false;

  const supplied = Buffer.from(authorization.slice(7));
  const expected = Buffer.from(token);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  const token = process.env.MCP_AUTH_TOKEN;
  if (!token) {
    return sendJson(res, 500, { error: 'MCP_AUTH_TOKEN is not configured' });
  }
  if (!isAuthorized(req, token)) {
    res.setHeader('WWW-Authenticate', 'Bearer');
    return sendJson(res, 401, { error: 'Unauthorized' });
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
