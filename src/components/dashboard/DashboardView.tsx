import React, { useState, useEffect } from 'react';
import {
  PlusCircle,
  FileText,
  HelpCircle,
  Table2,
  Copy,
  Trash2,
  Eye,
  Edit,
  Clock,
  HardDrive,
  School,
  Sparkles,
  ArrowRight,
  BookOpen,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Zap,
  FileDown,
} from 'lucide-react';
import { ActiveView, QuestionPackage, SchoolProfile, AiStatusResponse } from '../../types';
import { formatIndonesianDate, calculateTotalQuestions } from '../../utils/curriculum';
import { checkAiApiStatus } from '../../services/apiStatusService';
import { downloadWordPackage, downloadPdfPackage } from '../../services/exportService';

interface DashboardViewProps {
  packages: QuestionPackage[];
  schoolProfile: SchoolProfile | null;
  onNavigate: (view: ActiveView) => void;
  onOpenPackage: (pkg: QuestionPackage) => void;
  onEditPackage: (pkg: QuestionPackage) => void;
  onDuplicatePackage: (id: string) => void;
  onDeletePackageRequest: (pkg: QuestionPackage) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  packages,
  schoolProfile,
  onNavigate,
  onOpenPackage,
  onEditPackage,
  onDuplicatePackage,
  onDeletePackageRequest,
}) => {
  // Hitung metrik nyata dari penyimpanan lokal
  const totalPackages = packages.length;

  const totalQuestions = packages.reduce((acc, curr) => {
    return (
      acc +
      calculateTotalQuestions(
        curr.multipleChoiceCount,
        curr.shortAnswerCount,
        curr.essayCount,
        curr.complexMultipleChoiceCount
      )
    );
  }, 0);

  // Kisi-kisi terdata dihitung dari paket yang memiliki indikator kompetensi / tujuan
  const totalMatrices = packages.filter(
    (p) => p.topic && p.learningObjectives
  ).length;

  const recentPackages = packages.slice(0, 5);

  // Status kesehatan koneksi layanan AI
  const [apiStatus, setApiStatus] = useState<AiStatusResponse | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState<boolean>(true);
  const [isVerifyingLive, setIsVerifyingLive] = useState<boolean>(false);
  const [downloadingPkg, setDownloadingPkg] = useState<{ id: string; type: 'word' | 'pdf' } | null>(null);

  const handleQuickDownload = async (pkg: QuestionPackage, type: 'word' | 'pdf') => {
    setDownloadingPkg({ id: pkg.id, type });
    try {
      if (type === 'word') {
        await downloadWordPackage(pkg, schoolProfile || null, { includeAnswers: false });
      } else {
        await downloadPdfPackage(pkg, schoolProfile || null, { includeAnswers: false });
      }
    } catch (err) {
      console.error('Quick download failed:', err);
    } finally {
      setDownloadingPkg(null);
    }
  };

  const fetchStatus = async (live = false) => {
    if (live) {
      setIsVerifyingLive(true);
    } else {
      setIsLoadingStatus(true);
    }

    try {
      const res = await checkAiApiStatus(live);
      setApiStatus(res);
    } catch {
      setApiStatus({
        success: false,
        status: 'service_issue',
        connected: false,
        model: 'gemini-2.5-flash',
        message: 'Tidak dapat terhubung ke endpoint status server.',
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsLoadingStatus(false);
      setIsVerifyingLive(false);
    }
  };

  useEffect(() => {
    fetchStatus(false);
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 border border-teal-800/40 p-6 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-teal-500/20 text-teal-300 border border-teal-500/30">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Sistem Asesmen Madrasah Ibtidaiyah</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Selamat Datang di Madrasah Smart Soal
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Platform modern penyusunan naskah soal asesmen formatif, sumatif materi,
              dan Asesmen Madrasah (AM) berstandar Kurikulum Merdeka Kemenag RI.
            </p>
            {schoolProfile ? (
              <div className="pt-2 flex items-center gap-2 text-xs text-teal-200">
                <School className="w-4 h-4 text-teal-400 shrink-0" />
                <span>
                  Unit Madrasah:{' '}
                  <strong className="text-white">{schoolProfile.schoolName}</strong> —{' '}
                  {schoolProfile.city || 'Indonesia'}
                </span>
              </div>
            ) : (
              <div className="pt-2 flex items-center gap-2 text-xs text-amber-300">
                <School className="w-4 h-4 shrink-0" />
                <span>
                  Identitas madrasah belum dilengkapi.{' '}
                  <button
                    type="button"
                    onClick={() => onNavigate('identitas-madrasah')}
                    className="underline font-bold hover:text-white"
                  >
                    Lengkapi sekarang
                  </button>
                </span>
              </div>
            )}
          </div>

          <div className="shrink-0 flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <button
              type="button"
              onClick={() => onNavigate('create-package')}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-sm shadow-lg shadow-teal-500/30 transition transform hover:-translate-y-0.5"
            >
              <PlusCircle className="w-5 h-5" />
              <span>Buat Paket Soal Baru</span>
            </button>
          </div>
        </div>

        {/* Ambient background glow */}
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Indikator Kesehatan Koneksi Layanan AI */}
      <div
        className={`p-4 sm:p-5 rounded-2xl border transition shadow-xs ${
          isLoadingStatus
            ? 'bg-slate-50 border-slate-200'
            : apiStatus?.status === 'ready'
            ? 'bg-gradient-to-r from-emerald-50/90 via-teal-50/60 to-white border-emerald-300'
            : apiStatus?.status === 'api_key_missing'
            ? 'bg-amber-50/90 border-amber-300'
            : 'bg-rose-50/90 border-rose-300'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                isLoadingStatus
                  ? 'bg-slate-200 text-slate-600 animate-pulse'
                  : apiStatus?.status === 'ready'
                  ? 'bg-emerald-600 text-white'
                  : apiStatus?.status === 'api_key_missing'
                  ? 'bg-amber-500 text-white'
                  : 'bg-rose-600 text-white'
              }`}
            >
              {isLoadingStatus ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : apiStatus?.status === 'ready' ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : apiStatus?.status === 'api_key_missing' ? (
                <AlertTriangle className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">
                  Status Layanan AI (Gemini)
                </h2>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                    isLoadingStatus
                      ? 'bg-slate-200 text-slate-700'
                      : apiStatus?.status === 'ready'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : apiStatus?.status === 'api_key_missing'
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : 'bg-rose-100 text-rose-900 border border-rose-300'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isLoadingStatus
                        ? 'bg-slate-400'
                        : apiStatus?.status === 'ready'
                        ? 'bg-emerald-500 animate-pulse'
                        : apiStatus?.status === 'api_key_missing'
                        ? 'bg-amber-500 animate-pulse'
                        : 'bg-rose-500 animate-pulse'
                    }`}
                  />
                  <span>
                    {isLoadingStatus
                      ? 'Memeriksa...'
                      : apiStatus?.status === 'ready'
                      ? (apiStatus.liveVerified ? 'Online & Terverifikasi' : 'Layanan AI Siap')
                      : apiStatus?.status === 'api_key_missing'
                      ? 'API Key Belum Dikonfigurasi'
                      : apiStatus?.status === 'api_key_invalid'
                      ? 'Kunci API Tidak Valid'
                      : apiStatus?.status === 'quota_exceeded'
                      ? 'Batas Kuota Tercapai'
                      : 'Layanan AI Mengalami Gangguan'}
                  </span>
                </span>

                {apiStatus?.model && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                    Model: {apiStatus.model}
                  </span>
                )}

                {apiStatus?.latencyMs !== undefined && apiStatus.latencyMs > 0 && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-teal-100/70 text-teal-800 border border-teal-200">
                    Respons: {apiStatus.latencyMs} ms
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                {isLoadingStatus
                  ? 'Sedang menghubungi server untuk memeriksa ketersediaan API key dan layanan Gemini AI...'
                  : apiStatus?.message || 'Informasi status koneksi layanan AI.'}
              </p>

              {apiStatus?.tips && (
                <p className="text-[11px] text-amber-800 font-medium pt-0.5">
                  💡 {apiStatus.tips}
                </p>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <button
              type="button"
              onClick={() => fetchStatus(false)}
              disabled={isLoadingStatus || isVerifyingLive}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition disabled:opacity-50"
              title="Periksa ulang status konfigurasi"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${isLoadingStatus ? 'animate-spin' : ''}`} />
              <span>Cek Status</span>
            </button>

            <button
              type="button"
              onClick={() => fetchStatus(true)}
              disabled={isLoadingStatus || isVerifyingLive}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-teal-300 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-semibold shadow-2xs transition disabled:opacity-50"
              title="Kirim verifikasi langsung ke Google Gemini API"
            >
              {isVerifyingLive ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-700" />
                  <span>Menguji...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 text-teal-600" />
                  <span>Uji Sambungan AI</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Storage Information Banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-900 text-xs sm:text-sm">
        <HardDrive className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-bold">Penyimpanan Lokal Browser Aktif:</span> Seluruh
          data draf dan paket soal tersimpan secara privat di memori peramban
          (Local Storage) perangkat Anda. Data tidak diunggah ke server pihak ketiga
          sehingga aman dan tetap tersedia meski tanpa sambungan internet.
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Card 1: Paket Soal */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Paket Soal Tersimpan
            </span>
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-slate-900">{totalPackages}</div>
            <p className="mt-1 text-xs text-slate-500">
              {totalPackages === 0
                ? 'Belum ada draf naskah tersimpan'
                : `${totalPackages} draf paket siap diedit & dicetak`}
            </p>
          </div>
        </div>

        {/* Card 2: Total Butir Soal */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Butir Soal Terencana
            </span>
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center">
              <HelpCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-slate-900">{totalQuestions}</div>
            <p className="mt-1 text-xs text-slate-500">
              {totalQuestions === 0
                ? 'Akumulasi butir soal (PG, PG Kompleks, Isian, Uraian)'
                : `Gabungan butir soal dari seluruh paket`}
            </p>
          </div>
        </div>

        {/* Card 3: Kisi-kisi Terdata */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Matriks Kisi-kisi Siap
            </span>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <Table2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-slate-900">{totalMatrices}</div>
            <p className="mt-1 text-xs text-slate-500">
              {totalMatrices === 0
                ? 'Matriks capaian & indikator pembelajaran'
                : `${totalMatrices} paket memiliki spesifikasi capaian`}
            </p>
          </div>
        </div>
      </div>

      {/* Recent Packages Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Daftar Paket Soal Terbaru</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Kelola naskah soal asesmen yang baru-baru ini Anda buat
            </p>
          </div>
          {packages.length > 0 && (
            <button
              type="button"
              onClick={() => onNavigate('bank-soal')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:text-teal-900 transition"
            >
              <span>Lihat Semua di Bank Soal</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {recentPackages.length === 0 ? (
          /* Empty State */
          <div className="p-10 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
              <BookOpen className="w-8 h-8" />
            </div>
            <div className="max-w-sm mx-auto space-y-1">
              <h3 className="text-base font-bold text-slate-800">
                Belum Ada Paket Soal Tersimpan
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Mulai menyusun rancangan paket asesmen MI pertama Anda. Tentukan mata
                pelajaran, kelas, kompetensi, dan komposisi butir soal.
              </p>
            </div>
            <div>
              <button
                type="button"
                onClick={() => onNavigate('create-package')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs shadow-xs transition"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Buat Paket Soal Pertama</span>
              </button>
            </div>
          </div>
        ) : (
          /* List of Recent Packages */
          <div className="divide-y divide-slate-100">
            {recentPackages.map((pkg) => {
              const total = calculateTotalQuestions(
                pkg.multipleChoiceCount,
                pkg.shortAnswerCount,
                pkg.essayCount
              );

              return (
                <div
                  key={pkg.id}
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/70 transition"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-100 text-teal-800">
                        {pkg.subject}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700">
                        Kelas {pkg.grade} ({pkg.phase})
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600">
                        {pkg.assessmentType}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                          pkg.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {pkg.status === 'completed' ? 'Selesai' : 'Draf'}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 truncate">
                      {pkg.title}
                    </h3>

                    <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500">
                      <span>Materi: {pkg.topic}</span>
                      <span>•</span>
                      <span>Total: {total} Soal (PG: {pkg.multipleChoiceCount}, Isian: {pkg.shortAnswerCount}, Uraian: {pkg.essayCount})</span>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {formatIndonesianDate(pkg.updatedAt || pkg.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 self-start md:self-center shrink-0">
                    <button
                      type="button"
                      onClick={() => onOpenPackage(pkg)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 text-slate-700 hover:text-teal-700 text-xs font-semibold bg-white shadow-2xs transition"
                      title="Lihat Pratinjau Naskah"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Buka</span>
                    </button>

                    {/* Quick Word */}
                    <button
                      type="button"
                      onClick={() => handleQuickDownload(pkg, 'word')}
                      disabled={downloadingPkg?.id === pkg.id}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-800 text-xs font-semibold shadow-2xs transition disabled:opacity-50"
                      title="Unduh Naskah Word (.docx)"
                    >
                      {downloadingPkg?.id === pkg.id && downloadingPkg.type === 'word' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                      ) : (
                        <FileText className="w-3.5 h-3.5 text-blue-600" />
                      )}
                      <span>Word</span>
                    </button>

                    {/* Quick PDF */}
                    <button
                      type="button"
                      onClick={() => handleQuickDownload(pkg, 'pdf')}
                      disabled={downloadingPkg?.id === pkg.id}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-800 text-xs font-semibold shadow-2xs transition disabled:opacity-50"
                      title="Unduh Naskah PDF (.pdf)"
                    >
                      {downloadingPkg?.id === pkg.id && downloadingPkg.type === 'pdf' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600" />
                      ) : (
                        <FileDown className="w-3.5 h-3.5 text-rose-600" />
                      )}
                      <span>PDF</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onEditPackage(pkg)}
                      className="p-1.5 rounded-lg border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-sky-700 text-xs font-semibold bg-white shadow-2xs transition"
                      title="Edit Rancangan Paket"
                      aria-label="Edit paket"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onDuplicatePackage(pkg.id)}
                      className="p-1.5 rounded-lg border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-900 text-xs font-semibold bg-white shadow-2xs transition"
                      title="Duplikasi Paket Soal"
                      aria-label="Duplikasi paket"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeletePackageRequest(pkg)}
                      className="p-1.5 rounded-lg border border-rose-200 hover:border-rose-300 text-rose-600 hover:bg-rose-50 text-xs font-semibold bg-white shadow-2xs transition"
                      title="Hapus Paket Soal"
                      aria-label="Hapus paket"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
