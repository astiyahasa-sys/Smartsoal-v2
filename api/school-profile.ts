import { handleSchoolProfileApi } from '../src/server/db/neonHandlers.ts';
import { sendJsonResponse, sanitizeErrorMessage } from '../src/server/generateQuestionsHandler.ts';

export const maxDuration = 15;

/**
 * Vercel Serverless Function: /api/school-profile
 */
export default async function handler(req: any, res: any) {
  try {
    await handleSchoolProfileApi(req, res);
  } catch (err: any) {
    return sendJsonResponse(res, 500, {
      success: false,
      error: sanitizeErrorMessage(err?.message || 'Gagal memproses profil madrasah di Vercel.'),
    });
  }
}
