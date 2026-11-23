import { isAuthorized } from '../src/auth.js';
import { checkPinterestConnectivity } from '../src/pinterest.js';

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const token = process.env.MCP_AUTH_TOKEN;
  if (!token) {
    return sendJson(res, 503, { status: 'not_ready', checks: { mcp_auth: 'missing' } });
  }

  const url = new URL(req.url, 'http://localhost');
  const checkPinterest = url.searchParams.get('check') === 'pinterest';
  const checks = { server: 'ready', mcp_auth: 'configured', pinterest: 'not_checked' };

  if (checkPinterest) {
    if (!isAuthorized(req, token)) {
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

  return sendJson(res, 200, { status: 'ready', checks, mcp_endpoint: '/api/mcp' });
}
