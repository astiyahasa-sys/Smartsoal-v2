import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleGenerateQuestionsApi, handleGenerateQuestionImageApi, handleStatusApi } from './src/server/generateQuestionsHandler.ts';
import { handleDbStatusApi, handlePackagesApi, handleSchoolProfileApi } from './src/server/db/neonHandlers.ts';

// Redam warning [DEP0169] url.parse() yang dipicu oleh dependensi internal (Express 4/Vite/parseurl) di Node.js 22+
if (typeof process !== 'undefined' && typeof process.on === 'function') {
  process.on('warning', (warning: any) => {
    if (warning?.name === 'DeprecationWarning' && (warning?.code === 'DEP0169' || warning?.message?.includes('url.parse'))) {
      return;
    }
  });
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();

  // Parsing port: periksa argumen CLI --port terlebih dahulu, lalu process.env.PORT, default 3000
  let PORT = 3000;
  const portArgIndex = process.argv.indexOf('--port');
  if (portArgIndex !== -1 && process.argv[portArgIndex + 1]) {
    PORT = Number(process.argv[portArgIndex + 1]) || 3000;
  } else if (process.env.PORT) {
    PORT = Number(process.env.PORT) || 3000;
  }

  // Body parser dengan batas wajar
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // API Routes
  app.all(['/api/status', '/api/status/'], (req, res) => {
    return handleStatusApi(req, res);
  });

  // Neon PostgreSQL Database Routes
  app.all(['/api/db/status', '/api/db/status/', '/api/db-status', '/api/db-status/'], (req, res) => {
    return handleDbStatusApi(req, res);
  });

  app.all(['/api/packages', '/api/packages/', '/api/packages/:id'], (req, res) => {
    return handlePackagesApi(req, res);
  });

  app.all(['/api/school-profile', '/api/school-profile/'], (req, res) => {
    return handleSchoolProfileApi(req, res);
  });

  app.all(['/api/generate-questions', '/api/generate-questions/'], (req, res) => {
    return handleGenerateQuestionsApi(req, res);
  });

  app.all(['/api/generate-question-image', '/api/generate-question-image/'], (req, res) => {
    return handleGenerateQuestionImageApi(req, res);
  });

  app.get(['/api/health', '/api/health/'], (_req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json({
      status: 'ok',
      appName: 'MADRASAH SMART SOAL',
      version: '2.0',
      hasGeminiApiKey: Boolean(process.env.GEMINI_API_KEY),
      hasDatabaseUrl: Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL),
      model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
    });
  });

  // Pastikan SEMUA rute /api/* yang tidak terdaftar mengembalikan 404 JSON, jangan pernah jatuh ke HTML
  app.all('/api/*', (_req, res) => {
    res.status(404).setHeader('Content-Type', 'application/json; charset=utf-8').json({
      success: false,
      error: 'Endpoint API tidak ditemukan.',
    });
  });

  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    // Development mode: Pasang Vite middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production mode: Sajikan berkas statis dari dist
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Madrasah Smart Soal] Server berjalan di http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Gagal menjalankan server:', err);
  process.exit(1);
});
