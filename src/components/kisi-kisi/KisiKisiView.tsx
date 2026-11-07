import React, { useState, useEffect } from 'react';
import {
  Table2,
  Sparkles,
  Info,
  Layers,
  ArrowRight,
  BookOpen,
  PlusCircle,
  FileSpreadsheet,
  FileText,
  FileDown,
  Save,
  CheckCircle2,
  Edit3,
  Loader2,
} from 'lucide-react';
import { ActiveView, CognitiveLevel, QuestionItem, QuestionPackage, SchoolProfile } from '../../types';
import { calculateTotalQuestions, normalizeQuestionNumbering, formatIndonesianDate } from '../../utils/curriculum';
import {
  downloadExcelPackage,
  downloadKisiKisiWord,
  downloadKisiKisiPdf,
} from '../../services/exportService';

interface KisiKisiViewProps {
  packages: QuestionPackage[];
  schoolProfile?: SchoolProfile | null;
  onNavigate: (view: ActiveView) => void;
  onOpenPackage: (pkg: QuestionPackage) => void;
  onUpdatePackage?: (pkg: QuestionPackage) => void;
}

export const KisiKisiView: React.FC<KisiKisiViewProps> = ({
  packages,
  schoolProfile = null,
  onNavigate,
  onOpenPackage,
  onUpdatePackage,
}) => {
  const [selectedPackageId, setSelectedPackageId] = useState<string>(
    packages[0]?.id || ''
  );

  const currentPackage = packages.find((p) => p.id === selectedPackageId) || packages[0];

  const [questions, setQuestions] = useState<QuestionItem[]>(() =>
    normalizeQuestionNumbering(currentPackage?.questions || [])
  );
  const [isDirty, setIsDirty] = useState(false);
  const [isExportingWord, setIsExportingWord] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  useEffect(() => {
    if (currentPackage) {
      setQuestions(normalizeQuestionNumbering(currentPackage.questions || []));
      setIsDirty(false);
    }
  }, [currentPackage]);

  const total = currentPackage
    ? calculateTotalQuestions(
        currentPackage.multipleChoiceCount,
        currentPackage.shortAnswerCount,
        currentPackage.essayCount,
        currentPackage.complexMultipleChoiceCount
      )
    : 0;

  const handleUpdateItem = (index: number, updated: Partial<QuestionItem>) => {
    setQuestions((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updated };
      return next;
    });
    setIsDirty(true);
  };

  const handleSaveChanges = () => {
    if (!currentPackage || !onUpdatePackage) return;
    const updatedPkg: QuestionPackage = {
      ...currentPackage,
      questions,
      updatedAt: new Date().toISOString(),
    };
    onUpdatePackage(updatedPkg);
    setIsDirty(false);
  };

  const handleDownloadExcel = () => {
    if (!currentPackage) return;
    downloadExcelPackage(
      { ...currentPackage, questions },
      schoolProfile || null,
      { includeAnswers: true }
    );
  };

  const handleDownloadWord = async () => {
    if (!currentPackage || isExportingWord) return;
    try {
      setIsExportingWord(true);
      await downloadKisiKisiWord(
        { ...currentPackage, questions },
        schoolProfile || null,
        { includeAnswers: true }
      );
    } catch (err) {
      console.error('Gagal mengunduh kisi-kisi Word:', err);
    } finally {
      setIsExportingWord(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!currentPackage || isExportingPdf) return;
    try {
      setIsExportingPdf(true);
      await downloadKisiKisiPdf(
        { ...currentPackage, questions },
        schoolProfile || null,
        { includeAnswers: true }
      );
    } catch (err) {
      console.error('Gagal mengunduh kisi-kisi PDF:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const hasItemQuestions = questions.length > 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Table2 className="w-7 h-7 text-teal-700" />
            <span>Matriks Kisi-kisi Soal Asesmen MI</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Pemetaan Capaian Pembelajaran (CP), Tujuan Pembelajaran (TP), Indikator Butir Soal, dan Level Kognitif.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {currentPackage && (
            <>
              {/* Tombol Cetak/Unduh PDF */}
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isExportingPdf}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-600 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold transition shadow-2xs disabled:opacity-50"
                title="Cetak / Unduh Matriks Kisi-kisi dalam format PDF resmi"
              >
                {isExportingPdf ? (
                  <Loader2 className="w-4 h-4 text-rose-600 animate-spin" />
                ) : (
                  <FileDown className="w-4 h-4 text-rose-600" />
                )}
                <span>PDF Kisi-kisi</span>
              </button>

              {/* Tombol Cetak/Unduh MS Word */}
              <button
                type="button"
                onClick={handleDownloadWord}
                disabled={isExportingWord}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-blue-600 bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-bold transition shadow-2xs disabled:opacity-50"
                title="Cetak / Unduh Matriks Kisi-kisi dalam format MS Word (.docx) resmi"
              >
                {isExportingWord ? (
                  <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4 text-blue-600" />
                )}
                <span>Word (.docx)</span>
              </button>

              {/* Tombol Ekspor Excel */}
              <button
                type="button"
                onClick={handleDownloadExcel}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-teal-600 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold transition shadow-2xs"
                title="Unduh Matriks Kisi-kisi dalam format Spreadsheet Excel"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Excel (.xlsx)</span>
              </button>
            </>
          )}

          {isDirty && onUpdatePackage && (
            <button
              type="button"
              onClick={handleSaveChanges}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold shadow-xs transition"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Matriks</span>
            </button>
          )}
        </div>
      </div>

      {/* Explanation Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 to-teal-950 text-white border border-teal-800/40 shadow-sm space-y-2">
        <div className="flex items-center gap-2 font-bold text-sm text-teal-300">
          <Info className="w-4 h-4" />
          <span>Pedoman Matriks Asesmen Kurikulum Merdeka MI</span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
          Matriks kisi-kisi menghubungkan materi pokok dan indikator operasional butir soal secara presisi.
          Level kognitif operasional yang digunakan: <strong>L1</strong> (Mengingat atau Memahami), <strong>L2</strong> (Menerapkan Konsep), dan <strong>L3</strong> (Penalaran / HOTS).
          Setiap perubahan indikator atau skor di bawah ini dapat disimpan langsung ke dalam paket asesmen Anda.
        </p>
      </div>

      {packages.length === 0 ? (
        /* Empty State */
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-teal-50 text-teal-700 mx-auto flex items-center justify-center">
            <Table2 className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base font-bold text-slate-800">
              Belum Ada Paket Soal untuk Dibuatkan Kisi-kisi
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Buat paket soal terlebih dahulu untuk menentukan mata pelajaran, kelas,
              dan target jumlah butir soal yang akan dipetakan ke dalam kisi-kisi.
            </p>
          </div>
          <div>
            <button
              type="button"
              onClick={() => onNavigate('create-package')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs shadow-xs transition"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Buat Paket Soal Baru</span>
            </button>
          </div>
        </div>
      ) : (
        /* Package Selector & Matrix Structure */
        <div className="space-y-6">
          {/* Selector */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <Layers className="w-4 h-4 text-teal-700" />
              <span>Pilih Paket Soal Acuan:</span>
            </div>

            <select
              value={currentPackage.id}
              onChange={(e) => setSelectedPackageId(e.target.value)}
              className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-medium text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 max-w-md"
            >
              {packages.map((pkg) => (
                <option key={pkg.id} value={pkg.id}>
                  {pkg.subject} (Kelas {pkg.grade} {pkg.phase}) — {pkg.title}
                </option>
              ))}
            </select>
          </div>

          {/* Matrix Specification Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800 bg-teal-100 px-2.5 py-0.5 rounded-full">
                  {currentPackage.subject}
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  Matriks Spesifikasi Asesmen: {currentPackage.title}
                </h3>
                <p className="text-xs text-slate-500">
                  Madrasah: {currentPackage.schoolName} • Guru: {currentPackage.teacherName} • TP {currentPackage.academicYear}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenPackage(currentPackage)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-700 hover:text-teal-700 text-xs font-semibold shadow-2xs transition"
                >
                  <span>Lihat Pratinjau Naskah</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Parameter Ringkasan */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block text-[11px]">Kelas / Fase</span>
                  <strong className="text-slate-800 font-bold">
                    Kelas {currentPackage.grade} ({currentPackage.phase})
                  </strong>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block text-[11px]">Jenis Asesmen</span>
                  <strong className="text-slate-800 font-bold">
                    {currentPackage.assessmentType}
                  </strong>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block text-[11px]">Tingkat Kesulitan</span>
                  <strong className="text-slate-800 font-bold">
                    {currentPackage.difficulty}
                  </strong>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 block text-[11px]">Total Butir Soal</span>
                  <strong className="text-teal-700 font-extrabold">
                    {hasItemQuestions ? questions.length : total} Soal
                  </strong>
                </div>
              </div>

              {/* Tabel Matriks Kisi-kisi Real per Butir Soal */}
              {hasItemQuestions ? (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Matriks Rincian Butir Soal ({questions.length} Butir)
                    </h4>
                    {isDirty && (
                      <span className="text-xs text-amber-600 font-bold">
                        * Terdapat perubahan belum disimpan
                      </span>
                    )}
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                          <th className="p-3 text-center w-12">No</th>
                          <th className="p-3">Materi Pokok & Capaian</th>
                          <th className="p-3">Indikator Soal (Dapat Diedit)</th>
                          <th className="p-3 text-center w-28">Bentuk</th>
                          <th className="p-3 w-44">Level Kognitif</th>
                          <th className="p-3 text-center w-20">Kunci</th>
                          <th className="p-3 text-center w-20">Skor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {questions.map((q, idx) => (
                          <tr key={q.id} className="hover:bg-slate-50/60">
                            <td className="p-3 text-center font-bold text-slate-800">
                              {q.number}
                            </td>
                            <td className="p-3">
                              <strong className="text-slate-800 block text-[11px]">
                                {q.topic || currentPackage.topic}
                              </strong>
                              <span className="text-slate-400 text-[10px]">
                                Kelas {currentPackage.grade} {currentPackage.phase}
                              </span>
                            </td>
                            <td className="p-3">
                              <input
                                type="text"
                                value={q.indicator || ''}
                                onChange={(e) => handleUpdateItem(idx, { indicator: e.target.value })}
                                className="w-full px-2 py-1 rounded border border-slate-300 text-xs bg-white"
                              />
                            </td>
                            <td className="p-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-md font-semibold text-[10px] ${
                                  q.type === 'multiple_choice'
                                    ? 'bg-blue-50 text-blue-700'
                                    : q.type === 'complex_multiple_choice'
                                    ? 'bg-indigo-50 text-indigo-700'
                                    : q.type === 'short_answer'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-purple-50 text-purple-700'
                                }`}
                              >
                                {q.type === 'multiple_choice'
                                  ? 'PG'
                                  : q.type === 'complex_multiple_choice'
                                  ? 'PG-K'
                                  : q.type === 'short_answer'
                                  ? 'Isian'
                                  : 'Uraian'}
                              </span>
                            </td>
                            <td className="p-3">
                              <select
                                value={q.cognitiveLevel}
                                onChange={(e) => handleUpdateItem(idx, { cognitiveLevel: e.target.value as CognitiveLevel })}
                                className="w-full px-2 py-1 rounded border border-slate-300 text-[11px] bg-white"
                              >
                                <option value="L1 (Mengingat/Memahami)">L1 (Mengingat/Memahami)</option>
                                <option value="L2 (Menerapkan)">L2 (Menerapkan)</option>
                                <option value="L3 (Penalaran/HOTS)">L3 (Penalaran/HOTS)</option>
                              </select>
                            </td>
                            <td className="p-3 text-center font-bold text-teal-800">
                              {q.answerKey || '-'}
                            </td>
                            <td className="p-3 text-center">
                              <input
                                type="number"
                                min="1"
                                max="20"
                                value={q.score || 1}
                                onChange={(e) => handleUpdateItem(idx, { score: Number(e.target.value) || 1 })}
                                className="w-12 px-1 py-1 rounded border border-slate-300 text-xs font-bold text-center bg-white"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* Tabel Gambaran Umum jika butir soal belum digenerate */
                <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-3">
                  <p className="text-xs text-slate-600 leading-relaxed max-w-lg mx-auto">
                    Paket ini memiliki rencana {total} butir soal, namun butir-butir pertanyaan belum digenerate dengan AI.
                  </p>
                  <button
                    type="button"
                    onClick={() => onOpenPackage(currentPackage)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-700 text-white font-bold text-xs shadow-xs"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Buka Paket & Mulai Generate Soal AI</span>
                  </button>
                </div>
              )}

              {/* TANDA TANGAN DOKUMEN KISI-KISI (Kepala Madrasah & Guru Mata Pelajaran) */}
              <div className="mt-10 pt-6 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-8 text-center text-xs">
                <div className="space-y-16">
                  <p className="text-slate-700">
                    Mengetahui,<br />
                    <span className="font-semibold">Kepala {schoolProfile?.schoolName || currentPackage.schoolName || 'Madrasah'}</span>
                  </p>
                  <div>
                    <p className="font-bold underline text-slate-900">
                      {schoolProfile?.principalName || '...................................................'}
                    </p>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      NIP. {schoolProfile?.principalNip || '.............................................'}
                    </p>
                  </div>
                </div>

                <div className="space-y-16">
                  <p className="text-slate-700">
                    {schoolProfile?.city ? `${schoolProfile.city}, ` : ''}
                    {formatIndonesianDate(currentPackage.createdAt)}
                    <br />
                    <span className="font-semibold">Guru Mata Pelajaran</span>
                  </p>
                  <div>
                    <p className="font-bold underline text-slate-900">
                      {currentPackage.teacherName || schoolProfile?.teacherName || '...................................................'}
                    </p>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                      NIP. {schoolProfile?.teacherNip || '.............................................'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
