import React, { useState, useMemo } from 'react';
import {
  Printer,
  Edit,
  ArrowLeft,
  FileDown,
  Sparkles,
  Info,
  Clock,
  User,
  Calendar,
  School,
  FileSpreadsheet,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Edit3,
  Check,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Layers,
  KeyRound,
} from 'lucide-react';
import { ActiveView, QuestionPackage, SchoolProfile } from '../../types';
import {
  calculateTotalQuestions,
  formatIndonesianDate,
  normalizeQuestionNumbering,
} from '../../utils/curriculum';
import {
  downloadWordPackage,
  downloadPdfPackage,
  downloadExcelPackage,
  downloadCsvPackage,
} from '../../services/exportService';
import { analyzePackageDifficulty } from '../../utils/difficultyAnalysis';

interface PackagePreviewViewProps {
  packageData: QuestionPackage;
  schoolProfile: SchoolProfile | null;
  onNavigate: (view: ActiveView) => void;
  onEditPackage: (pkg: QuestionPackage) => void;
  onOpenEditor?: (pkg: QuestionPackage) => void;
  onOpenKunciJawaban?: (pkg: QuestionPackage) => void;
}

export const PackagePreviewView: React.FC<PackagePreviewViewProps> = ({
  packageData,
  schoolProfile,
  onNavigate,
  onEditPackage,
  onOpenEditor,
  onOpenKunciJawaban,
}) => {
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportType, setExportType] = useState<'PDF' | 'Word' | 'Excel' | 'CSV'>('PDF');
  const [exportIncludeAnswers, setExportIncludeAnswers] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [showTeacherKeyInView, setShowTeacherKeyInView] = useState(false);
  const [showDifficultyStats, setShowDifficultyStats] = useState(true);

  // Penomoran otomatis dinormalisasi sehingga jika soal dihapus atau diurutkan ulang,
  // nomor urut pada tampilan pratinjau dan dokumen cetak selalu berurutan kontinu 1..N
  const questions = useMemo(
    () => normalizeQuestionNumbering(packageData.questions || []),
    [packageData.questions]
  );

  const difficultyAnalysis = useMemo(
    () => analyzePackageDifficulty({ ...packageData, questions }),
    [packageData, questions]
  );

  const totalQuestions = calculateTotalQuestions(
    packageData.multipleChoiceCount,
    packageData.shortAnswerCount,
    packageData.essayCount,
    packageData.complexMultipleChoiceCount
  );

  const hasQuestions = questions.length > 0;

  const hasMC = questions.some((q) => q.type === 'multiple_choice');
  const hasCMC = questions.some((q) => q.type === 'complex_multiple_choice');
  const hasSA = questions.some((q) => q.type === 'short_answer');
  const hasEssay = questions.some((q) => q.type === 'essay');

  const romanNumerals = ['I', 'II', 'III', 'IV'];
  let sectionIndex = 0;
  const mcRoman = hasMC ? romanNumerals[sectionIndex++] : 'I';
  const cmcRoman = hasCMC ? romanNumerals[sectionIndex++] : 'II';
  const saRoman = hasSA ? romanNumerals[sectionIndex++] : 'III';
  const essayRoman = hasEssay ? romanNumerals[sectionIndex++] : 'IV';

  const handlePrint = () => {
    window.print();
  };

  const openExportModal = (type: 'PDF' | 'Word' | 'Excel' | 'CSV') => {
    setExportType(type);
    setExportError(null);
    setShowExportModal(true);
  };

  const handleExecuteExport = async () => {
    setIsExporting(true);
    setExportError(null);
    try {
      if (exportType === 'Word') {
        await downloadWordPackage(packageData, schoolProfile, {
          includeAnswers: exportIncludeAnswers,
        });
      } else if (exportType === 'PDF') {
        await downloadPdfPackage(packageData, schoolProfile, {
          includeAnswers: exportIncludeAnswers,
        });
      } else if (exportType === 'Excel') {
        downloadExcelPackage(packageData, schoolProfile, {
          includeAnswers: exportIncludeAnswers,
        });
      } else {
        downloadCsvPackage(packageData, schoolProfile, {
          includeAnswers: exportIncludeAnswers,
        });
      }
      setShowExportModal(false);
    } catch (err: any) {
      setExportError(`Gagal mengekspor berkas: ${err?.message || 'Kesalahan sistem'}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Nama madrasah prioritas paket atau profil
  const displaySchoolName = packageData.schoolName || schoolProfile?.schoolName || 'MADRASAH IBTIDAIYAH';
  const displayAddress =
    schoolProfile?.address
      ? `${schoolProfile.address}${schoolProfile.village ? ', ' + schoolProfile.village : ''}${schoolProfile.subdistrict ? ', Kec. ' + schoolProfile.subdistrict : ''}${schoolProfile.city ? ', ' + schoolProfile.city : ''}${schoolProfile.province ? ', ' + schoolProfile.province : ''}`
      : 'Kementerian Agama Republik Indonesia';

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-150">
      {/* Top Action Bar (Hidden during print) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 no-print">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('bank-soal')}
            className="p-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 transition"
            aria-label="Kembali ke Bank Soal"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Pratinjau Naskah Asesmen
            </h1>
            <p className="text-xs text-slate-500">
              Format tata letak standar naskah asesmen Madrasah Ibtidaiyah siap cetak A4.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {hasQuestions && onOpenEditor && (
            <button
              type="button"
              onClick={() => onOpenEditor(packageData)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-teal-300 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-semibold shadow-2xs transition"
            >
              <Edit3 className="w-4 h-4 text-teal-700" />
              <span>Review & Editor Soal</span>
            </button>
          )}

          {hasQuestions && (
            <button
              type="button"
              onClick={() => {
                if (onOpenKunciJawaban) {
                  onOpenKunciJawaban(packageData);
                } else {
                  onNavigate('kunci-jawaban');
                }
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold shadow-2xs transition"
              title="Kelola & Cetak Lembar Kunci Jawaban Terpisah (Pedoman Penskoran & Pembahasan)"
            >
              <KeyRound className="w-4 h-4 text-amber-700" />
              <span>Kunci Jawaban Terpisah</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onEditPackage(packageData)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition"
          >
            <Edit className="w-4 h-4 text-sky-600" />
            <span>Edit Paket</span>
          </button>

          {/* Unduh Word Button */}
          <button
            type="button"
            onClick={() => openExportModal('Word')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-blue-600 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition"
            title="Unduh Naskah Soal format Microsoft Word (.docx)"
          >
            <FileText className="w-4 h-4" />
            <span>Unduh Word (.docx)</span>
          </button>

          {/* Unduh PDF Button */}
          <button
            type="button"
            onClick={() => openExportModal('PDF')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-rose-600 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition"
            title="Unduh Naskah Soal format PDF Siap Cetak (.pdf)"
          >
            <FileDown className="w-4 h-4" />
            <span>Unduh PDF (.pdf)</span>
          </button>

          {/* Cetak Langsung / Browser Print Button */}
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition"
            title="Cetak Langsung atau Simpan PDF via Browser"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>Cetak A4</span>
          </button>

          {/* Excel Kisi-kisi Button */}
          <button
            type="button"
            onClick={() => openExportModal('Excel')}
            className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold shadow-2xs transition"
            title="Unduh Matriks Kisi-kisi Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span>Excel</span>
          </button>

          {/* CSV Daftar Soal Button */}
          <button
            type="button"
            onClick={() => openExportModal('CSV')}
            className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl border border-teal-300 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-semibold shadow-2xs transition"
            title="Unduh Daftar Soal format CSV (.csv)"
          >
            <FileSpreadsheet className="w-4 h-4 text-teal-700" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Switch Mode Kunci Jawaban Guru vs Naskah Siswa */}
      {hasQuestions && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-100 border border-slate-200 text-xs no-print">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Mode Tampilan Layar:</span>
            <span className={showTeacherKeyInView ? 'text-teal-800 font-bold' : 'text-slate-600 font-medium'}>
              {showTeacherKeyInView ? 'Paket Lengkap Guru (Kunci & Pembahasan Tampil)' : 'Naskah Lembar Siswa'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowTeacherKeyInView(!showTeacherKeyInView)}
            className="px-3 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs shadow-2xs transition"
          >
            {showTeacherKeyInView ? 'Sembunyikan Kunci Jawaban' : 'Tampilkan Kunci & Pembahasan'}
          </button>
        </div>
      )}

      {/* ANALISIS BUTIR SOAL SEDERHANA (Tingkat Kesulitan: Mudah / Sedang / Sulit) */}
      {hasQuestions && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4 no-print transition">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center shrink-0">
                <BarChart3 className="w-5 h-5 text-teal-700" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">
                    Analisis Butir Soal Sederhana
                  </h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${difficultyAnalysis.balanceStatus.badgeClass}`}>
                    {difficultyAnalysis.balanceStatus.status === 'seimbang'
                      ? 'Sebaran Seimbang'
                      : difficultyAnalysis.balanceStatus.label.split('(')[0].trim()}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Statistik proporsi tingkat kesulitan ({difficultyAnalysis.totalQuestions} butir soal terdata)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700">
                <span>Rasio:</span>
                <span className="font-bold text-slate-900">{difficultyAnalysis.ratioString}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowDifficultyStats(!showDifficultyStats)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition"
              >
                <span>{showDifficultyStats ? 'Sembunyikan' : 'Lihat Statistik'}</span>
                {showDifficultyStats ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {showDifficultyStats && (
            <div className="space-y-4 pt-1 animate-in fade-in duration-200">
              {/* Visual Multi-Segment Distribution Bar */}
              <div className="space-y-1.5">
                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex p-0.5 border border-slate-200">
                  {difficultyAnalysis.mudah.count > 0 && (
                    <div
                      style={{ width: `${difficultyAnalysis.mudah.percentage}%` }}
                      className="bg-emerald-500 h-full rounded-l-full transition-all duration-500"
                      title={`Mudah: ${difficultyAnalysis.mudah.count} butir (${difficultyAnalysis.mudah.percentage}%)`}
                    />
                  )}
                  {difficultyAnalysis.sedang.count > 0 && (
                    <div
                      style={{ width: `${difficultyAnalysis.sedang.percentage}%` }}
                      className={`bg-sky-500 h-full transition-all duration-500 ${
                        difficultyAnalysis.mudah.count === 0 ? 'rounded-l-full' : ''
                      } ${difficultyAnalysis.sulit.count === 0 ? 'rounded-r-full' : ''}`}
                      title={`Sedang: ${difficultyAnalysis.sedang.count} butir (${difficultyAnalysis.sedang.percentage}%)`}
                    />
                  )}
                  {difficultyAnalysis.sulit.count > 0 && (
                    <div
                      style={{ width: `${difficultyAnalysis.sulit.percentage}%` }}
                      className="bg-purple-600 h-full rounded-r-full transition-all duration-500"
                      title={`Sulit/HOTS: ${difficultyAnalysis.sulit.count} butir (${difficultyAnalysis.sulit.percentage}%)`}
                    />
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 px-0.5">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                    Mudah ({difficultyAnalysis.mudah.percentage}%)
                  </span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block" />
                    Sedang ({difficultyAnalysis.sedang.percentage}%)
                  </span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-600 inline-block" />
                    Sulit / HOTS ({difficultyAnalysis.sulit.percentage}%)
                  </span>
                </div>
              </div>

              {/* 3 Metric Cards: Mudah, Sedang, Sulit */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. MUDAH */}
                <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-900">
                      <span className="w-2 h-2 rounded-full bg-emerald-600" />
                      <span>Mudah (L1)</span>
                    </div>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                      {difficultyAnalysis.mudah.percentage}%
                    </span>
                  </div>

                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-black text-emerald-950">
                      {difficultyAnalysis.mudah.count}
                    </span>
                    <span className="text-xs text-emerald-800 font-semibold">
                      dari {difficultyAnalysis.totalQuestions} Soal
                    </span>
                  </div>

                  <div className="text-[11px] text-emerald-800/90 pt-1 border-t border-emerald-200/80 space-y-0.5">
                    <div className="flex justify-between">
                      <span>Akumulasi Skor:</span>
                      <strong className="text-emerald-950">{difficultyAnalysis.mudah.totalScore} Poin</strong>
                    </div>
                    <div className="text-[10px] text-emerald-700 truncate" title={difficultyAnalysis.mudah.questionNumbers.join(', ')}>
                      Nomor:{' '}
                      <span className="font-semibold text-emerald-900">
                        {difficultyAnalysis.mudah.questionNumbers.length > 0
                          ? difficultyAnalysis.mudah.questionNumbers.map((n) => `#${n}`).join(', ')
                          : '-'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. SEDANG */}
                <div className="p-3.5 rounded-xl border border-sky-200 bg-sky-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-sky-900">
                      <span className="w-2 h-2 rounded-full bg-sky-600" />
                      <span>Sedang (L2)</span>
                    </div>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-300">
                      {difficultyAnalysis.sedang.percentage}%
                    </span>
                  </div>

                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-black text-sky-950">
                      {difficultyAnalysis.sedang.count}
                    </span>
                    <span className="text-xs text-sky-800 font-semibold">
                      dari {difficultyAnalysis.totalQuestions} Soal
                    </span>
                  </div>

                  <div className="text-[11px] text-sky-800/90 pt-1 border-t border-sky-200/80 space-y-0.5">
                    <div className="flex justify-between">
                      <span>Akumulasi Skor:</span>
                      <strong className="text-sky-950">{difficultyAnalysis.sedang.totalScore} Poin</strong>
                    </div>
                    <div className="text-[10px] text-sky-700 truncate" title={difficultyAnalysis.sedang.questionNumbers.join(', ')}>
                      Nomor:{' '}
                      <span className="font-semibold text-sky-900">
                        {difficultyAnalysis.sedang.questionNumbers.length > 0
                          ? difficultyAnalysis.sedang.questionNumbers.map((n) => `#${n}`).join(', ')
                          : '-'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. SULIT / HOTS */}
                <div className="p-3.5 rounded-xl border border-purple-200 bg-purple-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-purple-900">
                      <span className="w-2 h-2 rounded-full bg-purple-600" />
                      <span>Sulit / HOTS (L3)</span>
                    </div>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-300">
                      {difficultyAnalysis.sulit.percentage}%
                    </span>
                  </div>

                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-black text-purple-950">
                      {difficultyAnalysis.sulit.count}
                    </span>
                    <span className="text-xs text-purple-800 font-semibold">
                      dari {difficultyAnalysis.totalQuestions} Soal
                    </span>
                  </div>

                  <div className="text-[11px] text-purple-800/90 pt-1 border-t border-purple-200/80 space-y-0.5">
                    <div className="flex justify-between">
                      <span>Akumulasi Skor:</span>
                      <strong className="text-purple-950">{difficultyAnalysis.sulit.totalScore} Poin</strong>
                    </div>
                    <div className="text-[10px] text-purple-700 truncate" title={difficultyAnalysis.sulit.questionNumbers.join(', ')}>
                      Nomor:{' '}
                      <span className="font-semibold text-purple-900">
                        {difficultyAnalysis.sulit.questionNumbers.length > 0
                          ? difficultyAnalysis.sulit.questionNumbers.map((n) => `#${n}`).join(', ')
                          : '-'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Rincian per Bentuk Soal */}
              {difficultyAnalysis.byType.length > 0 && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                    <Layers className="w-3.5 h-3.5 text-teal-700" />
                    <span>Sebaran Kesulitan per Bentuk Penilaian:</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                    {difficultyAnalysis.byType.map((bt) => (
                      <div key={bt.type} className="p-2.5 rounded-lg bg-white border border-slate-200 space-y-1 shadow-2xs">
                        <div className="font-bold text-slate-900 flex justify-between items-center">
                          <span>{bt.label}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200">
                            {bt.total}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-600 font-medium">
                          <span className="text-emerald-700">Mudah: {bt.mudah}</span>
                          <span>•</span>
                          <span className="text-sky-700">Sedang: {bt.sedang}</span>
                          <span>•</span>
                          <span className="text-purple-700">HOTS: {bt.sulit}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Evaluasi Komposisi Kurikulum Merdeka */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2.5 text-xs leading-relaxed text-slate-700">
                <Info className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900">{difficultyAnalysis.balanceStatus.label}</strong>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    {difficultyAnalysis.balanceStatus.description}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* A4 SIMULATION DOCUMENT CONTAINER */}
      <div className="bg-white rounded-2xl border border-slate-300 p-8 sm:p-12 shadow-md print:shadow-none print:border-none print:p-0 print:m-0 text-slate-900 font-serif">
        {/* KOP MADRASAH */}
        <div className="text-center pb-4 border-b-4 border-double border-slate-900 space-y-1">
          <div className="flex items-center justify-center gap-4">
            {schoolProfile?.logoUrl ? (
              <img
                src={schoolProfile.logoUrl}
                alt="Logo Madrasah"
                className="w-16 h-16 object-contain shrink-0"
              />
            ) : null}
            <div>
              <p className="text-xs font-bold tracking-widest uppercase text-slate-700 font-sans">
                KEMENTERIAN AGAMA REPUBLIK INDONESIA
              </p>
              <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-slate-900 font-sans">
                {displaySchoolName}
              </h2>
              {schoolProfile?.npsnOrNsm && (
                <p className="text-xs text-slate-600 font-sans font-medium">
                  NSM/NPSN: {schoolProfile.npsnOrNsm}
                </p>
              )}
              <p className="text-[11px] text-slate-600 italic font-sans max-w-xl mx-auto">
                {displayAddress}
              </p>
            </div>
          </div>
        </div>

        {/* JUDUL ASESMEN */}
        <div className="text-center my-6 space-y-1">
          <h3 className="text-base sm:text-lg font-bold uppercase tracking-wide underline font-sans text-slate-900">
            NASKAH SOAL {packageData.assessmentType.toUpperCase()}
          </h3>
          <p className="text-xs font-semibold text-slate-700 font-sans">
            TAHUN PELAJARAN {packageData.academicYear} — SEMESTER {packageData.semester.toUpperCase()}
          </p>
          {showTeacherKeyInView && (
            <p className="text-[11px] font-bold text-teal-800 uppercase tracking-widest font-sans">
              [DOKUMEN KHUSUS GURU — KUNCI JAWABAN & PEMBAHASAN]
            </p>
          )}
        </div>

        {/* TABEL IDENTITAS ASESMEN */}
        <div className="border border-slate-800 rounded-md overflow-hidden text-xs font-sans mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-800">
            <div className="p-3 space-y-1.5">
              <div className="flex">
                <span className="w-32 font-semibold text-slate-700">Mata Pelajaran</span>
                <span className="font-bold text-slate-900">: {packageData.subject}</span>
              </div>
              <div className="flex">
                <span className="w-32 font-semibold text-slate-700">Kelas / Fase</span>
                <span className="font-bold text-slate-900">: Kelas {packageData.grade} ({packageData.phase})</span>
              </div>
              <div className="flex">
                <span className="w-32 font-semibold text-slate-700">Alokasi Waktu</span>
                <span className="font-bold text-slate-900">: {packageData.durationMinutes} Menit</span>
              </div>
            </div>

            <div className="p-3 space-y-1.5 bg-slate-50/50">
              <div className="flex">
                <span className="w-32 font-semibold text-slate-700">Nama Siswa</span>
                <span className="font-bold text-slate-900">: ...................................................</span>
              </div>
              <div className="flex">
                <span className="w-32 font-semibold text-slate-700">Nomor Absen</span>
                <span className="font-bold text-slate-900">: ...................................................</span>
              </div>
              <div className="flex">
                <span className="w-32 font-semibold text-slate-700">Hari / Tanggal</span>
                <span className="font-bold text-slate-900">: ...................................................</span>
              </div>
            </div>
          </div>
        </div>

        {/* PETUNJUK UMUM */}
        <div className="mb-6 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs font-sans space-y-1">
          <p className="font-bold text-slate-800">PETUNJUK UMUM:</p>
          <ol className="list-decimal list-inside space-y-0.5 text-slate-600 pl-1 leading-relaxed">
            <li>Berdoalah sebelum mengerjakan soal asesmen.</li>
            <li>Tuliskan identitas nama lengkap dan nomor peserta pada lembar jawaban yang tersedia.</li>
            <li>Periksa dan bacalah setiap butir soal dengan teliti sebelum Anda menjawabnya.</li>
            <li>Dahulukan menjawab soal-soal yang Anda anggap lebih mudah.</li>
            <li>Periksa kembali lembar jawaban Anda sebelum diserahkan kepada pengawas ujian.</li>
          </ol>
        </div>

        {/* BUTIR SOAL KONTEN */}
        {hasQuestions ? (
          <div className="space-y-6 font-sans text-xs">
            {/* Bagian: Pilihan Ganda */}
            {questions.some((q) => q.type === 'multiple_choice') && (
              <div className="space-y-3">
                <div className="pb-1 border-b border-slate-300">
                  <h4 className="font-bold text-sm text-slate-900">
                    {mcRoman}. PILIHAN GANDA
                  </h4>
                  <p className="text-slate-600 italic text-[11px]">
                    {packageData.mcOptionCount === 3
                      ? 'Berilah tanda silang (X) pada huruf A, B, atau C di depan jawaban yang paling tepat!'
                      : 'Berilah tanda silang (X) pada huruf A, B, C, atau D di depan jawaban yang paling tepat!'}
                  </p>
                </div>

                <div className="space-y-4">
                  {questions
                    .filter((q) => q.type === 'multiple_choice')
                    .map((q) => {
                      const isImageAbove =
                        q.imagePosition === 'above_question' ||
                        (!q.imagePosition && packageData.defaultImagePosition === 'above_question');

                      return (
                        <div key={q.id} className="space-y-1.5 pl-1 question-item-block">
                          {isImageAbove && q.imageUrl && (
                            <div className="my-2.5 ml-6 flex flex-col items-center">
                              <img
                                src={q.imageUrl}
                                alt={q.imageAlt || `Stimulus visual nomor ${q.number}`}
                                referrerPolicy="no-referrer"
                                className="max-h-56 max-w-full rounded border border-slate-300 object-contain bg-white shadow-2xs"
                              />
                              {q.imageCaption && (
                                <span className="text-[11px] text-slate-600 italic mt-1 font-medium text-center">
                                  {q.imageCaption}
                                </span>
                              )}
                            </div>
                          )}

                          <div className="flex items-start gap-1.5 font-medium leading-relaxed">
                            <span className="font-bold text-slate-900 w-5 shrink-0">
                              {q.number}.
                            </span>
                            <span className="text-slate-900">{q.questionText}</span>
                          </div>

                          {!isImageAbove && q.imageUrl && (
                            <div className="my-2.5 ml-6 flex flex-col items-center">
                              <img
                                src={q.imageUrl}
                                alt={q.imageAlt || `Stimulus visual nomor ${q.number}`}
                                referrerPolicy="no-referrer"
                                className="max-h-56 max-w-full rounded border border-slate-300 object-contain bg-white shadow-2xs"
                              />
                              {q.imageCaption && (
                                <span className="text-[11px] text-slate-600 italic mt-1 font-medium text-center">
                                  {q.imageCaption}
                                </span>
                              )}
                            </div>
                          )}

                          {q.options && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 pl-6 pt-0.5">
                              {q.options.map((opt) => (
                                <div
                                  key={opt.key}
                                  className={`flex items-start gap-2 ${
                                    showTeacherKeyInView && q.answerKey === opt.key
                                      ? 'text-teal-900 font-bold bg-teal-50 px-1.5 py-0.5 rounded'
                                      : 'text-slate-800'
                                  }`}
                                >
                                  <span className="font-bold">{opt.key}.</span>
                                  <span>{opt.text}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {showTeacherKeyInView && (
                            <div className="ml-6 mt-1 p-2 rounded bg-teal-50/80 border border-teal-200 text-[11px] text-teal-950 space-y-0.5">
                              <span className="font-bold text-teal-800">
                                Kunci Jawaban: {q.answerKey} (Skor: {q.score || 1})
                              </span>
                              <p className="text-slate-700">Pembahasan: {q.explanation}</p>
                              {!q.imageUrl && q.imageAlt && (
                                <p className="text-amber-800 italic text-[10px]">
                                  [Saran Stimulus Gambar: {q.imageAlt}]
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Bagian: Pilihan Ganda Kompleks */}
            {questions.some((q) => q.type === 'complex_multiple_choice') && (
              <div className="space-y-3 pt-4 border-t border-slate-200">
                <div className="pb-1 border-b border-slate-300">
                  <h4 className="font-bold text-sm text-slate-900">
                    {cmcRoman}. PILIHAN GANDA KOMPLEKS
                  </h4>
                  <p className="text-slate-600 italic text-[11px]">
                    Berilah tanda centang (✓) atau silang (X) pada lebih dari satu jawaban yang benar (2 atau 3 jawaban benar) di depan pilihan!
                  </p>
                </div>

                <div className="space-y-4">
                  {questions
                    .filter((q) => q.type === 'complex_multiple_choice')
                    .map((q) => {
                      const answerKeys = (q.answerKey || '')
                        .split(',')
                        .map((k) => k.trim().toUpperCase())
                        .filter(Boolean);

                      const isImageAbove =
                        q.imagePosition === 'above_question' ||
                        (!q.imagePosition && packageData.defaultImagePosition === 'above_question');

                      return (
                        <div key={q.id} className="space-y-1.5 pl-1 question-item-block">
                          {isImageAbove && q.imageUrl && (
                            <div className="my-2.5 ml-6 flex flex-col items-center">
                              <img
                                src={q.imageUrl}
                                alt={q.imageAlt || `Stimulus visual nomor ${q.number}`}
                                referrerPolicy="no-referrer"
                                className="max-h-56 max-w-full rounded border border-slate-300 object-contain bg-white shadow-2xs"
                              />
                              {q.imageCaption && (
                                <span className="text-[11px] text-slate-600 italic mt-1 font-medium text-center">
                                  {q.imageCaption}
                                </span>
                              )}
                            </div>
                          )}

                          <div className="flex items-start gap-1.5 font-medium leading-relaxed">
                            <span className="font-bold text-slate-900 w-5 shrink-0">
                              {q.number}.
                            </span>
                            <span className="text-slate-900">{q.questionText}</span>
                          </div>

                          {!isImageAbove && q.imageUrl && (
                            <div className="my-2.5 ml-6 flex flex-col items-center">
                              <img
                                src={q.imageUrl}
                                alt={q.imageAlt || `Stimulus visual nomor ${q.number}`}
                                referrerPolicy="no-referrer"
                                className="max-h-56 max-w-full rounded border border-slate-300 object-contain bg-white shadow-2xs"
                              />
                              {q.imageCaption && (
                                <span className="text-[11px] text-slate-600 italic mt-1 font-medium text-center">
                                  {q.imageCaption}
                                </span>
                              )}
                            </div>
                          )}

                          {q.options && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 pl-6 pt-0.5">
                              {q.options.map((opt) => {
                                const isCorrect = answerKeys.includes(opt.key.toUpperCase());
                                return (
                                  <div
                                    key={opt.key}
                                    className={`flex items-start gap-2 ${
                                      showTeacherKeyInView && isCorrect
                                        ? 'text-indigo-950 font-bold bg-indigo-50 border border-indigo-200 px-2 py-1 rounded'
                                        : 'text-slate-800'
                                    }`}
                                  >
                                    <span className="inline-flex items-center justify-center w-4 h-4 border border-slate-400 rounded-sm text-[10px] shrink-0 font-bold bg-white text-slate-700 mt-0.5">
                                      {showTeacherKeyInView && isCorrect ? '✓' : ''}
                                    </span>
                                    <span className="font-bold">{opt.key}.</span>
                                    <span>{opt.text}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {showTeacherKeyInView && (
                            <div className="ml-6 mt-1 p-2 rounded bg-indigo-50/80 border border-indigo-200 text-[11px] text-indigo-950 space-y-0.5">
                              <span className="font-bold text-indigo-900">
                                Kunci Jawaban Benar (Multi-pilihan): {q.answerKey} (Skor: {q.score || 2})
                              </span>
                              <p className="text-slate-700">Pembahasan: {q.explanation}</p>
                              {!q.imageUrl && q.imageAlt && (
                                <p className="text-amber-800 italic text-[10px]">
                                  [Saran Stimulus Gambar: {q.imageAlt}]
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Bagian: Isian Singkat */}
            {questions.some((q) => q.type === 'short_answer') && (
              <div className="space-y-3 pt-4 border-t border-slate-200">
                <div className="pb-1 border-b border-slate-300">
                  <h4 className="font-bold text-sm text-slate-900">
                    {saRoman}. ISIAN SINGKAT
                  </h4>
                  <p className="text-slate-600 italic text-[11px]">
                    Isilah titik-titik di bawah ini dengan jawaban yang tepat dan benar!
                  </p>
                </div>

                <div className="space-y-4">
                  {questions
                    .filter((q) => q.type === 'short_answer')
                    .map((q) => {
                      const isImageAbove =
                        q.imagePosition === 'above_question' ||
                        (!q.imagePosition && packageData.defaultImagePosition === 'above_question');

                      return (
                        <div key={q.id} className="space-y-1.5 pl-1 question-item-block">
                          {isImageAbove && q.imageUrl && (
                            <div className="my-2.5 ml-6 flex flex-col items-center">
                              <img
                                src={q.imageUrl}
                                alt={q.imageAlt || `Stimulus visual nomor ${q.number}`}
                                referrerPolicy="no-referrer"
                                className="max-h-56 max-w-full rounded border border-slate-300 object-contain bg-white shadow-2xs"
                              />
                              {q.imageCaption && (
                                <span className="text-[11px] text-slate-600 italic mt-1 font-medium text-center">
                                  {q.imageCaption}
                                </span>
                              )}
                            </div>
                          )}

                          <div className="flex items-start gap-1.5 font-medium leading-relaxed">
                            <span className="font-bold text-slate-900 w-5 shrink-0">
                              {q.number}.
                            </span>
                            <span className="text-slate-900">{q.questionText}</span>
                          </div>

                          {!isImageAbove && q.imageUrl && (
                            <div className="my-2.5 ml-6 flex flex-col items-center">
                              <img
                                src={q.imageUrl}
                                alt={q.imageAlt || `Stimulus visual nomor ${q.number}`}
                                referrerPolicy="no-referrer"
                                className="max-h-56 max-w-full rounded border border-slate-300 object-contain bg-white shadow-2xs"
                              />
                              {q.imageCaption && (
                                <span className="text-[11px] text-slate-600 italic mt-1 font-medium text-center">
                                  {q.imageCaption}
                                </span>
                              )}
                            </div>
                          )}

                          {showTeacherKeyInView && (
                            <div className="ml-6 mt-1 p-2 rounded bg-emerald-50/80 border border-emerald-200 text-[11px] text-emerald-950 space-y-0.5">
                              <span className="font-bold text-emerald-800">
                                Kunci: {q.answerKey} (Skor: {q.score || 2})
                              </span>
                              <p className="text-slate-700">Pembahasan: {q.explanation}</p>
                              {!q.imageUrl && q.imageAlt && (
                                <p className="text-amber-800 italic text-[10px]">
                                  [Saran Stimulus Gambar: {q.imageAlt}]
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Bagian: Uraian */}
            {questions.some((q) => q.type === 'essay') && (
              <div className="space-y-3 pt-4 border-t border-slate-200">
                <div className="pb-1 border-b border-slate-300">
                  <h4 className="font-bold text-sm text-slate-900">
                    {essayRoman}. URAIAN / ESSAY
                  </h4>
                  <p className="text-slate-600 italic text-[11px]">
                    Jawablah pertanyaan-pertanyaan berikut dengan penjelasan yang lengkap dan jelas!
                  </p>
                </div>

                <div className="space-y-4">
                  {questions
                    .filter((q) => q.type === 'essay')
                    .map((q) => {
                      const isImageAbove =
                        q.imagePosition === 'above_question' ||
                        (!q.imagePosition && packageData.defaultImagePosition === 'above_question');

                      return (
                        <div key={q.id} className="space-y-1.5 pl-1 question-item-block">
                          {isImageAbove && q.imageUrl && (
                            <div className="my-2.5 ml-6 flex flex-col items-center">
                              <img
                                src={q.imageUrl}
                                alt={q.imageAlt || `Stimulus visual nomor ${q.number}`}
                                referrerPolicy="no-referrer"
                                className="max-h-56 max-w-full rounded border border-slate-300 object-contain bg-white shadow-2xs"
                              />
                              {q.imageCaption && (
                                <span className="text-[11px] text-slate-600 italic mt-1 font-medium text-center">
                                  {q.imageCaption}
                                </span>
                              )}
                            </div>
                          )}

                          <div className="flex items-start gap-1.5 font-medium leading-relaxed">
                            <span className="font-bold text-slate-900 w-5 shrink-0">
                              {q.number}.
                            </span>
                            <span className="text-slate-900">{q.questionText}</span>
                          </div>

                          {!isImageAbove && q.imageUrl && (
                            <div className="my-2.5 ml-6 flex flex-col items-center">
                              <img
                                src={q.imageUrl}
                                alt={q.imageAlt || `Stimulus visual nomor ${q.number}`}
                                referrerPolicy="no-referrer"
                                className="max-h-56 max-w-full rounded border border-slate-300 object-contain bg-white shadow-2xs"
                              />
                              {q.imageCaption && (
                                <span className="text-[11px] text-slate-600 italic mt-1 font-medium text-center">
                                  {q.imageCaption}
                                </span>
                              )}
                            </div>
                          )}

                        {showTeacherKeyInView && (
                          <div className="ml-6 mt-1 p-2 rounded bg-purple-50/80 border border-purple-200 text-[11px] text-purple-950 space-y-1">
                            <span className="font-bold text-purple-800">
                              Jawaban Acuan: {q.answerKey} (Skor Maks: {q.score || 5})
                            </span>
                            <p className="text-slate-700">Pembahasan: {q.explanation}</p>
                            {!q.imageUrl && q.imageAlt && (
                              <p className="text-amber-800 italic text-[10px]">
                                [Saran Stimulus Gambar: {q.imageAlt}]
                              </p>
                            )}
                            {q.rubric && (
                              <div className="pt-1 text-[10px] space-y-0.5">
                                <span className="font-bold text-purple-900">Rubrik Skor:</span>
                                {q.rubric.map((r, idx) => (
                                  <div key={idx} className="flex justify-between text-slate-600 pl-2">
                                    <span>• {r.criteria}</span>
                                    <span className="font-bold">{r.score} poin</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Placeholder bila belum ada butir soal */
          <div className="p-8 rounded-xl bg-slate-50 border-2 border-dashed border-slate-300 text-center space-y-3 font-sans">
            <div className="w-12 h-12 rounded-full bg-teal-100 text-teal-800 mx-auto flex items-center justify-center">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h5 className="text-sm font-bold text-slate-900">
                Naskah Butir Pertanyaan Belum Dibuat
              </h5>
              <p className="text-xs text-slate-600 leading-relaxed">
                Rancangan komposisi {totalQuestions} soal telah tersimpan. Silakan klik tombol{' '}
                <strong>Edit Paket &gt; Generate Soal dengan AI</strong> untuk membangkitkan butir soal otomatis menggunakan Gemini AI.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onEditPackage(packageData)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-700 text-white font-bold text-xs shadow-xs"
            >
              <Sparkles className="w-4 h-4" />
              <span>Generate Butir Soal Sekarang</span>
            </button>
          </div>
        )}
      </div>

      {/* MODAL PILIHAN EKSPOR BERKAS ASLI (PDF / WORD / EXCEL) */}
      {showExportModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2.5 rounded-xl ${
                    exportType === 'PDF'
                      ? 'bg-rose-100 text-rose-800'
                      : exportType === 'Word'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {exportType === 'PDF' ? (
                    <FileDown className="w-5 h-5 text-rose-700" />
                  ) : exportType === 'Word' ? (
                    <FileText className="w-5 h-5 text-blue-700" />
                  ) : (
                    <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    Unduh Naskah Soal Asesmen
                  </h3>
                  <p className="text-xs text-slate-500">
                    Pilih format dan kelengkapan dokumen sesuai kebutuhan cetak Anda
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Selector Format Berkas */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Pilih Format Berkas:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {/* Opsi PDF */}
                <button
                  type="button"
                  onClick={() => setExportType('PDF')}
                  className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                    exportType === 'PDF'
                      ? 'border-rose-500 bg-rose-50/60 ring-2 ring-rose-400'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-xs font-black text-rose-700">PDF</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-rose-100 text-rose-800">
                      Siap Cetak
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-snug">
                    Format A4 resmi dengan Kop Kemenag.
                  </p>
                </button>

                {/* Opsi Word */}
                <button
                  type="button"
                  onClick={() => setExportType('Word')}
                  className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                    exportType === 'Word'
                      ? 'border-blue-500 bg-blue-50/60 ring-2 ring-blue-400'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-xs font-black text-blue-700">Word (.docx)</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-blue-100 text-blue-800">
                      Bisa Diedit
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-snug">
                    Bisa diedit di MS Word atau WPS.
                  </p>
                </button>

                {/* Opsi Excel */}
                <button
                  type="button"
                  onClick={() => setExportType('Excel')}
                  className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                    exportType === 'Excel'
                      ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-400'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-xs font-black text-emerald-700">Excel (.xlsx)</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800">
                      Kisi-kisi
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-snug">
                    Tabel rekap dan matriks kisi-kisi.
                  </p>
                </button>

                {/* Opsi CSV */}
                <button
                  type="button"
                  onClick={() => setExportType('CSV')}
                  className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                    exportType === 'CSV'
                      ? 'border-teal-500 bg-teal-50/60 ring-2 ring-teal-400'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-xs font-black text-teal-700">CSV (.csv)</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-teal-100 text-teal-800">
                      Daftar Soal
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-snug">
                    Impor / olah data di spreadsheet.
                  </p>
                </button>
              </div>
            </div>

            {/* Pilihan Kelengkapan Dokumen */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Pilih Kelengkapan Isi Dokumen:
              </label>

              <div
                onClick={() => setExportIncludeAnswers(false)}
                className={`p-3.5 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
                  !exportIncludeAnswers
                    ? 'bg-teal-50/70 border-teal-600 ring-1 ring-teal-600'
                    : 'bg-slate-50/60 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
                    !exportIncludeAnswers ? 'border-teal-700 bg-teal-700' : 'border-slate-300'
                  }`}
                >
                  {!exportIncludeAnswers && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <div>
                  <strong className="text-xs text-slate-900 block font-bold">
                    Naskah Lembar Siswa (Tanpa Kunci Jawaban)
                  </strong>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    Berisi kop madrasah resmi, identitas ujian, petunjuk pengerjaan, dan butir-butir soal ujian untuk dibagikan kepada siswa.
                  </p>
                </div>
              </div>

              <div
                onClick={() => setExportIncludeAnswers(true)}
                className={`p-3.5 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
                  exportIncludeAnswers
                    ? 'bg-teal-50/70 border-teal-600 ring-1 ring-teal-600'
                    : 'bg-slate-50/60 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
                    exportIncludeAnswers ? 'border-teal-700 bg-teal-700' : 'border-slate-300'
                  }`}
                >
                  {exportIncludeAnswers && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <div>
                  <strong className="text-xs text-slate-900 block font-bold">
                    Paket Lengkap Guru (Kunci, Pembahasan & Rubrik Penskoran)
                  </strong>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    Menyertakan lembar kunci jawaban lengkap, skor tiap butir, indikator asesmen, pembahasan, dan kriteria rubrik uraian.
                  </p>
                </div>
              </div>
            </div>

            {/* Error Banner jika ada */}
            {exportError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{exportError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteExport}
                disabled={isExporting}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-bold text-xs shadow-md transition disabled:opacity-50 ${
                  exportType === 'PDF'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : exportType === 'Word'
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : exportType === 'Excel'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-teal-600 hover:bg-teal-700'
                }`}
              >
                <FileDown className="w-4 h-4" />
                <span>
                  {isExporting
                    ? 'Menyiapkan Berkas...'
                    : `Unduh Berkas ${exportType} (.${exportType === 'Word' ? 'docx' : exportType === 'PDF' ? 'pdf' : exportType === 'Excel' ? 'xlsx' : 'csv'})`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
