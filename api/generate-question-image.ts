import { handleGenerateQuestionImageApi, sendJsonResponse, sanitizeErrorMessage } from '../src/server/generateQuestionsHandler.ts';

/**
 * Vercel Serverless Function Configuration
 * Menetapkan batas waktu 60 detik untuk pembuatan gambar stimulus AI.
 */
export const maxDuration = 60;

/**
 * Vercel Serverless Function Handler
 * Endpoint: /api/generate-question-image
 */
export default async function handler(req: any, res: any) {
  const reqId = `vcl_img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const method = req?.method || 'UNKNOWN';

  // Handle CORS Preflight jika diperlukan oleh Vercel
  if (method === 'OPTIONS') {
    if (typeof res?.setHeader === 'function') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
    }
    return sendJsonResponse(res, 204, {});
  }

  try {
    console.log(`[Vercel Serverless Image Start] ID: ${reqId} | Method: ${method} | Endpoint: /api/generate-question-image`);
    await handleGenerateQuestionImageApi(req, res);
    console.log(`[Vercel Serverless Image End] ID: ${reqId} | Status: Success`);
  } catch (fatalError: any) {
    const sanitizedError = sanitizeErrorMessage(fatalError);
    
    console.error(`[Vercel Serverless Image Fatal Error] ID: ${reqId} | Error:`, {
      name: fatalError?.name || 'Error',
      message: sanitizedError,
      code: fatalError?.code,
    });

    return sendJsonResponse(res, 500, {
      success: false,
      error: sanitizedError || 'Terjadi kesalahan sistem internal pada pembuatan gambar serverless.',
      requestId: reqId,
      category: 'SERVERLESS_IMAGE_ERROR',
    });
  }
}
