/**
 * Layanan Sinkronisasi Cloud Neon PostgreSQL
 * MADRASAH SMART SOAL
 *
 * Menghubungkan client browser ke Neon PostgreSQL melalui backend API (/api/packages, /api/db-status)
 * dengan arsitektur Local-First (Offline-First):
 * - Membaca dan menulis secara instan ke LocalStorage.
 * - Saat online dan DATABASE_URL Neon aktif, sinkronisasi otomatis berjalan di latar belakang.
 * - Saat offline atau belum terhubung, aplikasi tetap berjalan normal 100% tanpa kendala.
 */

import { QuestionPackage, SchoolProfile } from '../types';

export interface CloudDbStatus {
  configured: boolean;
  connected: boolean;
  provider: 'neon' | 'local';
  endpointHost?: string;
  databaseName?: string;
  latencyMs?: number;
  packageCount?: number;
  hasSchoolProfile?: boolean;
  error?: string;
  checkedAt: string;
}

/**
 * Memeriksa status koneksi database Neon melalui API backend
 */
export async function checkCloudDbStatus(): Promise<CloudDbStatus> {
  const defaultFallback: CloudDbStatus = {
    configured: false,
    connected: false,
    provider: 'local',
    checkedAt: new Date().toISOString(),
  };

  if (typeof window === 'undefined' || typeof fetch === 'undefined') {
    return defaultFallback;
  }

  try {
    const res = await fetch('/api/db-status', {
      method: 'GET',
      headers: { credentials: 'omit', Accept: 'application/json' },
    });

    if (!res.ok) {
      // Coba fallback ke /api/db/status
      const resAlt = await fetch('/api/db/status', {
        method: 'GET',
        headers: { credentials: 'omit', Accept: 'application/json' },
      });
      if (resAlt.ok) {
        return (await resAlt.json()) as CloudDbStatus;
      }
      return {
        ...defaultFallback,
        error: `Server merespons dengan status ${res.status}`,
      };
    }

    const data = await res.json();
    return {
      configured: Boolean(data.configured),
      connected: Boolean(data.connected),
      provider: data.provider || (data.configured ? 'neon' : 'local'),
      endpointHost: data.endpointHost,
      databaseName: data.databaseName,
      latencyMs: data.latencyMs,
      packageCount: data.packageCount,
      hasSchoolProfile: data.hasSchoolProfile,
      error: data.error,
      checkedAt: data.checkedAt || new Date().toISOString(),
    };
  } catch (err: any) {
    return {
      ...defaultFallback,
      error: `Tidak dapat menghubungi server: ${err?.message || 'Offline'}`,
    };
  }
}

/**
 * Menyinkronkan paket soal ke Neon PostgreSQL di latar belakang
 */
export async function syncPackageToNeon(pkg: QuestionPackage): Promise<boolean> {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return false;

  try {
    const res = await fetch('/api/packages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pkg),
    });

    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.success);
  } catch {
    // Abaikan kegagalan jaringan saat offline (tetap tersimpan di LocalStorage)
    return false;
  }
}

/**
 * Menghapus paket soal dari Neon PostgreSQL di latar belakang
 */
export async function deletePackageFromNeon(id: string): Promise<boolean> {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return false;

  try {
    const res = await fetch(`/api/packages?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });

    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.success);
  } catch {
    return false;
  }
}

/**
 * Menyinkronkan profil madrasah ke Neon PostgreSQL
 */
export async function syncSchoolProfileToNeon(profile: SchoolProfile): Promise<boolean> {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return false;

  try {
    const res = await fetch('/api/school-profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(profile),
    });

    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.success);
  } catch {
    return false;
  }
}

/**
 * Mengambil daftar paket soal dari database Neon
 */
export async function pullPackagesFromNeon(): Promise<QuestionPackage[] | null> {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return null;

  try {
    const res = await fetch('/api/packages', {
      method: 'GET',
      headers: { credentials: 'omit', Accept: 'application/json' },
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (data.success && Array.isArray(data.packages)) {
      return data.packages as QuestionPackage[];
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Mengambil profil madrasah dari database Neon
 */
export async function pullSchoolProfileFromNeon(): Promise<SchoolProfile | null> {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return null;

  try {
    const res = await fetch('/api/school-profile', {
      method: 'GET',
      headers: { credentials: 'omit', Accept: 'application/json' },
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (data.success && data.profile) {
      return data.profile as SchoolProfile;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Mengunggah seluruh paket soal lokal ke Neon PostgreSQL (Bulk Sync)
 */
export async function uploadAllLocalPackagesToNeon(
  localPackages: QuestionPackage[]
): Promise<{ success: boolean; syncedCount: number; error?: string }> {
  if (!Array.isArray(localPackages) || localPackages.length === 0) {
    return { success: true, syncedCount: 0 };
  }

  let count = 0;
  for (const pkg of localPackages) {
    const ok = await syncPackageToNeon(pkg);
    if (ok) count++;
  }

  return {
    success: count > 0 || localPackages.length === 0,
    syncedCount: count,
  };
}
