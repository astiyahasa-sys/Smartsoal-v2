import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';

/**
 * Middleware pengaman API pada lingkungan dev Vite:
 * Memastikan /api/generate-questions dan /api/health ditangani dan mengembalikan JSON,
 * serta memastikan rute /api/* yang tidak dikenal mengembalikan 404 JSON bukan fallback index.html.
 */
function apiDevPlugin(): Plugin {
  return {
    name: 'api-dev-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ? req.url.split('?')[0] : '';
        if (url === '/api/generate-questions' || url === '/api/generate-questions/') {
          try {
            const { handleGenerateQuestionsApi } = await import('./src/server/generateQuestionsHandler.ts');
            await handleGenerateQuestionsApi(req, res);
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: false, error: err?.message || 'Server API Error' }));
          }
          return;
        }

        if (url === '/api/generate-question-image' || url === '/api/generate-question-image/') {
          try {
            const { handleGenerateQuestionImageApi } = await import('./src/server/generateQuestionsHandler.ts');
            await handleGenerateQuestionImageApi(req, res);
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: false, error: err?.message || 'Server API Error' }));
          }
          return;
        }

        if (url === '/api/health' || url === '/api/health/') {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({
            status: 'ok',
            appName: 'MADRASAH SMART SOAL',
            version: '2.0',
            hasGeminiApiKey: Boolean(process.env.GEMINI_API_KEY),
            model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
          }));
          return;
        }

        if (url.startsWith('/api/')) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, error: 'Endpoint API tidak ditemukan.' }));
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), apiDevPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
