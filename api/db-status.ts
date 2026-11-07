import { handleDbStatusApi } from '../src/server/db/neonHandlers.ts';
import { sendJsonResponse, sanitizeErrorMessage } from '../src/server/generateQuestionsHandler.ts';

export const maxDuration = 15;

/**
 * Vercel Serverless Function: /api/db-status
 */
export default async function handler(req: any, res: any) {
  try {
    await handleDbStatusApi(req, res);
  } catch (err: any) {
    return sendJsonResponse(res, 500, {
      success: false,
      configured: false,
      connected: false,
      provider: 'neon',
      error: sanitizeErrorMessage(err?.message || 'Gagal memeriksa koneksi Neon DB di Vercel.'),
      checkedAt: new Date().toISOString(),
    });
  }
}
