/**
 * Neon PostgreSQL Serverless Integration
 * MADRASAH SMART SOAL
 *
 * Menggunakan @neondatabase/serverless untuk koneksi instan HTTP/WebSockets
 * tanpa connection pooling bottleneck di lingkungan Vercel dan Node.js.
 * Kompatibel dengan konsol Neon: https://console.neon.tech
 */

import { neon } from '@neondatabase/serverless';
import { QuestionPackage, SchoolProfile } from '../../types';

export interface NeonDbStatus {
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
 * Mendapatkan connection string database dari environment variables.
 * Mendukung konvensi standar Neon Console dan integrasi Vercel:
 * - DATABASE_URL
 * - POSTGRES_URL
 * - NEON_DATABASE_URL
 * - POSTGRES_PRISMA_URL
 */
export function getNeonConnectionString(): string | null {
  const url =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.NEON_DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING;

  if (!url || typeof url !== 'string' || !url.trim()) {
    return null;
  }
  return url.trim();
}

/**
 * Memeriksa apakah kredensial database Neon telah dikonfigurasi
 */
export function isNeonConfigured(): boolean {
  return Boolean(getNeonConnectionString());
}

/**
 * Mendapatkan hostname dan nama database dengan masking kata sandi untuk keperluan audit/UI
 */
export function getSanitizedNeonEndpoint(connStr?: string | null): { host: string; database: string } {
  const target = connStr || getNeonConnectionString();
  if (!target) return { host: 'Tidak Dikonfigurasi', database: '-' };

  try {
    const url = new URL(target);
    const host = url.hostname || 'neon.tech';
    const database = (url.pathname || '/neondb').replace(/^\//, '') || 'neondb';
    return { host, database };
  } catch {
    // Fallback regex jika URL parser native gagal menangani skema tertentu
    const match = target.match(/@([^/:?]+)(?::\d+)?\/([^?]+)/);
    if (match) {
      return { host: match[1], database: match[2] };
    }
    return { host: 'Neon Postgres (Tersedia)', database: 'neondb' };
  }
}

let schemaInitialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Memeriksa apakah error PostgreSQL disebabkan oleh tabel/tipe yang sudah ada
 * akibat race condition saat beberapa serverless lambdas dieksekusi bersamaan.
 */
export function isAlreadyExistsError(err: any): boolean {
  if (!err) return false;
  const code = String(err.code || err.sqlState || '');
  const message = String(err.message || err.detail || '');
  return (
    code === '23505' || // unique_violation (Key typname, typnamespace already exists di pg_type)
    code === '42P07' || // duplicate_table
    code === '42710' || // duplicate_object
    code === '42P16' || // duplicate_pks
    message.includes('already exists') ||
    message.includes('pg_type_typname_nsp_index')
  );
}

/**
 * Menginisialisasi skema tabel otomatis jika belum ada.
 * Menggunakan to_regclass untuk pemeriksaan instan tanpa DDL lock,
 * serta menangani konflik concurrent race condition (error 23505 pada pg_type)
 * secara transparan di lingkungan Vercel Serverless.
 */
export async function initNeonSchema(sqlClient: any): Promise<void> {
  if (schemaInitialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // 1. Cek cepat apakah kedua tabel sudah ada tanpa acquire lock DDL
      try {
        const check = await sqlClient`
          SELECT 
            to_regclass('public.packages') IS NOT NULL AS has_packages,
            to_regclass('public.school_profile') IS NOT NULL AS has_school_profile;
        `;

        if (check && check[0]?.has_packages && check[0]?.has_school_profile) {
          schemaInitialized = true;
          return;
        }
      } catch {
        // Abaikan jika to_regclass gagal, lanjutkan ke pembuatan aman
      }

      // 2. Buat tabel packages jika belum ada
      try {
        await sqlClient`
          CREATE TABLE IF NOT EXISTS packages (
            id VARCHAR(120) PRIMARY KEY,
            data JSONB NOT NULL,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
          );
        `;
      } catch (err: any) {
        if (!isAlreadyExistsError(err)) throw err;
      }

      // 3. Buat indeks untuk pengurutan cepat
      try {
        await sqlClient`
          CREATE INDEX IF NOT EXISTS idx_packages_updated_at ON packages(updated_at DESC);
        `;
      } catch (err: any) {
        if (!isAlreadyExistsError(err)) throw err;
      }

      // 4. Buat tabel school_profile jika belum ada
      try {
        await sqlClient`
          CREATE TABLE IF NOT EXISTS school_profile (
            id VARCHAR(50) PRIMARY KEY,
            data JSONB NOT NULL,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
          );
        `;
      } catch (err: any) {
        if (!isAlreadyExistsError(err)) throw err;
      }

      schemaInitialized = true;
    } catch (err: any) {
      if (isAlreadyExistsError(err)) {
        schemaInitialized = true;
        return;
      }
      console.warn('[Neon DB] Gagal inisialisasi skema tabel:', err);
      throw err;
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}

/**
 * Mendapatkan instance client Neon
 */
export function getNeonSql() {
  const connStr = getNeonConnectionString();
  if (!connStr) {
    return null;
  }
  return neon(connStr);
}

/**
 * Menguji koneksi dan status database Neon
 */
export async function checkNeonConnection(): Promise<NeonDbStatus> {
  const connStr = getNeonConnectionString();
  const checkedAt = new Date().toISOString();

  if (!connStr) {
    return {
      configured: false,
      connected: false,
      provider: 'local',
      error: 'Variabel DATABASE_URL belum dikonfigurasi di lingkungan aplikasi/Vercel.',
      checkedAt,
    };
  }

  const { host, database } = getSanitizedNeonEndpoint(connStr);
  const start = Date.now();

  try {
    const sql = neon(connStr);
    await initNeonSchema(sql);

    // Kueri tes koneksi dan hitung jumlah paket yang tersimpan
    const rows = await sql`
      SELECT 
        COUNT(*)::int AS package_count,
        (SELECT COUNT(*)::int FROM school_profile WHERE id = 'default') AS profile_count
      FROM packages;
    `;

    const latencyMs = Date.now() - start;
    const packageCount = rows[0]?.package_count ? Number(rows[0].package_count) : 0;
    const hasSchoolProfile = Boolean(rows[0]?.profile_count && Number(rows[0].profile_count) > 0);

    return {
      configured: true,
      connected: true,
      provider: 'neon',
      endpointHost: host,
      databaseName: database,
      latencyMs,
      packageCount,
      hasSchoolProfile,
      checkedAt,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    return {
      configured: true,
      connected: false,
      provider: 'neon',
      endpointHost: host,
      databaseName: database,
      latencyMs,
      error: `Gagal tersambung ke Neon PostgreSQL: ${err?.message || 'Koneksi gagal'}`,
      checkedAt,
    };
  }
}

/**
 * Mengambil seluruh paket soal dari Neon DB
 */
export async function getAllPackagesFromDb(): Promise<QuestionPackage[] | null> {
  const sql = getNeonSql();
  if (!sql) return null;

  await initNeonSchema(sql);

  const rows = await sql`
    SELECT id, data, updated_at 
    FROM packages 
    ORDER BY updated_at DESC;
  `;

  if (!Array.isArray(rows)) return [];

  return rows
    .map((r: any) => {
      try {
        const item = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
        return item as QuestionPackage;
      } catch {
        return null;
      }
    })
    .filter((item): item is QuestionPackage => Boolean(item && item.id && item.title));
}

/**
 * Mengambil satu paket berdasarkan ID dari Neon DB
 */
export async function getPackageByIdFromDb(id: string): Promise<QuestionPackage | null> {
  const sql = getNeonSql();
  if (!sql) return null;

  await initNeonSchema(sql);

  const rows = await sql`
    SELECT data FROM packages WHERE id = ${id} LIMIT 1;
  `;

  if (!rows || rows.length === 0) return null;

  try {
    const raw = rows[0].data;
    return (typeof raw === 'string' ? JSON.parse(raw) : raw) as QuestionPackage;
  } catch {
    return null;
  }
}

/**
 * Menyimpan atau memperbarui paket soal ke Neon DB
 */
export async function savePackageToDb(pkg: QuestionPackage): Promise<QuestionPackage> {
  const sql = getNeonSql();
  if (!sql) {
    throw new Error('Database Neon belum dikonfigurasi (DATABASE_URL tidak ditemukan).');
  }

  await initNeonSchema(sql);

  const now = new Date().toISOString();
  const packageToSave: QuestionPackage = {
    ...pkg,
    updatedAt: now,
    createdAt: pkg.createdAt || now,
  };

  const payloadJson = JSON.stringify(packageToSave);

  await sql`
    INSERT INTO packages (id, data, updated_at)
    VALUES (${packageToSave.id}, ${payloadJson}::jsonb, NOW())
    ON CONFLICT (id) 
    DO UPDATE SET 
      data = EXCLUDED.data,
      updated_at = NOW();
  `;

  return packageToSave;
}

/**
 * Menghapus paket soal dari Neon DB
 */
export async function deletePackageFromDb(id: string): Promise<boolean> {
  const sql = getNeonSql();
  if (!sql) {
    throw new Error('Database Neon belum dikonfigurasi.');
  }

  await initNeonSchema(sql);

  const result = await sql`
    DELETE FROM packages WHERE id = ${id};
  `;

  return true;
}

/**
 * Mengambil profil madrasah dari Neon DB
 */
export async function getSchoolProfileFromDb(): Promise<SchoolProfile | null> {
  const sql = getNeonSql();
  if (!sql) return null;

  await initNeonSchema(sql);

  const rows = await sql`
    SELECT data FROM school_profile WHERE id = 'default' LIMIT 1;
  `;

  if (!rows || rows.length === 0) return null;

  try {
    const raw = rows[0].data;
    return (typeof raw === 'string' ? JSON.parse(raw) : raw) as SchoolProfile;
  } catch {
    return null;
  }
}

/**
 * Menyimpan profil madrasah ke Neon DB
 */
export async function saveSchoolProfileToDb(profile: SchoolProfile): Promise<SchoolProfile> {
  const sql = getNeonSql();
  if (!sql) {
    throw new Error('Database Neon belum dikonfigurasi.');
  }

  await initNeonSchema(sql);

  const now = new Date().toISOString();
  const profileToSave: SchoolProfile = {
    ...profile,
    updatedAt: now,
  };

  const payloadJson = JSON.stringify(profileToSave);

  await sql`
    INSERT INTO school_profile (id, data, updated_at)
    VALUES ('default', ${payloadJson}::jsonb, NOW())
    ON CONFLICT (id) 
    DO UPDATE SET 
      data = EXCLUDED.data,
      updated_at = NOW();
  `;

  return profileToSave;
}
