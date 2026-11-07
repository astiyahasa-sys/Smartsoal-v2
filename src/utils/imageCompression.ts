/**
 * Utilitas Pengelolaan dan Kompresi Gambar untuk Butir Soal
 * MADRASAH SMART SOAL
 * 
 * Mengoptimalkan gambar agar:
 * 1. Muat dengan aman di Local Storage (menghindari QuotaExceededError ~5MB)
 * 2. Tajam dan proporsional untuk pratinjau cetak A4 dan ekspor Word (.docx)
 * 3. Mendukung konversi data URL ke Uint8Array untuk docx ImageRun
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.1 to 1.0 (default: 0.8)
  outputFormat?: 'image/jpeg' | 'image/webp' | 'image/png';
}

export interface CompressedImageResult {
  dataUrl: string;
  originalSize: number;
  compressedSize: number;
  width: number;
  height: number;
}

export const MAX_IMAGE_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/jpg',
  'image/gif',
  'image/svg+xml',
];

/**
 * Validasi berkas gambar yang diunggah oleh guru
 */
export function validateImageFile(file: File | Blob): { isValid: boolean; error?: string } {
  if (!file) {
    return { isValid: false, error: 'Berkas gambar tidak ditemukan.' };
  }

  // Validasi ukuran berkas
  if (file.size > MAX_IMAGE_FILE_SIZE_BYTES) {
    return {
      isValid: false,
      error: `Ukuran berkas terlalu besar (${(file.size / (1024 * 1024)).toFixed(1)} MB). Batas maksimum adalah 10 MB.`,
    };
  }

  // Validasi tipe MIME
  if (file.type && !SUPPORTED_IMAGE_TYPES.includes(file.type.toLowerCase()) && !file.type.startsWith('image/')) {
    return {
      isValid: false,
      error: 'Format berkas tidak didukung. Harap unggah berkas gambar dengan format JPG, JPEG, PNG, atau WEBP.',
    };
  }

  return { isValid: true };
}

/**
 * Kompresi berkas gambar dari File/Blob menggunakan Canvas di browser
 */
export async function compressImageFile(
  file: File | Blob,
  options: CompressionOptions = {}
): Promise<CompressedImageResult> {
  const {
    maxWidth = 800,
    maxHeight = 800,
    quality = 0.8,
    outputFormat = 'image/jpeg',
  } = options;

  const validation = validateImageFile(file);
  if (!validation.isValid) {
    throw new Error(validation.error || 'Berkas gambar tidak valid.');
  }

  const originalSize = file.size;

  return new Promise((resolve, reject) => {

    const reader = new FileReader();

    reader.onerror = () => reject(new Error('Gagal membaca berkas gambar.'));

    reader.onload = (readerEvent) => {
      const dataUrl = readerEvent.target?.result as string;
      if (!dataUrl) {
        return reject(new Error('Gagal memproses data gambar.'));
      }

      // Jika gambar SVG, jangan rasterisasi ke canvas; simpan langsung
      if (file.type === 'image/svg+xml') {
        return resolve({
          dataUrl,
          originalSize,
          compressedSize: dataUrl.length,
          width: 400,
          height: 300,
        });
      }

      const img = new Image();
      img.onerror = () => reject(new Error('Format berkas gambar tidak dapat dimuat.'));

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Hitung skala rasio agar tidak melebihi maxWidth/maxHeight
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Canvas context tidak tersedia pada peramban.'));
        }

        // Background putih untuk JPEG (menghindari latar hitam transparan)
        if (outputFormat === 'image/jpeg') {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
        }

        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL(outputFormat, quality);
        const approxSize = Math.round((compressedDataUrl.length * 3) / 4);

        resolve({
          dataUrl: compressedDataUrl,
          originalSize,
          compressedSize: approxSize,
          width,
          height,
        });
      };

      img.src = dataUrl;
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Ekstrak string Base64 murni dari Data URL (misal: "data:image/jpeg;base64,...")
 */
export function extractBase64FromDataUrl(dataUrl: string): string | null {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const match = dataUrl.match(/^data:image\/[a-zA-Z0-9+.-]+;base64,(.+)$/);
  if (match && match[1]) {
    return match[1];
  }
  // Jika sudah berupa base64 murni tanpa prefix data:
  if (/^[A-Za-z0-9+/=]+$/.test(dataUrl.trim()) && dataUrl.length > 50) {
    return dataUrl.trim();
  }
  return null;
}

/**
 * Konversi Data URL atau string Base64 ke Uint8Array (kompatibel dengan Node.js dan Browser)
 */
export function dataUrlToUint8Array(dataUrlOrBase64: string): Uint8Array | null {
  const base64Str = extractBase64FromDataUrl(dataUrlOrBase64);
  if (!base64Str) return null;

  try {
    if (typeof Buffer !== 'undefined') {
      return new Uint8Array(Buffer.from(base64Str, 'base64'));
    }
    const binary = atob(base64Str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch (err) {
    console.error('Gagal mengonversi base64 ke Uint8Array:', err);
    return null;
  }
}
