import { handleStatusApi, sendJsonResponse, sanitizeErrorMessage } from '../src/server/generateQuestionsHandler.ts';

export const maxDuration = 15;

/**
 * Vercel Serverless Function Handler
 * Endpoint: /api/status
 */
export default async function handler(req: any, res: any) {
  try {
    await handleStatusApi(req, res);
  } catch (err: any) {
    return sendJsonResponse(res, 500, {
      success: false,
      status: 'service_issue',
      connected: false,
      error: sanitizeErrorMessage(err || 'Terjadi kesalahan sistem internal pada pengecekan status.'),
      timestamp: new Date().toISOString(),
    });
  }
}
