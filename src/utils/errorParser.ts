/**
 * Utilitas Parser dan Sanitasi Pesan Error
 * MADRASAH SMART SOAL
 * 
 * Mencegah string "[object Object]", kebocoran API Key / path internal,
 * serta menerjemahkan pesan error teknis ke bahasa yang ramah bagi guru Madrasah.
 */

export interface ParsedErrorDetails {
  message: string;
  category: 'AUTH' | 'QUOTA' | 'TIMEOUT' | 'SERVICE' | 'VALIDATION' | 'NETWORK' | 'UNKNOWN';
  statusCode?: number;
}

/**
 * Ekstraksi pesan kesalahan yang ramah pengguna dari tipe data apa pun (string, Error, Object, response JSON).
 * Menjamin TIDAK AKAN PERNAH menghasilkan "[object Object]".
 */
export function extractErrorMessage(errorPayload: unknown, fallbackStatusCode?: number): string {
  const parsed = parseErrorDetails(errorPayload, fallbackStatusCode);
  return parsed.message;
}

/**
 * Parsing lengkap error payload menjadi pesan ramah dan kategori diagnostik.
 */
export function parseErrorDetails(errorPayload: unknown, fallbackStatusCode?: number): ParsedErrorDetails {
  let rawText = '';
  let detectedCode = '';
  let statusCode = fallbackStatusCode;

  // 1. Ekstraksi representasi teks awal secara aman
  if (errorPayload === null || errorPayload === undefined) {
    rawText = '';
  } else if (typeof errorPayload === 'string') {
    rawText = errorPayload.trim();
  } else if (errorPayload instanceof Error) {
    rawText = (errorPayload.message || errorPayload.name || '').trim();
  } else if (typeof errorPayload === 'object') {
    const obj = errorPayload as Record<string, any>;

    // Cek properti status code jika ada di objek
    if (typeof obj.status === 'number') {
      statusCode = statusCode || obj.status;
    } else if (typeof obj.statusCode === 'number') {
      statusCode = statusCode || obj.statusCode;
    }

    // Cek error code seperti 'FUNCTION_INVOCATION_TIMEOUT', 'RESOURCE_EXHAUSTED', dsb
    if (typeof obj.code === 'string') {
      detectedCode = obj.code;
    }

    // Telusuri struktur hierarkis bertingkat
    if (typeof obj.message === 'string' && obj.message.trim() && obj.message !== '[object Object]') {
      rawText = obj.message.trim();
    } else if (typeof obj.error === 'string' && obj.error.trim() && obj.error !== '[object Object]') {
      rawText = obj.error.trim();
    } else if (typeof obj.error === 'object' && obj.error !== null) {
      // Struktur Vercel: { error: { code: '...', message: '...' } }
      // Struktur Google RPC: { error: { code: 429, message: '...', status: '...' } }
      const inner = obj.error;
      if (typeof inner.code === 'string') detectedCode = inner.code;
      if (typeof inner.code === 'number') statusCode = statusCode || inner.code;
      if (typeof inner.message === 'string' && inner.message.trim() && inner.message !== '[object Object]') {
        rawText = inner.message.trim();
      } else if (typeof inner.error === 'string' && inner.error.trim() && inner.error !== '[object Object]') {
        rawText = inner.error.trim();
      } else if (typeof inner.details === 'string') {
        rawText = inner.details.trim();
      }
    } else if (typeof obj.details === 'string' && obj.details.trim()) {
      rawText = obj.details.trim();
    }
  }

  // 2. Jika rawText merupakan JSON stringified (misal error dari GoogleGenAI SDK), parse kembali
  if (rawText.startsWith('{') && rawText.endsWith('}')) {
    try {
      const parsedJson = JSON.parse(rawText);
      if (parsedJson && typeof parsedJson === 'object') {
        const innerResult = parseErrorDetails(parsedJson, statusCode);
        rawText = innerResult.message;
        if (innerResult.statusCode) statusCode = innerResult.statusCode;
      }
    } catch {
      // Abaikan jika bukan format JSON valid
    }
  }

  // 3. Sanitasi token API Key (AIza...) dan path internal
  rawText = rawText.replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_API_KEY]');
  rawText = rawText.replace(/(?:\/[a-zA-Z0-9._-]+){3,}/g, (match: string) => {
    if (match.startsWith('/api/')) return match;
    return '[INTERNAL_PATH]';
  });

  const upperRaw = (rawText + ' ' + detectedCode).toUpperCase();

  // 4. Deteksi Timeout (Vercel Serverless Function 10s/15s/60s atau Gateway 504)
  const isTimeout =
    detectedCode === 'FUNCTION_INVOCATION_TIMEOUT' ||
    detectedCode === 'GATEWAY_TIMEOUT' ||
    statusCode === 504 ||
    statusCode === 502 ||
    upperRaw.includes('FUNCTION_INVOCATION_TIMEOUT') ||
    upperRaw.includes('TASK TIMED OUT') ||
    upperRaw.includes('TIMED OUT AFTER 60 SECONDS') ||
    upperRaw.includes('GATEWAY TIMEOUT') ||
    upperRaw.includes('ETIMEDOUT') ||
    upperRaw.includes('TIME OUT') ||
    upperRaw.includes('TIMED OUT') ||
    upperRaw.includes('DEADLINE_EXCEEDED');

  if (isTimeout) {
    return {
      message:
        'Waktu pemrosesan di server Vercel habis (Serverless Function Timeout / 60 detik). Hosting gratis Vercel membatasi waktu eksekusi serverless. Coba buat dalam jumlah 10-15 butir per sesi atau gunakan tombol "Susun Mandiri di Editor Soal".',
      category: 'TIMEOUT',
      statusCode: 504,
    };
  }

  // 5. Deteksi Payload Terlalu Besar (Vercel 4.5MB limit)
  if (detectedCode === 'FUNCTION_PAYLOAD_TOO_LARGE' || statusCode === 413 || upperRaw.includes('PAYLOAD TOO LARGE')) {
    return {
      message:
        'Ukuran dokumen atau materi acuan melebihi batas muatan serverless Vercel (4.5MB). Harap kurangi panjang teks materi acuan.',
      category: 'VALIDATION',
      statusCode: 413,
    };
  }

  // 6. Deteksi Autentikasi / Kunci API Invalid (401 / 403)
  const isAuth =
    statusCode === 401 ||
    statusCode === 403 ||
    upperRaw.includes('API_KEY_INVALID') ||
    upperRaw.includes('API KEY NOT VALID') ||
    upperRaw.includes('PERMISSION_DENIED') ||
    upperRaw.includes('UNAUTHENTICATED') ||
    upperRaw.includes('KUNCI API GEMINI TIDAK VALID');

  if (isAuth) {
    return {
      message:
        'Kunci API Gemini tidak valid atau tidak memiliki izin akses (HTTP 401/403). Pastikan variabel environment GEMINI_API_KEY sudah diatur dengan benar di panel Vercel atau AI Studio.',
      category: 'AUTH',
      statusCode: 401,
    };
  }

  // 7. Deteksi Kuota Habis / Rate Limit (429)
  const isQuota =
    statusCode === 429 ||
    upperRaw.includes('RESOURCE_EXHAUSTED') ||
    upperRaw.includes('QUOTA') ||
    upperRaw.includes('RATE LIMIT') ||
    upperRaw.includes('429');

  if (isQuota) {
    return {
      message:
        'Batas kuota harian atau frekuensi Gemini API terlampaui (HTTP 429 / Quota Exceeded). Silakan tunggu 1-2 menit sebelum mencoba kembali, atau gunakan kunci API dengan penagihan aktif.',
      category: 'QUOTA',
      statusCode: 429,
    };
  }

  // 8. Deteksi Layanan Google AI Sedang Sibuk / Beban Tinggi (503)
  const isServiceUnavailable =
    statusCode === 503 ||
    upperRaw.includes('503') ||
    upperRaw.includes('UNAVAILABLE') ||
    upperRaw.includes('HIGH DEMAND') ||
    upperRaw.includes('OVERLOADED');

  if (isServiceUnavailable) {
    return {
      message:
        'Layanan Google AI saat ini sedang mengalami lonjakan beban server (HTTP 503). Silakan klik "Coba Lagi" dalam beberapa detik.',
      category: 'SERVICE',
      statusCode: 503,
    };
  }

  // 9. Deteksi Kesalahan Format Nama Model atau Model Sudah Usang / Sunset
  if (upperRaw.includes('NO LONGER AVAILABLE') || upperRaw.includes('IS NO LONGER AVAILABLE')) {
    return {
      message:
        'Model Gemini versi lama sudah tidak tersedia oleh Google AI (no longer available). Sistem otomatis memperbarui ke model terbaru (gemini-3.8-flash). Silakan klik "Coba Lagi".',
      category: 'SERVICE',
      statusCode: 400,
    };
  }

  if (upperRaw.includes('UNEXPECTED MODEL NAME FORMAT') || upperRaw.includes('MODEL NAME FORMAT')) {
    return {
      message:
        'Format nama model Gemini pada server tidak valid. Pastikan variabel GEMINI_MODEL di dashboard Vercel diatur tanpa tanda kutip (contoh: gemini-3.8-flash) atau gunakan default sistem.',
      category: 'VALIDATION',
      statusCode: 400,
    };
  }

  // 9. Jika rawText valid dan bermakna (bukan '[object Object]' atau string kosong)
  if (rawText && rawText !== '[object Object]' && rawText.length > 3) {
    return {
      message: rawText,
      category: 'UNKNOWN',
      statusCode,
    };
  }

  // 10. Fallback aman berdasarkan status code HTTP jika ada
  if (statusCode) {
    if (statusCode === 404) {
      return {
        message: 'Endpoint API /api/generate-questions tidak ditemukan (HTTP 404). Pastikan server backend Vercel aktif.',
        category: 'SERVICE',
        statusCode: 404,
      };
    }
    if (statusCode === 400) {
      return {
        message: 'Data permintaan paket soal tidak lengkap atau tidak valid (HTTP 400). Periksa kembali isian formulir.',
        category: 'VALIDATION',
        statusCode: 400,
      };
    }
    return {
      message: `Terjadi kesalahan saat memproses permintaan pada server (HTTP ${statusCode}). Silakan coba beberapa saat lagi.`,
      category: 'UNKNOWN',
      statusCode,
    };
  }

  // Fallback mutlak terakhir — tidak akan pernah menghasilkan [object Object]
  return {
    message: 'Gagal menghasilkan butir soal dari AI. Silakan periksa koneksi internet atau coba beberapa saat lagi.',
    category: 'UNKNOWN',
  };
}
