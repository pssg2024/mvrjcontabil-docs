import type { IncomingMessage, ServerResponse } from 'http';
import app from '../server.js';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  const rawUrl = req.url || '/';
  try {
    const parsed = new URL(rawUrl, 'http://localhost');
    const rewrittenPath = parsed.searchParams.get('__path');

    if (rewrittenPath !== null) {
      parsed.searchParams.delete('__path');
      const qs = parsed.searchParams.toString();
      const cleanPath = rewrittenPath.replace(/^\/+/, '');
      if (cleanPath === 'og-image' || cleanPath === 'og-image.jpg') {
        req.url = `/api/og-image${qs ? `?${qs}` : ''}`;
      } else {
        req.url = `/api/${cleanPath}${qs ? `?${qs}` : ''}`;
      }
    } else if (!rawUrl.startsWith('/api') && !rawUrl.startsWith('/og-image.jpg')) {
      req.url = `/api${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;
    }
  } catch {
    if (req.url && !req.url.startsWith('/api') && !req.url.startsWith('/og-image.jpg')) {
      req.url = `/api${req.url.startsWith('/') ? '' : '/'}${req.url}`;
    }
  }
  return app(req as any, res as any);
}
