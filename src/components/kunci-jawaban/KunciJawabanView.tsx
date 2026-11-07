import React, { useState, useEffect, useMemo } from 'react';
import {
  Printer,
  Save,
  FileDown,
  FileText,
  FileSpreadsheet,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  Edit3,
  Check,
  Info,
  Layers,
  KeyRound,
  Eye,
  EyeOff,
  HelpCircle,
  Table as TableIcon,
  BookOpen,
} from 'lucide-react';
import {
  ActiveView,
  QuestionItem,
  QuestionPackage,
  SchoolProfile,
} from '../../types';
import {
  calculateTotalQuestions,
  formatIndonesianDate,
  normalizeQuestionNumbering,
} from '../../utils/curriculum';
import {
  downloadKunciJawabanWord,
  downloadKunciJawabanPdf,
  downloadKunciJawabanExcel,
} from '../../services/exportService';

interface KunciJawabanViewProps {
  packages: QuestionPackage[];
  initialPackageId?: string;
  schoolProfile?: SchoolProfile | null;
  onNavigate: (view: ActiveView) => void;
  onOpenPackage?: (pkg: QuestionPackage) => void;
  onUpdatePackage?: (pkg: QuestionPackage) => void;
}

export const KunciJawabanView: React.FC<KunciJawabanViewProps> = ({
  packages,
  initialPackageId,
  schoolProfile = null,
  onNavigate,
  onOpenPackage,
  onUpdatePackage,
}) => {
  const [selectedPackageId, setSelectedPackageId] = useState<string>(
    initialPackageId || packages[0]?.id || ''
  );

  const currentPackage = useMemo(
    () => packages.find((p) => p.id === selectedPackageId) || packages[0],
    [packages, selectedPackageId]
  );

  const [questions, setQuestions] = useState<QuestionItem[]>(() =>
    normalizeQuestionNumbering(currentPackage?.questions || [])
  );

  const [isDirty, setIsDirty] = useState(false);
  const [showExplanations, setShowExplanations] = useState(true);
  const [layoutMode, setLayoutMode] = useState<'matrix' | 'detailed'>('detailed');
  const [isExportingWord, setIsExportingWord] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);

  useEffect(() => {
    if (currentPackage) {
      setQuestions(normalizeQuestionNumbering(currentPackage.questions || []));
      setIsDirty(false);
    }
  }, [currentPackage]);

  if (!currentPackage) {
    return (
      <div className="text-center py-16 space-y-4 max-w-md mx-auto">
        <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
          <KeyRound className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-slate-800">
          Belum Ada Paket Soal Tersedia
        </h2>
        <p className="text-xs text-slate-600">
          Silakan buat paket soal terlebih dahulu untuk dapat mengelola dan mencetak kunci jawaban secara terpisah.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('create-package')}
          className="px-4 py-2 rounded-xl bg-teal-700 text-white text-xs font-bold shadow-xs hover:bg-teal-800 transition"
        >
          Buat Paket Soal Baru
        </button>
      </div>
    );
  }

  const mcQuestions = questions.filter((q) => q.type === 'multiple_choice');
  const cmcQuestions = questions.filter((q) => q.type === 'complex_multiple_choice');
  const saQuestions = questions.filter((q) => q.type === 'short_answer');
  const essayQuestions = questions.filter((q) => q.type === 'essay');

  const totalScore = questions.reduce((sum, q) => sum + (Number(q.score) || 1), 0);

  const handleUpdateQuestion = (qIndex: number, updated: Partial<QuestionItem>) => {
    setQuestions((prev) => {
      const next = [...prev];
      next[qIndex] = { ...next[qIndex], ...updated };
      return next;
    });
    setIsDirty(true);
  };

  const handleSaveChanges = () => {
    if (!onUpdatePackage) return;
    const updatedPkg: QuestionPackage = {
      ...currentPackage,
      questions,
      updatedAt: new Date().toISOString(),
    };
    onUpdatePackage(updatedPkg);
    setIsDirty(false);
    setSaveSuccessNotice(true);
    setTimeout(() => setSaveSuccessNotice(false), 3000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadWord = async () => {
    setIsExportingWord(true);
    try {
      await downloadKunciJawabanWord(
        { ...currentPackage, questions },
        schoolProfile,
        { showExplanations }
      );
    } finally {
      setIsExportingWord(false);
    }
  };

  const handleDownloadPdf = async () => {
    setIsExportingPdf(true);
    try {
      await downloadKunciJawabanPdf(
        { ...currentPackage, questions },
        schoolProfile,
        { showExplanations }
      );
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleDownloadExcel = async () => {
    setIsExportingExcel(true);
    try {
      await downloadKunciJawabanExcel(
        { ...currentPackage, questions },
        schoolProfile,
        { showExplanations }
      );
    } finally {
      setIsExportingExcel(false);
    }
  };

  const schoolName = currentPackage.schoolName || schoolProfile?.schoolName || 'MADRASAH IBTIDAIYAH';
  const address = schoolProfile?.address
    ? `${schoolProfile.address}${schoolProfile.village ? ', ' + schoolProfile.village : ''}${schoolProfile.city ? ', ' + schoolProfile.city : ''}`
    : 'Kementerian Agama Republik Indonesia';

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16 animate-in fade-in duration-150">
      {/* Top Navigation & Toolbar (no-print) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 no-print">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('bank-soal')}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition"
            title="Kembali ke Bank Soal"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-teal-700" />
                <span>Kunci Jawaban & Pedoman Penskoran</span>
              </h1>
              {isDirty && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  Belum Disimpan
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Kelola kunci, sesuaikan pembahasan, dan cetak naskah kunci jawaban secara terpisah dari paket soal siswa.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {isDirty && (
            <button
              type="button"
              onClick={handleSaveChanges}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-xs transition"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Perubahan</span>
            </button>
          )}

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-2xs transition"
            title="Cetak Kunci Jawaban A4 secara terpisah"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>Cetak A4</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadWord}
            disabled={isExportingWord}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-blue-600 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition disabled:opacity-60"
            title="Unduh Dokumen Kunci Jawaban Word (.docx)"
          >
            <FileText className="w-4 h-4" />
            <span>{isExportingWord ? 'Membuat Word...' : 'Word (.docx)'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isExportingPdf}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-600 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition disabled:opacity-60"
            title="Unduh Dokumen Kunci Jawaban PDF (.pdf)"
          >
            <FileDown className="w-4 h-4" />
            <span>{isExportingPdf ? 'Membuat PDF...' : 'PDF (.pdf)'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadExcel}
            disabled={isExportingExcel}
            className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs shadow-2xs transition disabled:opacity-60"
            title="Unduh Rekap Kunci Jawaban Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span>Excel</span>
          </button>
        </div>
      </div>

      {/* Package Selector & Preference Controls (no-print) */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3.5 no-print">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Dropdown Pemilihan Paket */}
          <div className="flex-1 max-w-md">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Pilih Paket Asesmen
            </label>
            <select
              value={selectedPackageId}
              onChange={(e) => setSelectedPackageId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {packages.map((pkg) => (
                <option key={pkg.id} value={pkg.id}>
                  {pkg.title} ({pkg.subject} {pkg.grade} • {pkg.assessmentType})
                </option>
              ))}
            </select>
          </div>

          {/* Pengaturan Tampilan & Pembahasan */}
          <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-4">
            {/* Toggle Pembahasan Singkat */}
            <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer text-xs font-semibold text-slate-700 transition">
              <input
                type="checkbox"
                checked={showExplanations}
                onChange={(e) => setShowExplanations(e.target.checked)}
                className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300 cursor-pointer"
              />
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Tampilkan Pembahasan Singkat di Bawah Kunci</span>
              </span>
            </label>

            {/* Layout Mode Selector */}
            <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-200/80 border border-slate-300 text-xs font-bold">
              <button
                type="button"
                onClick={() => setLayoutMode('detailed')}
                className={`px-3 py-1 rounded-lg transition ${
                  layoutMode === 'detailed'
                    ? 'bg-white text-teal-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Format lembar kunci jawaban lengkap dengan rincian per nomor"
              >
                Format Lengkap
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('matrix')}
                className={`px-3 py-1 rounded-lg transition ${
                  layoutMode === 'matrix'
                    ? 'bg-white text-teal-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Tabel matriks kunci ringkas untuk koreksi cepat"
              >
                Tabel Ringkas
              </button>
            </div>
          </div>
        </div>

        {/* Metadata Banner */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-600">
          <div className="flex flex-wrap items-center gap-3">
            <span>
              Mata Pelajaran: <strong>{currentPackage.subject}</strong> ({currentPackage.grade}, {currentPackage.phase})
            </span>
            <span>•</span>
            <span>
              Total: <strong>{questions.length} Butir Soal</strong> (PG: {mcQuestions.length}, PGK: {cmcQuestions.length}, Isian: {saQuestions.length}, Uraian: {essayQuestions.length})
            </span>
            <span>•</span>
            <span>
              Akumulasi Skor: <strong className="text-teal-700">{totalScore} Poin</strong>
            </span>
          </div>

          {saveSuccessNotice && (
            <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              <Check className="w-3 h-3" />
              <span>Perubahan kunci berhasil disimpan ke paket!</span>
            </span>
          )}
        </div>
      </div>

      {/* DOKUMEN CETAK KUNCI JAWABAN (Printable A4 Paper Document) */}
      <div className="printable-document bg-white p-6 sm:p-10 rounded-2xl border border-slate-200 shadow-sm print:p-0 print:border-none print:shadow-none space-y-6">
        {/* KOP RESMI MADRASAH */}
        <div className="border-b-4 border-double border-black pb-3 text-center">
          <p className="text-xs sm:text-sm font-bold tracking-wider uppercase text-black">
            KEMENTERIAN AGAMA REPUBLIK INDONESIA
          </p>
          <p className="text-base sm:text-xl font-extrabold tracking-wide uppercase text-black mt-0.5">
            {schoolName}
          </p>
          {schoolProfile?.npsnOrNsm && (
            <p className="text-[11px] text-black">
              NSM / NPSN: {schoolProfile.npsnOrNsm}
            </p>
          )}
          <p className="text-[11px] italic text-black mt-0.5">
            {address}
          </p>
        </div>

        {/* JUDUL DOKUMEN KUNCI JAWABAN */}
        <div className="text-center space-y-1">
          <h2 className="text-sm sm:text-base font-extrabold uppercase tracking-wide text-black underline">
            KUNCI JAWABAN DAN PEDOMAN PENSKORAN
          </h2>
          <p className="text-xs font-bold text-black uppercase">
            {currentPackage.assessmentType} — TAHUN PELAJARAN {currentPackage.academicYear}
          </p>
        </div>

        {/* TABEL IDENTITAS ASESMEN */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-black border-y border-black py-2.5">
          <div className="space-y-0.5">
            <div className="flex">
              <span className="w-32 font-bold">Mata Pelajaran</span>
              <span>: {currentPackage.subject}</span>
            </div>
            <div className="flex">
              <span className="w-32 font-bold">Kelas / Fase</span>
              <span>: {currentPackage.grade} ({currentPackage.phase})</span>
            </div>
            <div className="flex">
              <span className="w-32 font-bold">Semester</span>
              <span>: {currentPackage.semester}</span>
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="flex">
              <span className="w-32 font-bold">Alokasi Waktu</span>
              <span>: {currentPackage.durationMinutes} Menit</span>
            </div>
            <div className="flex">
              <span className="w-32 font-bold">Guru Pengampu</span>
              <span>: {currentPackage.teacherName || schoolProfile?.teacherName || 'Guru Madrasah'}</span>
            </div>
            <div className="flex">
              <span className="w-32 font-bold">Total Skor Maks.</span>
              <span>: {totalScore}</span>
            </div>
          </div>
        </div>

        {/* ISI KUNCI JAWABAN BERDASARKAN MODE */}
        {layoutMode === 'matrix' ? (
          /* MODE 1: TABEL MATRIKS RINGKAS UNTUK KOREKSI CEPAT */
          <div className="space-y-6">
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-wide text-black mb-2">
                I. TABEL KUNCI JAWABAN & BOBOT SKOR (SEMUA BUTIR SOAL)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-black border-collapse border border-black">
                  <thead>
                    <tr className="bg-slate-100 print:bg-slate-200">
                      <th className="border border-black px-2.5 py-1.5 text-center w-12">No.</th>
                      <th className="border border-black px-2.5 py-1.5 text-center w-28">Bentuk Soal</th>
                      <th className="border border-black px-3 py-1.5 text-left">Kunci Jawaban / Alternatif Jawaban Benar</th>
                      <th className="border border-black px-2.5 py-1.5 text-center w-16">Skor</th>
                      {showExplanations && (
                        <th className="border border-black px-3 py-1.5 text-left">Pembahasan Singkat</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {questions.map((q, idx) => {
                      const typeLabel =
                        q.type === 'multiple_choice'
                          ? 'PG Biasa'
                          : q.type === 'complex_multiple_choice'
                          ? 'PG Kompleks'
                          : q.type === 'short_answer'
                          ? 'Isian'
                          : 'Uraian';

                      return (
                        <tr key={q.id} className="hover:bg-slate-50 print:hover:bg-transparent">
                          <td className="border border-black px-2.5 py-1.5 text-center font-bold">
                            {q.number}
                          </td>
                          <td className="border border-black px-2.5 py-1.5 text-center">
                            {typeLabel}
                          </td>
                          <td className="border border-black px-3 py-1.5 font-bold">
                            {q.type === 'multiple_choice' ? (
                              <span className="px-2 py-0.5 rounded bg-slate-100 print:bg-transparent border print:border-none border-slate-300">
                                {q.answerKey || '-'}
                              </span>
                            ) : q.type === 'complex_multiple_choice' ? (
                              <span>{q.answerKey || 'Kunci multi-pilihan'}</span>
                            ) : q.type === 'short_answer' ? (
                              <span>
                                {q.answerKey || '-'}
                                {q.acceptedAnswers && q.acceptedAnswers.length > 0 && (
                                  <span className="text-[11px] font-normal text-slate-600 block print:text-black">
                                    (Alternatif: {q.acceptedAnswers.join(' / ')})
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span>Pedoman penskoran rubrik uraian (lihat lampiran)</span>
                            )}
                          </td>
                          <td className="border border-black px-2.5 py-1.5 text-center font-bold">
                            {q.score || 1}
                          </td>
                          {showExplanations && (
                            <td className="border border-black px-3 py-1.5 text-slate-800 print:text-black leading-relaxed">
                              {q.explanation || 'Pembahasan sesuai dengan indikator materi pokok kurikulum.'}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 print:bg-slate-200 font-bold">
                      <td colSpan={3} className="border border-black px-3 py-1.5 text-right uppercase">
                        Total Skor Maksimal:
                      </td>
                      <td className="border border-black px-2.5 py-1.5 text-center font-extrabold">
                        {totalScore}
                      </td>
                      {showExplanations && <td className="border border-black"></td>}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        ) : (
          /* MODE 2: PEDOMAN PENSKORAN LENGKAP PER BAGIAN */
          <div className="space-y-6">
            {/* Bagian I: Pilihan Ganda Biasa */}
            {mcQuestions.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-black pb-1">
                  <h3 className="text-xs font-extrabold uppercase tracking-wide text-black">
                    BAGIAN I. KUNCI JAWABAN PILIHAN GANDA ({mcQuestions.length} Butir)
                  </h3>
                  <span className="text-[11px] font-bold text-black">
                    Bobot Tiap Soal: {mcQuestions[0]?.score || 1} Poin
                  </span>
                </div>

                {/* Grid Kunci PG Ringkas */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {mcQuestions.map((q) => {
                    const actualIdx = questions.findIndex((item) => item.id === q.id);
                    return (
                      <div
                        key={q.id}
                        className="p-2.5 rounded-lg border border-black bg-white flex flex-col justify-between gap-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-xs text-black">
                            No. {q.number}
                          </span>
                          <span className="font-bold text-sm text-teal-900 print:text-black bg-slate-100 print:bg-transparent px-2 py-0.5 rounded border print:border-none border-slate-300">
                            {q.answerKey || '-'}
                          </span>
                        </div>
                        {showExplanations && q.explanation && (
                          <p className="text-[10px] text-slate-700 print:text-black italic leading-tight pt-1 border-t border-slate-200 print:border-black">
                            {q.explanation}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Bagian II: Pilihan Ganda Kompleks */}
            {cmcQuestions.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="border-b border-black pb-1">
                  <h3 className="text-xs font-extrabold uppercase tracking-wide text-black">
                    BAGIAN II. KUNCI JAWABAN PILIHAN GANDA KOMPLEKS ({cmcQuestions.length} Butir)
                  </h3>
                </div>

                <div className="space-y-3">
                  {cmcQuestions.map((q) => {
                    const actualIdx = questions.findIndex((item) => item.id === q.id);
                    return (
                      <div
                        key={q.id}
                        className="p-3 rounded-lg border border-black bg-white space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-black">
                            Nomor {q.number} (Skor: {q.score || 2})
                          </span>
                          <span className="font-bold text-xs text-black bg-slate-100 print:bg-transparent px-2 py-0.5 rounded border print:border-none border-slate-300">
                            Kunci: {q.answerKey || 'Pernyataan benar sesuai stimulus'}
                          </span>
                        </div>
                        <p className="text-xs text-black font-medium">
                          Soal: "{q.questionText}"
                        </p>
                        {showExplanations && (
                          <div className="p-2 rounded bg-slate-50 print:bg-transparent border border-slate-200 print:border-black text-[11px] text-black space-y-0.5">
                            <span className="font-bold text-black block">Pembahasan Singkat:</span>
                            <p className="leading-relaxed">
                              {q.explanation || 'Jawaban benar berdasarkan analisis butir soal Kurikulum Merdeka.'}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Bagian III: Isian Singkat */}
            {saQuestions.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="border-b border-black pb-1">
                  <h3 className="text-xs font-extrabold uppercase tracking-wide text-black">
                    BAGIAN III. KUNCI JAWABAN ISIAN SINGKAT ({saQuestions.length} Butir)
                  </h3>
                </div>

                <div className="space-y-3">
                  {saQuestions.map((q) => {
                    const actualIdx = questions.findIndex((item) => item.id === q.id);
                    return (
                      <div
                        key={q.id}
                        className="p-3 rounded-lg border border-black bg-white space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-black">
                            Nomor {q.number} (Skor: {q.score || 2})
                          </span>
                          <div className="text-right">
                            <span className="text-[11px] font-bold text-black">
                              Kunci Utama: <strong className="underline">{q.answerKey || '-'}</strong>
                            </span>
                          </div>
                        </div>

                        <p className="text-xs text-black">
                          Pertanyaan: "{q.questionText}"
                        </p>

                        {q.acceptedAnswers && q.acceptedAnswers.length > 0 && (
                          <div className="text-[11px] text-slate-700 print:text-black">
                            <span>Alternatif Jawaban yang Diterima Benar: </span>
                            <span className="font-bold">{q.acceptedAnswers.join(', ')}</span>
                          </div>
                        )}

                        {showExplanations && (
                          <div className="p-2 rounded bg-slate-50 print:bg-transparent border border-slate-200 print:border-black text-[11px] text-black space-y-0.5">
                            <span className="font-bold text-black block">Pembahasan Singkat:</span>
                            <p className="leading-relaxed">
                              {q.explanation || 'Jawaban isian tepat sesuai capaian pembelajaran dan indikator.'}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Bagian IV: Uraian & Rubrik Penskoran */}
            {essayQuestions.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="border-b border-black pb-1">
                  <h3 className="text-xs font-extrabold uppercase tracking-wide text-black">
                    BAGIAN IV. PEDOMAN PENSKORAN & RUBRIK SOAL URAIAN ({essayQuestions.length} Butir)
                  </h3>
                </div>

                <div className="space-y-4">
                  {essayQuestions.map((q) => {
                    const actualIdx = questions.findIndex((item) => item.id === q.id);
                    return (
                      <div
                        key={q.id}
                        className="p-3.5 rounded-lg border border-black bg-white space-y-2.5"
                      >
                        <div className="flex items-center justify-between border-b border-slate-200 print:border-black pb-1.5">
                          <span className="font-bold text-xs text-black">
                            Soal Uraian Nomor {q.number}
                          </span>
                          <span className="font-bold text-xs text-black">
                            Skor Maksimal: {q.score || 5} Poin
                          </span>
                        </div>

                        <p className="text-xs text-black font-medium">
                          "{q.questionText}"
                        </p>

                        {/* Pedoman / Kunci Jawaban Ideal */}
                        <div className="p-2 rounded bg-slate-50 print:bg-transparent border border-slate-200 print:border-black text-xs space-y-1">
                          <span className="font-bold text-black block">Pedoman Jawaban Ideal:</span>
                          <p className="text-slate-800 print:text-black leading-relaxed">
                            {q.answerKey || 'Peserta didik memberikan uraian penjelasan sistematis dan lengkap.'}
                          </p>
                        </div>

                        {/* Tabel Rubrik Penskoran */}
                        {q.rubric && q.rubric.length > 0 && (
                          <div>
                            <span className="text-[11px] font-bold text-black block mb-1">
                              Kriteria Rubrik Penskoran:
                            </span>
                            <table className="w-full text-xs text-black border-collapse border border-black">
                              <thead>
                                <tr className="bg-slate-100 print:bg-slate-200">
                                  <th className="border border-black px-2 py-1 text-left">Deskripsi Kriteria Jawaban</th>
                                  <th className="border border-black px-2 py-1 text-center w-20">Skor</th>
                                </tr>
                              </thead>
                              <tbody>
                                {q.rubric.map((r, rIdx) => (
                                  <tr key={rIdx}>
                                    <td className="border border-black px-2 py-1">{r.criteria}</td>
                                    <td className="border border-black px-2 py-1 text-center font-bold">{r.score}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {showExplanations && (
                          <div className="p-2 rounded bg-slate-50 print:bg-transparent border border-slate-200 print:border-black text-[11px] text-black space-y-0.5">
                            <span className="font-bold text-black block">Pembahasan Singkat:</span>
                            <p className="leading-relaxed">
                              {q.explanation || 'Pembahasan mendalam mengacu pada rubrik penskoran di atas.'}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TANDA TANGAN FORMAL MADRASAH */}
        <div className="pt-6 border-t border-black text-xs text-black grid grid-cols-2 gap-8 text-center break-inside-avoid">
          <div className="space-y-14">
            <div>
              <p>Mengetahui,</p>
              <p className="font-bold">Kepala Madrasah</p>
            </div>
            <div>
              <p className="font-bold underline uppercase">
                {schoolProfile?.principalName || '..............................................'}
              </p>
              <p>NIP. {schoolProfile?.principalNip || '.......................................'}</p>
            </div>
          </div>

          <div className="space-y-14">
            <div>
              <p>
                {schoolProfile?.city || 'Madrasah'}, {formatIndonesianDate(new Date().toISOString())}
              </p>
              <p className="font-bold">Guru Mata Pelajaran</p>
            </div>
            <div>
              <p className="font-bold underline uppercase">
                {currentPackage.teacherName || schoolProfile?.teacherName || '..............................................'}
              </p>
              <p>NIP. {schoolProfile?.teacherNip || '.......................................'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
