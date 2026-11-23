import { timingSafeEqual } from 'node:crypto';

export function isAuthorized(req, token) {
  const authorization = req.headers.authorization || '';
  if (!authorization.startsWith('Bearer ')) return false;

  const supplied = Buffer.from(authorization.slice(7));
  const expected = Buffer.from(token);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
