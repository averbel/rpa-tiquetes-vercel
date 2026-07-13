import type { VercelRequest } from '@vercel/node';

/**
 * Verifica el header "Authorization: Bearer {RPA_SERVICE_TOKEN}"
 * que envía n8n en cada llamada.
 */
export function isAuthorized(req: VercelRequest): boolean {
  const expected = process.env.RPA_SERVICE_TOKEN;
  if (!expected) {
    // Si no configuraste el token, por seguridad se rechaza todo.
    return false;
  }
  const header = req.headers['authorization'] || '';
  const token = Array.isArray(header) ? header[0] : header;
  return token === `Bearer ${expected}`;
}
