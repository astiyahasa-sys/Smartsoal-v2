import React, { useState, useEffect } from 'react';
import {
  Settings,
  HardDrive,
  Download,
  Upload,
  Trash2,
  Save,
  CheckCircle2,
  AlertTriangle,
  Info,
  ShieldAlert,
  Database,
  Cloud,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import { AppSettings, DifficultyLevel } from '../../types';
import {
  exportAllData,
  importAllData,
  getStorageUsage,
  getStoredPackages,
  checkCloudDbStatus,
  hydrateFromNeonIfAvailable,
  uploadAllLocalPackagesToNeon,
  CloudDbStatus,
} from '../../services/storage';

interface SettingsViewProps {
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
  onResetAllDataRequest: () => void;
  onRefreshData: () => void;
  setToast: (toast: { id: string; type: 'success' | 'error' | 'info'; message: string }) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSaveSettings,
  onResetAllDataRequest,
  onRefreshData,
  setToast,
}) => {
  const [defaultAcademicYear, setDefaultAcademicYear] = useState(
    settings.defaultAcademicYear
  );
  const [defaultDuration, setDefaultDuration] = useState(
    settings.defaultDurationMinutes
  );
  const [defaultDifficulty, setDefaultDifficulty] = useState<DifficultyLevel>(
    settings.defaultDifficulty
  );
  const [autoFill, setAutoFill] = useState(settings.autoFillSchoolProfile);

  // Status dan konfigurasi Neon PostgreSQL
  const [neonStatus, setNeonStatus] = useState<CloudDbStatus | null>(null);
  const [isCheckingNeon, setIsCheckingNeon] = useState(false);
  const [isSyncingNeon, setIsSyncingNeon] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);
  const [showNeonGuide, setShowNeonGuide] = useState(false);

  const storageInfo = getStorageUsage();

  useEffect(() => {
    checkCloudDbStatus()
      .then(setNeonStatus)
      .catch(() => {});
  }, []);

  const handleTestAndSyncNeon = async () => {
    setIsCheckingNeon(true);
    try {
      const status = await checkCloudDbStatus();
      setNeonStatus(status);

      if (status.connected) {
        setIsSyncingNeon(true);
        // Unggah paket lokal ke Neon PostgreSQL
        const localPkgs = getStoredPackages();
        const uploadRes = await uploadAllLocalPackagesToNeon(localPkgs);

        // Tarik data terbaru dari Neon
        await hydrateFromNeonIfAvailable();
        onRefreshData();

        setToast({
          id: Date.now().toString(),
          type: 'success',
          message: `Neon PostgreSQL terhubung! Latensi: ${status.latencyMs || 0}ms. ${uploadRes.syncedCount} paket tersinkronisasi.`,
        });
      } else {
        setToast({
          id: Date.now().toString(),
          type: 'info',
          message: status.configured
            ? `Koneksi gagal: ${status.error || 'Periksa connection string di Vercel.'}`
            : 'DATABASE_URL belum diatur di Vercel / Environment. Buka panduan di bawah untuk menghubungkan neon.console.',
        });
      }
    } catch (err: any) {
      setToast({
        id: Date.now().toString(),
        type: 'error',
        message: `Gagal menguji koneksi: ${err?.message || 'Kesalahan jaringan'}`,
      });
    } finally {
      setIsCheckingNeon(false);
      setIsSyncingNeon(false);
    }
  };

  const handleCopyEnvTemplate = () => {
    const template = 'DATABASE_URL="postgresql://user:password@ep-sample-1234.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"';
    navigator.clipboard?.writeText(template).then(() => {
      setCopiedEnv(true);
      setTimeout(() => setCopiedEnv(false), 2500);
      setToast({
        id: Date.now().toString(),
        type: 'success',
        message: 'Format variabel DATABASE_URL berhasil disalin ke clipboard.',
      });
    });
  };

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings({
      defaultAcademicYear,
      defaultDurationMinutes: Math.max(1, Number(defaultDuration) || 90),
      defaultDifficulty,
      autoFillSchoolProfile: autoFill,
      confirmBeforeDelete: true,
    });
  };

  const handleExportBackup = () => {
    try {
      const dataStr = exportAllData();
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const now = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `madrasah_smart_soal_cadangan_${now}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setToast({
        id: Date.now().toString(),
        type: 'success',
        message: 'Berkas cadangan JSON berhasil diunduh ke komputer Anda.',
      });
    } catch (err: any) {
      setToast({
        id: Date.now().toString(),
        type: 'error',
        message: `Gagal mengekspor data: ${err?.message || 'Kesalahan sistem'}`,
      });
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        const result = importAllData(content);
        if (result.success) {
          onRefreshData();
          setToast({
            id: Date.now().toString(),
            type: 'success',
            message: `Cadangan berhasil dipulihkan! ${result.data?.packagesCount || 0} paket dimuat.`,
          });
        } else {
          setToast({
            id: Date.now().toString(),
            type: 'error',
            message: result.error || 'Gagal memulihkan cadangan data.',
          });
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-150">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200">
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
          <Settings className="w-7 h-7 text-teal-700" />
          <span>Pengaturan Aplikasi</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Sesuaikan preferensi penyusunan soal serta kelola cadangan data peramban Anda.
        </p>
      </div>

      {/* Card 1: Preferensi Nilai Default */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          <Settings className="w-5 h-5 text-teal-700" />
          <h2 className="text-sm font-bold text-slate-900">Preferensi Formulir Default</h2>
        </div>

        <form onSubmit={handleSavePreferences} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Tahun Pelajaran Default
              </label>
              <input
                type="text"
                value={defaultAcademicYear}
                onChange={(e) => setDefaultAcademicYear(e.target.value)}
                placeholder="2024/2025"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Alokasi Waktu Asesmen Default (Menit)
              </label>
              <input
                type="number"
                min="1"
                max="300"
                value={defaultDuration}
                onChange={(e) => setDefaultDuration(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Tingkat Kesulitan Default
              </label>
              <select
                value={defaultDifficulty}
                onChange={(e) => setDefaultDifficulty(e.target.value as DifficultyLevel)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm bg-white"
              >
                <option value="Campuran">Campuran (Mudah, Sedang, Sulit / HOTS)</option>
                <option value="Mudah">Mudah</option>
                <option value="Sedang">Sedang</option>
                <option value="Sulit">Sulit</option>
              </select>
            </div>

            <div className="flex items-center pt-6">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoFill}
                  onChange={(e) => setAutoFill(e.target.checked)}
                  className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300"
                />
                <span className="text-xs font-semibold text-slate-700">
                  Otomatis isi Nama Madrasah & Guru pada formulir baru
                </span>
              </label>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-xs transition"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Preferensi</span>
            </button>
          </div>
        </form>
      </div>

      {/* Card: Database Cloud Neon PostgreSQL (console.neon.tech) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 bg-gradient-to-r from-emerald-900 to-teal-900 text-white flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
              <Database className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-tight">Database Cloud: Neon PostgreSQL</h2>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-200 border border-emerald-400/30">
                  console.neon.tech
                </span>
              </div>
              <p className="text-[11px] text-emerald-200/80">
                Penyimpanan cloud serverless tangguh & gratis untuk naskah soal madrasah saat di-deploy di Vercel.
              </p>
            </div>
          </div>

          {/* Status Badge */}
          <div>
            {neonStatus?.connected ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500 text-white font-bold text-xs shadow-xs">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Terhubung ke Neon</span>
              </span>
            ) : neonStatus?.configured ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500 text-white font-bold text-xs shadow-xs">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Koneksi Gagal</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500 text-white font-bold text-xs shadow-xs">
                <HardDrive className="w-3.5 h-3.5" />
                <span>Mode Offline (LocalStorage)</span>
              </span>
            )}
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Detail Status Koneksi */}
          {neonStatus?.connected ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200/80">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Endpoint Host</p>
                <p className="text-xs font-semibold text-emerald-950 truncate mt-0.5" title={neonStatus.endpointHost}>
                  {neonStatus.endpointHost || 'ep-***.neon.tech'}
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200/80">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Latensi Respons</p>
                <p className="text-xs font-bold text-emerald-950 mt-0.5">
                  {neonStatus.latencyMs !== undefined ? `${neonStatus.latencyMs} ms` : '-'}
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200/80">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Paket di Cloud</p>
                <p className="text-xs font-bold text-emerald-950 mt-0.5">
                  {neonStatus.packageCount || 0} Paket Naskah
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-amber-950">
                <Info className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Neon PostgreSQL Belum Aktif — Menggunakan Penyimpanan Lokal</span>
              </div>
              <p className="text-[11px] leading-relaxed text-amber-800">
                Semua naskah soal dan profil madrasah Anda saat ini tersimpan aman di peramban ini (LocalStorage). Untuk menyimpan data secara permanen di cloud agar tidak hilang saat berganti perangkat atau deploy di Vercel, cukup tambahkan variabel <strong>DATABASE_URL</strong> dari akun gratis <strong>console.neon.tech</strong>.
              </p>
              {neonStatus?.error && (
                <p className="text-[11px] font-mono text-rose-700 bg-rose-50 p-2 rounded-lg border border-rose-200 mt-2">
                  Diagnostik: {neonStatus.error}
                </p>
              )}
            </div>
          )}

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleTestAndSyncNeon}
                disabled={isCheckingNeon || isSyncingNeon}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs transition disabled:opacity-60 shadow-xs cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isCheckingNeon || isSyncingNeon ? 'animate-spin' : ''}`} />
                <span>
                  {isSyncingNeon
                    ? 'Menyinkronkan Paket...'
                    : isCheckingNeon
                    ? 'Memeriksa Koneksi...'
                    : 'Uji Koneksi & Sinkronkan Sekarang'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleCopyEnvTemplate}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition cursor-pointer"
              >
                {copiedEnv ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                <span>{copiedEnv ? 'Tersalin!' : 'Salin Contoh Format URL'}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowNeonGuide(!showNeonGuide)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-700 hover:text-teal-900 transition underline underline-offset-4 cursor-pointer"
            >
              <span>{showNeonGuide ? 'Tutup Panduan Neon' : 'Lihat Cara Hubungkan console.neon.tech'}</span>
            </button>
          </div>

          {/* Expandable Setup Guide */}
          {showNeonGuide && (
            <div className="mt-4 p-5 rounded-xl bg-slate-900 text-slate-100 space-y-4 border border-slate-800 text-xs animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold text-white text-sm">Langkah Praktis Menghubungkan Neon Console (5 Menit)</span>
                </div>
                <a
                  href="https://console.neon.tech"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 font-semibold text-[11px] transition"
                >
                  <span>Buka console.neon.tech</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <ol className="list-decimal list-inside space-y-2.5 text-slate-300 text-[11px] leading-relaxed">
                <li>
                  Buka situs resmi <strong className="text-white">console.neon.tech</strong> dan daftar/masuk menggunakan akun Google atau GitHub Anda (100% gratis, tanpa kartu kredit).
                </li>
                <li>
                  Klik <strong className="text-white">"New Project"</strong>, beri nama misalnya <code className="px-1.5 py-0.5 rounded bg-slate-800 text-emerald-300">madrasah-soal</code>, lalu pilih Region terdekat (contoh: <strong className="text-white">Singapore / AWS ap-southeast-1</strong>).
                </li>
                <li>
                  Pada dashboard proyek, cari bagian <strong className="text-white">Connection Details</strong>. Pilih mode <code className="px-1.5 py-0.5 rounded bg-slate-800 text-emerald-300">Pooled connection</code> atau <code className="px-1.5 py-0.5 rounded bg-slate-800 text-emerald-300">Direct connection</code>, lalu salin Connection String PostgreSQL Anda.
                </li>
                <li>
                  Format connection string Neon akan berbentuk:
                  <div className="my-2 p-2.5 rounded-lg bg-slate-950 font-mono text-[11px] text-emerald-300 border border-slate-800 break-all select-all">
                    DATABASE_URL="postgresql://alex:AbCdEf123@ep-cool-snowflake-123456.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
                  </div>
                </li>
                <li>
                  Buka dashboard proyek Anda di <strong className="text-white">Vercel</strong> &gt; pilih menu <strong className="text-white">Settings</strong> &gt; <strong className="text-white">Environment Variables</strong>:
                  <ul className="list-disc list-inside mt-1 ml-3 space-y-1 text-slate-400">
                    <li>Key: <code className="text-white font-mono">DATABASE_URL</code> (atau <code className="text-white font-mono">POSTGRES_URL</code>)</li>
                    <li>Value: Salin connection string dari Neon Console tadi</li>
                    <li>Centang opsi Production, Preview, dan Development</li>
                  </ul>
                </li>
                <li>
                  Lakukan <strong className="text-white">Redeploy</strong> pada Vercel. Aplikasi <strong className="text-emerald-400 font-bold">otomatis membuat tabel "packages" dan "school_profile"</strong> tanpa perlu Anda menulis perintah SQL manual sama sekali!
                </li>
              </ol>
            </div>
          )}
        </div>
      </div>

      {/* Card 2: Pengelolaan & Cadangan Local Storage */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-teal-700" />
            <h2 className="text-sm font-bold text-slate-900">
              Penyimpanan & Cadangan Data Peramban
            </h2>
          </div>
          <span className="text-xs font-semibold text-slate-600">
            Terpakai: <strong>{storageInfo.usedKb} KB</strong> ({storageInfo.packageCount} paket)
          </span>
        </div>

        <div className="p-6 space-y-5">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1.5 leading-relaxed">
            <div className="flex items-center gap-2 font-bold text-slate-800">
              <Info className="w-4 h-4 text-teal-700" />
              <span>Penting: Memahami Batas Local Storage</span>
            </div>
            <p>
              Data disimpan khusus pada browser dan komputer yang saat ini Anda gunakan.
              Jika Anda berganti laptop atau membersihkan riwayat cache browser, data dapat
              terhapus. <strong>Sangat disarankan</strong> untuk mengunduh cadangan JSON secara berkala agar naskah Anda selalu aman.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            {/* Ekspor Cadangan */}
            <div className="p-4 rounded-xl border border-slate-200 space-y-3">
              <div>
                <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-teal-700" />
                  <span>Cadangkan Data (Ekspor JSON)</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-1">
                  Unduh seluruh paket soal, profil madrasah, dan pengaturan ke dalam berkas JSON.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportBackup}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-teal-600 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold transition"
              >
                <Download className="w-4 h-4" />
                <span>Unduh Berkas Cadangan</span>
              </button>
            </div>

            {/* Impor Cadangan */}
            <div className="p-4 rounded-xl border border-slate-200 space-y-3">
              <div>
                <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Upload className="w-4 h-4 text-sky-700" />
                  <span>Pulihkan Data (Impor JSON)</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-1">
                  Muat kembali berkas cadangan JSON yang pernah Anda unduh sebelumnya.
                </p>
              </div>

              <label className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer">
                <Upload className="w-4 h-4" />
                <span>Pilih Berkas Cadangan</span>
                <input
                  type="file"
                  accept="application/json"
                  onChange={handleImportBackup}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Card 3: Zona Bahaya (Reset Data) */}
      <div className="bg-rose-50/50 rounded-2xl border border-rose-200 shadow-xs p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-rose-100 text-rose-600 shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-rose-900">Zona Bahaya: Bersihkan Seluruh Data</h3>
            <p className="text-xs text-rose-700 mt-1 leading-relaxed">
              Tindakan ini akan menghapus permanen seluruh paket soal, profil madrasah, dan pengaturan yang tersimpan di Local Storage browser ini. Tindakan ini tidak dapat dibatalkan.
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onResetAllDataRequest}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition"
          >
            <Trash2 className="w-4 h-4" />
            <span>Hapus Seluruh Data Aplikasi</span>
          </button>
        </div>
      </div>
    </div>
  );
};
