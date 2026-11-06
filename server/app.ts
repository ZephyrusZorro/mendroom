import express, { type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import { ZodError } from 'zod';
import { AppError, type Store } from './store.ts';
import { sessionCsv } from './export.ts';
import { MAX_BACKUP_BYTES } from '../shared/limits.ts';

export function createApp(store: Store, production = false) {
  const app = express();
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: production
        ? { directives: { 'upgrade-insecure-requests': null } }
        : false,
      strictTransportSecurity: false,
    }),
  );
  app.use((req, res, next) => {
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(req.hostname))
      return res.status(403).json({ error: 'Mendroom is available on this computer only.' });
    const origin = req.get('origin');
    if (
      (origin && origin !== `http://${req.get('host')}`) ||
      req.get('sec-fetch-site') === 'cross-site'
    )
      return res.status(403).json({ error: 'Cross-origin access is not allowed.' });
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && !req.is('application/json'))
      return res.status(415).json({ error: 'Use application/json.' });
    next();
  });
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.post('/api/restore', express.json({ limit: MAX_BACKUP_BYTES }), (req, res) =>
    res.status(201).json(store.importSession(req.body)),
  );
  app.use(express.json({ limit: '64kb' }));
  app.get('/api/health', (_req, res) =>
    res.json({ status: 'ok', storage: 'sqlite', version: '1.0.0' }),
  );
  app.get('/api/sessions', (_req, res) => res.json(store.listSessions()));
  app.post('/api/sessions', (req, res) => res.status(201).json(store.createSession(req.body)));
  app.post('/api/sample', (_req, res) => res.status(201).json(store.createSample()));
  app.get('/api/sessions/:id/backup', (req, res) => {
    const backup = store.exportSession(req.params.id);
    res.attachment(`mendroom-${backup.session.date}.json`).json(backup);
  });
  app.get('/api/sessions/:id/report.csv', (req, res) => {
    const data = store.readSession(req.params.id);
    res.attachment(`mendroom-${data.session.date}.csv`).type('text/csv').send(sessionCsv(data));
  });
  app.get('/api/sessions/:id', (req, res) => res.json(store.readSession(req.params.id)));
  app.post('/api/sessions/:id/volunteers', (req, res) =>
    res.status(201).json(store.addVolunteer(req.params.id, req.body)),
  );
  app.patch('/api/sessions/:id/volunteers/:volunteerId', (req, res) =>
    res.json(store.editVolunteer(req.params.id, req.params.volunteerId, req.body)),
  );
  app.post('/api/sessions/:id/tickets', (req, res) =>
    res.status(201).json(store.addTicket(req.params.id, req.body)),
  );
  app.post('/api/sessions/:id/tickets/:ticketId/actions', (req, res) =>
    res.json(store.act(req.params.id, req.params.ticketId, req.body)),
  );
  app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof ZodError)
      return res.status(400).json({
        error: error.issues
          .map((i) => `${i.path.join('.') || 'Input'}: ${i.message}`)
          .slice(0, 4)
          .join('; '),
      });
    if (error instanceof AppError) return res.status(error.status).json({ error: error.message });
    if (error instanceof SyntaxError)
      return res.status(400).json({ error: 'The request contains invalid JSON.' });
    if (typeof error === 'object' && error && 'status' in error && error.status === 413)
      return res
        .status(413)
        .json({
          error:
            'Request is too large. Backups support up to 8 MB; ordinary changes support 64 KB.',
        });
    res
      .status(500)
      .json({
        error: 'Could not save this change. Your previous data is unchanged. Please retry.',
      });
  });
  return app;
}
