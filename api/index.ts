import type { IncomingMessage, ServerResponse } from 'http';
import app from '../server.js';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.url && !req.url.startsWith('/api') && !req.url.startsWith('/og-image.jpg')) {
    req.url = `/api${req.url.startsWith('/') ? '' : '/'}${req.url}`;
  }
  return app(req as any, res as any);
}
