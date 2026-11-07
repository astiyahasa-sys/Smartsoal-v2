/**
 * Layanan Penyimpanan Gambar Lokal Berbasis IndexedDB
 * MADRASAH SMART SOAL
 * 
 * Melindungi dari batas kuota LocalStorage (~5MB) dengan menyimpan
 * gambar stimulus soal di IndexedDB peramban lokal secara asinkron,
 * namun tetap kompatibel dengan fallback data URL di memori / state aplikasi.
 */

const DB_NAME = 'MadrasahSmartSoal_DB';
const DB_VERSION = 1;
const IMAGE_STORE_NAME = 'question_images';

let dbInstance: IDBDatabase | null = null;

/**
 * Membuka koneksi IndexedDB dengan aman
 */
export function openIndexedDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }

  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: any) => {
        const db = event.target?.result as IDBDatabase;
        if (db && !db.objectStoreNames.contains(IMAGE_STORE_NAME)) {
          db.createObjectStore(IMAGE_STORE_NAME, { keyPath: 'id' });
        }
      };

      request.onsuccess = (event: any) => {
        dbInstance = event.target?.result as IDBDatabase;
        resolve(dbInstance);
      };

      request.onerror = () => {
        console.warn('Tidak dapat membuka IndexedDB, menggunakan penyimpanan memori.');
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}

/**
 * Menyimpan data URL gambar ke IndexedDB
 */
export async function saveImageToIndexedDb(imageId: string, dataUrl: string): Promise<boolean> {
  const db = await openIndexedDb();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IMAGE_STORE_NAME, 'readwrite');
      const store = tx.objectStore(IMAGE_STORE_NAME);
      const request = store.put({ id: imageId, dataUrl, updatedAt: Date.now() });

      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

/**
 * Mengambil data URL gambar dari IndexedDB
 */
export async function getImageFromIndexedDb(imageId: string): Promise<string | null> {
  const db = await openIndexedDb();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IMAGE_STORE_NAME, 'readonly');
      const store = tx.objectStore(IMAGE_STORE_NAME);
      const request = store.get(imageId);

      request.onsuccess = (e: any) => {
        const result = e.target?.result;
        resolve(result?.dataUrl || null);
      };
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Menghapus data gambar dari IndexedDB
 */
export async function deleteImageFromIndexedDb(imageId: string): Promise<boolean> {
  const db = await openIndexedDb();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IMAGE_STORE_NAME, 'readwrite');
      const store = tx.objectStore(IMAGE_STORE_NAME);
      const request = store.delete(imageId);

      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}
