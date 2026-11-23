import { isAuthorized } from '../src/auth.js';
import { checkPinterestConnectivity } from '../src/pinterest.js';
import { randomUUID } from 'node:crypto';

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
      path: '/api/health',
      method: req.method,
      status: res.statusCode,
      duration_ms: Date.now() - started,
    }));
  });
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const token = process.env.MCP_AUTH_TOKEN;
  const publicReadOnly = process.env.MCP_PUBLIC_READONLY === 'true';
  if (!token && !publicReadOnly) {
    return sendJson(res, 503, { status: 'not_ready', checks: { mcp_auth: 'missing' } });
  }

  const url = new URL(req.url, 'http://localhost');
  const checkPinterest = url.searchParams.get('check') === 'pinterest';
  const checks = {
    server: 'ready',
    mcp_auth: publicReadOnly ? 'public_readonly' : 'bearer',
    pinterest: 'not_checked',
  };

  if (checkPinterest) {
    if (!publicReadOnly && !isAuthorized(req, token)) {
      res.setHeader('WWW-Authenticate', 'Bearer');
      return sendJson(res, 401, { error: 'Unauthorized' });
    }

    try {
      checks.pinterest = { status: 'reachable', ...(await checkPinterestConnectivity()) };
    } catch (error) {
      console.error('[pinterest] connectivity diagnostic failed:', error);
      checks.pinterest = { status: 'unavailable', error: error.message };
      return sendJson(res, 503, { status: 'degraded', checks });
    }
  }

  return sendJson(res, 200, { status: 'ready', checks, mcp_endpoint: '/mcp' });
}
