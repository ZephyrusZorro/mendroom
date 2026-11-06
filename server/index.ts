import { resolve } from 'node:path';
import express from 'express';
import { Store } from './store.ts';
import { createApp } from './app.ts';

const production = process.argv.includes('--production');
const port = Number(process.env.PORT || 4317);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error('PORT must be between 1024 and 65535.');
const store = new Store(resolve(process.env.MENDROOM_DB || 'data/mendroom.sqlite'));
const app = createApp(store, production);
if (production) {
  app.use(express.static(resolve('dist')));
  app.get('/{*splat}', (_req, res) => res.sendFile(resolve('dist/index.html')));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({
    server: { middlewareMode: true, hmr: { port: port + 1, host: '127.0.0.1' } },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}
const server = app.listen(port, '127.0.0.1', () =>
  console.log(
    `Mendroom is running at http://127.0.0.1:${port} (${production ? 'production build' : 'development'})`,
  ),
);
function shutdown() {
  server.close(() => {
    store.close();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
server.on('error', () => {
  console.error('Could not start Mendroom. Check whether its port is already in use.');
  store.close();
  process.exit(1);
});
