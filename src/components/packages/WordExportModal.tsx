import React, { useState } from 'react';
import {
  X,
  FileText,
  FileDown,
  CheckCircle2,
  Building,
  UserCheck,
  Sparkles,
  Layers,
  HelpCircle,
  Loader2,
  FileCheck,
} from 'lucide-react';
import { QuestionPackage, SchoolProfile } from '../../types';
import { downloadWordBundle } from '../../services/exportService';
import { getSchoolProfile } from '../../services/storage';

interface WordExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  pkg: QuestionPackage;
  schoolProfile?: SchoolProfile | null;
}

export const WordExportModal: React.FC<WordExportModalProps> = ({
  isOpen,
  onClose,
  pkg,
  schoolProfile,
}) => {
  const [selectedMode, setSelectedMode] = useState<'full' | 'questions_only' | 'answers_only'>('full');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Ambil profil madrasah aktif (fallback ke penyimpanan lokal jika prop bernilai null)
  const activeProfile = schoolProfile || getSchoolProfile();

  if (!isOpen) return null;

  const schoolName = pkg.schoolName || activeProfile?.schoolName || 'Madrasah Ibtidaiyah';
  const fullAddress = [
    activeProfile?.address,
    activeProfile?.village ? `Desa/Kel. ${activeProfile.village}` : '',
    activeProfile?.subdistrict ? `Kec. ${activeProfile.subdistrict}` : '',
    activeProfile?.city,
    activeProfile?.province,
  ]
    .filter(Boolean)
    .join(', ');

  const handleDownload = async () => {
    setIsDownloading(true);
    setDownloadSuccess(false);
    try {
      await downloadWordBundle(pkg, activeProfile, selectedMode);
      setDownloadSuccess(true);
      setTimeout(() => {
        setDownloadSuccess(false);
        onClose();
      }, 1400);
    } catch (err) {
      console.error('Gagal mengunduh dokumen Word:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="word-export-title"
    >
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-linear-to-r from-blue-700 via-blue-800 to-indigo-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shadow-xs border border-white/20">
              <FileText className="w-5 h-5 text-blue-100" />
            </div>
            <div>
              <h2 id="word-export-title" className="text-base font-bold text-white tracking-tight">
                Unduh Dokumen Microsoft Word (.docx)
              </h2>
              <p className="text-xs text-blue-150">
                Format resmi Kemenag RI dengan Kop Surat Madrasah & Tanda Tangan
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDownloading}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition"
            aria-label="Tutup dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto text-slate-700 text-sm">
          {/* Card Profil Madrasah & Kop Surat */}
          <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/50 flex flex-col gap-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                {activeProfile?.logoUrl ? (
                  <div className="w-12 h-12 rounded-xl bg-white border border-blue-200 p-1 flex items-center justify-center shadow-2xs shrink-0 overflow-hidden">
                    <img
                      src={activeProfile.logoUrl}
                      alt="Logo Madrasah"
                      className="w-full h-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 shrink-0 shadow-2xs">
                    <Building className="w-6 h-6" />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800 bg-blue-150/70 px-2 py-0.5 rounded-full">
                      Kop Surat Terhubung
                    </span>
                    {activeProfile?.logoUrl && (
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        Logo Aktif
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-black text-slate-900 mt-0.5">
                    {schoolName}
                  </h3>
                  <p className="text-xs text-slate-600 line-clamp-1">
                    {fullAddress || 'Kementerian Agama Republik Indonesia'}
                  </p>
                </div>
              </div>
            </div>

            {/* Detail Kepala Madrasah & Guru Pengampu */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-blue-100/80 text-xs">
              <div className="flex items-center gap-2 text-slate-600">
                <UserCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="truncate">
                  Kepala: <strong className="text-slate-800">{activeProfile?.principalName || '(Belum diatur)'}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <UserCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="truncate">
                  Guru: <strong className="text-slate-800">{pkg.teacherName || activeProfile?.teacherName || '(Belum diatur)'}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Pilihan Format Dokumen */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
              Pilih Jenis Dokumen yang Ingin Diunduh:
            </label>
            <div className="space-y-2.5">
              {/* Opsi 1: Paket Lengkap */}
              <button
                type="button"
                onClick={() => setSelectedMode('full')}
                className={`w-full p-3.5 rounded-xl border text-left transition flex items-start gap-3 relative ${
                  selectedMode === 'full'
                    ? 'border-blue-500 bg-blue-50/70 shadow-xs ring-2 ring-blue-400'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full border flex items-center justify-center mt-0.5 shrink-0 ${
                    selectedMode === 'full'
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-300 bg-white'
                  }`}
                >
                  {selectedMode === 'full' && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-bold text-slate-900">
                      Paket Lengkap: Soal & Kunci Jawaban
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 shrink-0">
                      Rekomendasi Arsip
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Naskah Soal Siswa di halaman awal diikuti pemisah halaman resmi (<code className="text-[11px] bg-slate-100 px-1 py-0.5 rounded">PageBreak</code>) dan Kunci Jawaban Lengkap, Indikator, serta Rubrik Penskoran di halaman berikutnya.
                  </p>
                </div>
              </button>

              {/* Opsi 2: Naskah Soal Siswa Saja */}
              <button
                type="button"
                onClick={() => setSelectedMode('questions_only')}
                className={`w-full p-3.5 rounded-xl border text-left transition flex items-start gap-3 ${
                  selectedMode === 'questions_only'
                    ? 'border-blue-500 bg-blue-50/70 shadow-xs ring-2 ring-blue-400'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full border flex items-center justify-center mt-0.5 shrink-0 ${
                    selectedMode === 'questions_only'
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-300 bg-white'
                  }`}
                >
                  {selectedMode === 'questions_only' && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-bold text-slate-900">
                      Naskah Soal Siswa Saja
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 shrink-0">
                      Siap Cetak Ujian
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Naskah ujian bersih tanpa kunci jawaban, dilengkapi tabel identitas peserta, kolom nilai siswa, petunjuk umum, dan tanda tangan resmi.
                  </p>
                </div>
              </button>

              {/* Opsi 3: Kunci Jawaban Saja */}
              <button
                type="button"
                onClick={() => setSelectedMode('answers_only')}
                className={`w-full p-3.5 rounded-xl border text-left transition flex items-start gap-3 ${
                  selectedMode === 'answers_only'
                    ? 'border-blue-500 bg-blue-50/70 shadow-xs ring-2 ring-blue-400'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full border flex items-center justify-center mt-0.5 shrink-0 ${
                    selectedMode === 'answers_only'
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-300 bg-white'
                  }`}
                >
                  {selectedMode === 'answers_only' && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-bold text-slate-900">
                      Kunci Jawaban & Rubrik Penskoran Saja
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 shrink-0">
                      Pegangan Guru
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Dokumen khusus guru memuat rekap kunci jawaban, skor per butir, indikator soal, pembahasan singkat, dan tabel rubrik uraian lengkap.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Info Tambahan */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Berkas dihasilkan dalam format asli <strong>.docx</strong> (Microsoft Word / WPS Office). Tatanan font <em>Times New Roman</em>, margin A4 standar, tabel bergaris rapi, dan garis ganda Kop Kemenag otomatis diterapkan.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isDownloading}
            className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition disabled:opacity-50"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleDownload}
            disabled={isDownloading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs shadow-md transition disabled:opacity-60"
          >
            {isDownloading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Menyiapkan Dokumen Word...</span>
              </>
            ) : downloadSuccess ? (
              <>
                <FileCheck className="w-4 h-4 text-emerald-200" />
                <span>Berhasil Diunduh!</span>
              </>
            ) : (
              <>
                <FileDown className="w-4 h-4" />
                <span>Unduh Word (.docx)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
