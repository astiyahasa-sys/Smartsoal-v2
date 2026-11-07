import type { IncomingMessage, ServerResponse } from 'http';
import { handleGenerateQuestionsApi, sendJsonResponse, sanitizeErrorMessage } from '../src/server/generateQuestionsHandler.ts';

/**
 * Vercel Serverless Function Configuration
 * Menetapkan batas waktu eksekusi hingga 60 detik (batas maksimal paket Vercel Hobby)
 * untuk menangani proses generasi paket soal besar (35-50 butir) dengan aman.
 */
export const maxDuration = 60;

/**
 * Vercel Serverless Function Handler
 * Endpoint: /api/generate-questions
 */
export default async function handler(req: any, res: any) {
  const reqId = `vcl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
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
    // Diagnostik aman pada Vercel Runtime Logs (tidak mencatat API key atau payload sensitif)
    console.log(`[Vercel Serverless Invocation Start] ID: ${reqId} | Method: ${method} | Endpoint: /api/generate-questions`);
    
    // Perlindungan Batas Waktu Serverless (52 detik agar tidak pernah mengenai batas keras 60s Vercel)
    let timeoutHandle: any = null;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error('Waktu pemrosesan di server Vercel mencapai batas maksimal (60 detik). Hosting gratis Vercel membatasi waktu eksekusi serverless. Coba buat dalam jumlah 10-15 butir per sesi atau gunakan tombol "Susun Mandiri di Editor Soal".'));
      }, 52_000);
      if (typeof timeoutHandle?.unref === 'function') {
        timeoutHandle.unref();
      }
    });

    try {
      await Promise.race([
        handleGenerateQuestionsApi(req, res),
        timeoutPromise,
      ]);
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }

    console.log(`[Vercel Serverless Invocation End] ID: ${reqId} | Status: Success`);
  } catch (fatalError: any) {
    // Top-level crash guard untuk mencegah FUNCTION_INVOCATION_FAILED di tingkat Vercel gateway
    const rawMsg = String(fatalError?.message || fatalError || '');
    const isTimeout = rawMsg.includes('60 detik') || rawMsg.includes('batas maksimal') || rawMsg.includes('TIMEOUT');
    const statusCode = isTimeout ? 504 : 500;
    const category = isTimeout ? 'TIMEOUT' : 'SERVERLESS_INVOCATION_ERROR';
    const sanitizedError = sanitizeErrorMessage(fatalError);
    
    console.error(`[Vercel Serverless Fatal Error] ID: ${reqId} | Status: ${statusCode} | Error:`, {
      name: fatalError?.name || 'Error',
      message: sanitizedError,
      code: fatalError?.code,
      category,
    });

    return sendJsonResponse(res, statusCode, {
      success: false,
      error: sanitizedError || 'Terjadi kesalahan sistem internal pada serverless function.',
      requestId: reqId,
      category,
    });
  }
}
