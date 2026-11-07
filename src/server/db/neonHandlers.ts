/**
 * API Handlers untuk Sinkronisasi Neon PostgreSQL
 * MADRASAH SMART SOAL
 *
 * Mendukung Express (server.ts) dan Vercel Serverless Functions (api/packages.ts dsb).
 */

import {
  checkNeonConnection,
  isNeonConfigured,
  getAllPackagesFromDb,
  getPackageByIdFromDb,
  savePackageToDb,
  deletePackageFromDb,
  getSchoolProfileFromDb,
  saveSchoolProfileToDb,
} from './neon.ts';
import { sendJsonResponse, sanitizeErrorMessage } from '../generateQuestionsHandler.ts';
import { QuestionPackage, SchoolProfile } from '../../types/index.ts';

/**
 * Handler GET /api/db/status dan /api/db-status
 */
export async function handleDbStatusApi(_req: any, res: any) {
  try {
    const status = await checkNeonConnection();
    return sendJsonResponse(res, 200, {
      success: true,
      ...status,
    });
  } catch (err: any) {
    return sendJsonResponse(res, 500, {
      success: false,
      configured: isNeonConfigured(),
      connected: false,
      provider: 'neon',
      error: sanitizeErrorMessage(err?.message || 'Gagal memeriksa status koneksi Neon.'),
      checkedAt: new Date().toISOString(),
    });
  }
}

/**
 * Handler /api/packages
 * - GET: Ambil seluruh paket soal dari database Neon
 * - POST: Simpan/perbarui paket soal ke database Neon
 * - DELETE: Hapus paket soal berdasarkan id (via query ?id= atau URL parameter)
 */
export async function handlePackagesApi(req: any, res: any) {
  const method = (req.method || 'GET').toUpperCase();

  // Jika Neon belum dikonfigurasi, beri tahu client secara anggun
  if (!isNeonConfigured()) {
    if (method === 'GET') {
      return sendJsonResponse(res, 200, {
        success: true,
        configured: false,
        source: 'local_fallback',
        packages: [],
        message: 'DATABASE_URL Neon belum diatur. Menggunakan penyimpanan lokal browser.',
      });
    }
    return sendJsonResponse(res, 200, {
      success: false,
      configured: false,
      source: 'local_fallback',
      message: 'Database cloud Neon belum aktif. Data tetap tersimpan aman di penyimpanan lokal.',
    });
  }

  try {
    if (method === 'GET') {
      const packageId = (req.query && req.query.id) || (req.params && req.params.id);

      if (packageId && typeof packageId === 'string') {
        const pkg = await getPackageByIdFromDb(packageId);
        if (!pkg) {
          return sendJsonResponse(res, 404, {
            success: false,
            error: 'Paket soal tidak ditemukan di database Neon.',
          });
        }
        return sendJsonResponse(res, 200, {
          success: true,
          package: pkg,
        });
      }

      const packages = await getAllPackagesFromDb();
      return sendJsonResponse(res, 200, {
        success: true,
        configured: true,
        source: 'neon_postgres',
        packages: packages || [],
        count: packages ? packages.length : 0,
      });
    }

    if (method === 'POST') {
      const body = req.body;
      if (!body || typeof body !== 'object' || !body.id || !body.title) {
        return sendJsonResponse(res, 400, {
          success: false,
          error: 'Format data paket soal tidak valid (membutuhkan id dan title).',
        });
      }

      const saved = await savePackageToDb(body as QuestionPackage);
      return sendJsonResponse(res, 200, {
        success: true,
        message: 'Paket soal berhasil disinkronkan ke database Neon PostgreSQL.',
        package: saved,
      });
    }

    if (method === 'DELETE') {
      const packageId =
        (req.query && req.query.id) ||
        (req.params && req.params.id) ||
        (req.body && req.body.id);

      if (!packageId || typeof packageId !== 'string') {
        return sendJsonResponse(res, 400, {
          success: false,
          error: 'ID paket soal wajib disertakan untuk penghapusan.',
        });
      }

      await deletePackageFromDb(packageId);
      return sendJsonResponse(res, 200, {
        success: true,
        message: 'Paket soal berhasil dihapus dari database Neon.',
        id: packageId,
      });
    }

    return sendJsonResponse(res, 405, {
      success: false,
      error: `Metode ${method} tidak didukung pada endpoint /api/packages.`,
    });
  } catch (err: any) {
    console.error('[Neon Packages API Error]:', err);
    return sendJsonResponse(res, 500, {
      success: false,
      error: sanitizeErrorMessage(err?.message || 'Gagal memproses data paket soal di database Neon.'),
    });
  }
}

/**
 * Handler /api/school-profile
 * - GET: Ambil profil madrasah dari database Neon
 * - POST: Simpan/perbarui profil madrasah ke database Neon
 */
export async function handleSchoolProfileApi(req: any, res: any) {
  const method = (req.method || 'GET').toUpperCase();

  if (!isNeonConfigured()) {
    if (method === 'GET') {
      return sendJsonResponse(res, 200, {
        success: true,
        configured: false,
        source: 'local_fallback',
        profile: null,
      });
    }
    return sendJsonResponse(res, 200, {
      success: false,
      configured: false,
      source: 'local_fallback',
      message: 'Database cloud Neon belum aktif. Profil disimpan secara lokal di browser.',
    });
  }

  try {
    if (method === 'GET') {
      const profile = await getSchoolProfileFromDb();
      return sendJsonResponse(res, 200, {
        success: true,
        configured: true,
        source: 'neon_postgres',
        profile,
      });
    }

    if (method === 'POST') {
      const body = req.body;
      if (!body || typeof body !== 'object') {
        return sendJsonResponse(res, 400, {
          success: false,
          error: 'Data profil madrasah tidak valid.',
        });
      }

      const saved = await saveSchoolProfileToDb(body as SchoolProfile);
      return sendJsonResponse(res, 200, {
        success: true,
        message: 'Profil madrasah berhasil disinkronkan ke database Neon PostgreSQL.',
        profile: saved,
      });
    }

    return sendJsonResponse(res, 405, {
      success: false,
      error: `Metode ${method} tidak didukung pada endpoint /api/school-profile.`,
    });
  } catch (err: any) {
    console.error('[Neon School Profile API Error]:', err);
    return sendJsonResponse(res, 500, {
      success: false,
      error: sanitizeErrorMessage(err?.message || 'Gagal memproses profil madrasah di database Neon.'),
    });
  }
}
