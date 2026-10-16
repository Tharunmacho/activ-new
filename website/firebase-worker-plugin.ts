import { buildSync } from 'esbuild';
import { loadEnv, type Plugin } from 'vite';
import path from 'node:path';

export function firebaseWorkerPlugin(mode: string): Plugin {
  const compile = () => {
    const env = loadEnv(mode, process.cwd(), 'VITE_FIREBASE_');
    const values = { ...env, ...process.env };
    const publicEnv = Object.fromEntries(['API_KEY', 'AUTH_DOMAIN', 'PROJECT_ID', 'STORAGE_BUCKET',
      'MESSAGING_SENDER_ID', 'APP_ID', 'VAPID_KEY'].map(suffix => {
      const key = `VITE_FIREBASE_${suffix}`;
      return [key, values[key] || ''];
    }));
    return buildSync({
      entryPoints: [path.resolve(process.cwd(), 'src/firebaseMessagingWorker.ts')],
      bundle: true, write: false, format: 'iife', platform: 'browser', target: 'es2020', minify: true,
      define: { 'import.meta.env': JSON.stringify(publicEnv) },
    }).outputFiles[0].text;
  };
  return {
    name: 'activ-firebase-worker',
    configureServer(server) {
      server.middlewares.use('/firebase-messaging-sw.js', (_req, res) => {
        try {
          res.setHeader('Content-Type', 'application/javascript');
          res.setHeader('Cache-Control', 'no-cache');
          res.end(compile());
        } catch { res.statusCode = 500; res.end('Worker build failed'); }
      });
    },
    generateBundle() { this.emitFile({ type: 'asset', fileName: 'firebase-messaging-sw.js', source: compile() }); },
  };
}
