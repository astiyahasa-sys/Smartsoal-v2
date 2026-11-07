/**
 * Layanan Penyimpanan Lokal (Local Storage Service)
 * MADRASAH SMART SOAL
 * 
 * Menggunakan namespace key yang konsisten:
 * - madrasah-smart-soal:packages
 * - madrasah-smart-soal:school-profile
 * - madrasah-smart-soal:settings
 */

import { AppSettings, QuestionPackage, SchoolProfile, StorageResult } from '../types';
import { generateUniqueId } from '../utils/curriculum';
import { saveImageToIndexedDb } from './indexedDbStorage';
import {
  syncPackageToNeon,
  deletePackageFromNeon,
  syncSchoolProfileToNeon,
  pullPackagesFromNeon,
  pullSchoolProfileFromNeon,
} from './neonSync';

export * from './neonSync';

export const STORAGE_KEYS = {
  PACKAGES: 'madrasah-smart-soal:packages',
  SCHOOL_PROFILE: 'madrasah-smart-soal:school-profile',
  SETTINGS: 'madrasah-smart-soal:settings',
} as const;

export const DEFAULT_SETTINGS: AppSettings = {
  defaultAcademicYear: '2024/2025',
  defaultDurationMinutes: 90,
  defaultDifficulty: 'Campuran',
  autoFillSchoolProfile: true,
  confirmBeforeDelete: true,
};

/**
 * Memeriksa apakah LocalStorage tersedia di lingkungan saat ini
 */
export function isLocalStorageAvailable(): boolean {
  try {
    const testKey = '__mss_test__';
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Mengambil seluruh paket soal yang tersimpan dari Local Storage
 */
export function getStoredPackages(): QuestionPackage[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.PACKAGES);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.warn('Data paket soal tidak berbentuk array, mengabaikan data rusak.');
      return [];
    }

    // Validasi struktur minimal tiap paket
    return parsed.filter((item): item is QuestionPackage => {
      return (
        item &&
        typeof item === 'object' &&
        typeof item.id === 'string' &&
        typeof item.title === 'string'
      );
    });
  } catch (error) {
    console.error('Gagal membaca data paket soal dari Local Storage:', error);
    return [];
  }
}

/**
 * Mengambil satu paket soal berdasarkan ID
 */
export function getPackageById(id: string): QuestionPackage | null {
  const packages = getStoredPackages();
  return packages.find((p) => p.id === id) || null;
}

/**
 * Menyimpan atau memperbarui paket soal
 */
export function savePackage(pkg: QuestionPackage): StorageResult<QuestionPackage> {
  if (!isLocalStorageAvailable()) {
    return {
      success: false,
      error: 'Penyimpanan lokal browser (Local Storage) tidak dapat diakses atau dinonaktifkan.',
    };
  }

  try {
    const packages = getStoredPackages();
    const existingIndex = packages.findIndex((p) => p.id === pkg.id);
    const now = new Date().toISOString();

    const packageToSave: QuestionPackage = {
      ...pkg,
      updatedAt: now,
      createdAt: pkg.createdAt || now,
    };

    if (existingIndex >= 0) {
      packages[existingIndex] = packageToSave;
    } else {
      packages.unshift(packageToSave);
    }

    // Backup gambar ke IndexedDB di latar belakang agar selalu aman
    if (packageToSave.questions && Array.isArray(packageToSave.questions)) {
      packageToSave.questions.forEach((q) => {
        if (q.imageUrl && q.id) {
          saveImageToIndexedDb(`${packageToSave.id}_${q.id}`, q.imageUrl).catch(() => {});
        }
      });
    }

    try {
      const serialized = JSON.stringify(packages);
      window.localStorage.setItem(STORAGE_KEYS.PACKAGES, serialized);
    } catch (quotaError: any) {
      // Jika kuota LocalStorage (~5MB) terlewati karena gambar-gambar besar:
      const isQuota =
        quotaError?.name === 'QuotaExceededError' ||
        quotaError?.code === 22 ||
        quotaError?.code === 1014;

      if (isQuota) {
        console.warn('LocalStorage kuota penuh. Mencoba menyimpan paket dengan referensi gambar aman.');
        return {
          success: false,
          error: 'Kapasitas penyimpanan lokal browser (LocalStorage) telah mencapai batas maksimum (~5MB). Silakan ekspor cadangan data di Pengaturan atau hapus paket lama yang tidak diperlukan.',
        };
      }
      throw quotaError;
    }

    // Sinkronisasi otomatis ke Neon PostgreSQL di latar belakang
    syncPackageToNeon(packageToSave).catch(() => {});

    return {
      success: true,
      data: packageToSave,
    };
  } catch (error: any) {
    console.error('Gagal menyimpan paket soal:', error);
    const isQuota =
      error?.name === 'QuotaExceededError' ||
      error?.code === 22 ||
      error?.code === 1014;
    return {
      success: false,
      error: isQuota
        ? 'Kapasitas penyimpanan lokal browser telah penuh. Silakan hapus paket yang tidak digunakan atau ekspor cadangan data.'
        : `Gagal menyimpan paket soal: ${error?.message || 'Terjadi kesalahan sistem.'}`,
    };
  }
}

/**
 * Menghapus paket soal berdasarkan ID
 */
export function deletePackage(id: string): StorageResult {
  if (!isLocalStorageAvailable()) {
    return {
      success: false,
      error: 'Penyimpanan lokal browser tidak tersedia.',
    };
  }

  try {
    const packages = getStoredPackages();
    const filtered = packages.filter((p) => p.id !== id);

    if (packages.length === filtered.length) {
      return {
        success: false,
        error: 'Paket soal dengan ID tersebut tidak ditemukan.',
      };
    }

    window.localStorage.setItem(STORAGE_KEYS.PACKAGES, JSON.stringify(filtered));

    // Hapus dari database Neon di latar belakang
    deletePackageFromNeon(id).catch(() => {});

    return { success: true };
  } catch (error: any) {
    console.error('Gagal menghapus paket soal:', error);
    return {
      success: false,
      error: `Gagal menghapus paket: ${error?.message || 'Kesalahan penyimpanan.'}`,
    };
  }
}

/**
 * Menduplikasi paket soal yang sudah ada dengan ID baru
 */
export function duplicatePackage(id: string): StorageResult<QuestionPackage> {
  const original = getPackageById(id);
  if (!original) {
    return {
      success: false,
      error: 'Paket soal sumber tidak ditemukan untuk diduplikasi.',
    };
  }

  const now = new Date().toISOString();
  const newPackage: QuestionPackage = {
    ...original,
    id: generateUniqueId(),
    title: `${original.title} (Salinan)`,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };

  return savePackage(newPackage);
}

/**
 * Mengambil profil identitas madrasah
 */
export function getSchoolProfile(): SchoolProfile | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.SCHOOL_PROFILE);
    if (!raw) return null;
    return JSON.parse(raw) as SchoolProfile;
  } catch (error) {
    console.error('Gagal membaca profil madrasah:', error);
    return null;
  }
}

/**
 * Menyimpan profil identitas madrasah
 */
export function saveSchoolProfile(profile: SchoolProfile): StorageResult<SchoolProfile> {
  if (!isLocalStorageAvailable()) {
    return {
      success: false,
      error: 'Penyimpanan lokal browser tidak tersedia.',
    };
  }

  try {
    const profileToSave: SchoolProfile = {
      ...profile,
      updatedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(STORAGE_KEYS.SCHOOL_PROFILE, JSON.stringify(profileToSave));

    // Sinkronisasi otomatis ke Neon PostgreSQL di latar belakang
    syncSchoolProfileToNeon(profileToSave).catch(() => {});

    return {
      success: true,
      data: profileToSave,
    };
  } catch (error: any) {
    console.error('Gagal menyimpan profil madrasah:', error);
    return {
      success: false,
      error: `Gagal menyimpan profil: ${error?.message || 'Kesalahan penyimpanan.'}`,
    };
  }
}

/**
 * Mengambil pengaturan aplikasi
 */
export function getAppSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (error) {
    console.error('Gagal membaca pengaturan aplikasi:', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Menyimpan pengaturan aplikasi
 */
export function saveAppSettings(settings: AppSettings): StorageResult<AppSettings> {
  if (!isLocalStorageAvailable()) {
    return {
      success: false,
      error: 'Penyimpanan lokal browser tidak tersedia.',
    };
  }

  try {
    window.localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    return { success: true, data: settings };
  } catch (error: any) {
    return {
      success: false,
      error: `Gagal menyimpan pengaturan: ${error?.message || 'Kesalahan sistem.'}`,
    };
  }
}

/**
 * Ekspor seluruh data untuk cadangan (Backup JSON)
 */
export function exportAllData(): string {
  const data = {
    appName: 'MADRASAH SMART SOAL',
    version: '1.0',
    exportedAt: new Date().toISOString(),
    packages: getStoredPackages(),
    schoolProfile: getSchoolProfile(),
    settings: getAppSettings(),
  };

  return JSON.stringify(data, null, 2);
}

/**
 * Impor data cadangan (Restore JSON) dengan validasi ketat
 */
export function importAllData(jsonString: string): StorageResult<{ packagesCount: number }> {
  if (!isLocalStorageAvailable()) {
    return {
      success: false,
      error: 'Penyimpanan lokal browser tidak tersedia.',
    };
  }

  try {
    const parsed = JSON.parse(jsonString);

    if (!parsed || typeof parsed !== 'object') {
      return {
        success: false,
        error: 'Format berkas JSON cadangan tidak valid.',
      };
    }

    if (!Array.isArray(parsed.packages)) {
      return {
        success: false,
        error: 'Berkas cadangan tidak memiliki daftar paket soal yang valid.',
      };
    }

    // Simpan paket soal
    window.localStorage.setItem(STORAGE_KEYS.PACKAGES, JSON.stringify(parsed.packages));

    // Simpan profil jika ada
    if (parsed.schoolProfile && typeof parsed.schoolProfile === 'object') {
      window.localStorage.setItem(STORAGE_KEYS.SCHOOL_PROFILE, JSON.stringify(parsed.schoolProfile));
    }

    // Simpan pengaturan jika ada
    if (parsed.settings && typeof parsed.settings === 'object') {
      window.localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(parsed.settings));
    }

    return {
      success: true,
      data: { packagesCount: parsed.packages.length },
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Gagal mengimpor berkas cadangan: ${error?.message || 'Format JSON rusak.'}`,
    };
  }
}

/**
 * Menghapus seluruh data aplikasi dari Local Storage
 */
export function clearAllData(): StorageResult {
  if (!isLocalStorageAvailable()) {
    return {
      success: false,
      error: 'Penyimpanan lokal browser tidak tersedia.',
    };
  }

  try {
    window.localStorage.removeItem(STORAGE_KEYS.PACKAGES);
    window.localStorage.removeItem(STORAGE_KEYS.SCHOOL_PROFILE);
    window.localStorage.removeItem(STORAGE_KEYS.SETTINGS);
    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: `Gagal menghapus data: ${error?.message || 'Kesalahan sistem.'}`,
    };
  }
}

/**
 * Menghitung estimasi penggunaan Local Storage
 */
export function getStorageUsage(): { usedKb: number; packageCount: number } {
  if (typeof window === 'undefined') return { usedKb: 0, packageCount: 0 };

  try {
    const packagesRaw = window.localStorage.getItem(STORAGE_KEYS.PACKAGES) || '';
    const profileRaw = window.localStorage.getItem(STORAGE_KEYS.SCHOOL_PROFILE) || '';
    const settingsRaw = window.localStorage.getItem(STORAGE_KEYS.SETTINGS) || '';

    const totalBytes =
      (packagesRaw.length + profileRaw.length + settingsRaw.length) * 2; // UTF-16
    const usedKb = Math.round((totalBytes / 1024) * 10) / 10;
    const packages = getStoredPackages();

    return {
      usedKb,
      packageCount: packages.length,
    };
  } catch {
    return { usedKb: 0, packageCount: 0 };
  }
}

/**
 * Menyinkronkan dan memuat paket terbaru dari Neon PostgreSQL jika tersedia
 */
export async function hydrateFromNeonIfAvailable(): Promise<{ packagesUpdated: number; profileUpdated: boolean }> {
  let packagesUpdated = 0;
  let profileUpdated = false;

  if (typeof window === 'undefined') {
    return { packagesUpdated, profileUpdated };
  }

  try {
    const [remotePackages, remoteProfile] = await Promise.all([
      pullPackagesFromNeon(),
      pullSchoolProfileFromNeon(),
    ]);

    if (Array.isArray(remotePackages) && remotePackages.length > 0) {
      const local = getStoredPackages();
      const localMap = new Map(local.map((p) => [p.id, p]));

      remotePackages.forEach((rp) => {
        const existing = localMap.get(rp.id);
        if (!existing || new Date(rp.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
          localMap.set(rp.id, rp);
          packagesUpdated++;
        }
      });

      const merged = Array.from(localMap.values()).sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      window.localStorage.setItem(STORAGE_KEYS.PACKAGES, JSON.stringify(merged));
    }

    if (remoteProfile && typeof remoteProfile === 'object' && remoteProfile.schoolName) {
      const localProfile = getSchoolProfile();
      if (
        !localProfile ||
        !localProfile.updatedAt ||
        new Date(remoteProfile.updatedAt || '').getTime() > new Date(localProfile.updatedAt || '').getTime()
      ) {
        window.localStorage.setItem(STORAGE_KEYS.SCHOOL_PROFILE, JSON.stringify(remoteProfile));
        profileUpdated = true;
      }
    }
  } catch (err) {
    console.warn('[Storage] Gagal sinkronisasi data dari Neon:', err);
  }

  return { packagesUpdated, profileUpdated };
}

