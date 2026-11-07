import { AiStatusResponse } from '../types';

/**
 * Memeriksa status kesehatan koneksi backend ke layanan AI
 * @param checkLive Jika true, mengirim ping verifikasi ringan ke model Gemini
 */
export async function checkAiApiStatus(checkLive = false): Promise<AiStatusResponse> {
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const url = `/api/status${checkLive ? '?checkLive=true' : ''}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return {
        success: false,
        status: 'service_issue',
        connected: false,
        model: 'gemini-2.5-flash',
        message: `Server mengembalikan respons non-JSON (HTTP ${response.status}).`,
        timestamp: new Date().toISOString(),
        latencyMs: Date.now() - startTime,
      };
    }

    const data: AiStatusResponse = await response.json();
    return {
      ...data,
      latencyMs: data.latencyMs || Date.now() - startTime,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    const isTimeout = err?.name === 'AbortError';

    return {
      success: false,
      status: 'service_issue',
      connected: false,
      model: 'gemini-2.5-flash',
      message: isTimeout
        ? 'Pengecekan status layanan AI melebihi batas waktu (timeout).'
        : 'Tidak dapat terhubung ke server backend atau endpoint status.',
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - startTime,
    };
  }
}
