import React, { useState, useMemo } from 'react';
import {
  X,
  BarChart2,
  FileSpreadsheet,
  Printer,
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Sparkles,
  Info,
  ArrowRight,
  Calculator,
  RefreshCw,
  BookOpen,
} from 'lucide-react';
import { QuestionPackage, SchoolProfile } from '../../types';
import {
  analyzePackageItems,
  exportItemAnalysisToExcel,
  PackageItemAnalysisReport,
} from '../../utils/itemAnalysis';
import { triggerBrowserDownload } from '../../services/exportService';

interface ItemAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  pkg: QuestionPackage;
  schoolProfile?: SchoolProfile | null;
}

export const ItemAnalysisModal: React.FC<ItemAnalysisModalProps> = ({
  isOpen,
  onClose,
  pkg,
  schoolProfile,
}) => {
  const [activeTab, setActiveTab] = useState<'report' | 'calculator' | 'guide'>('report');
  const [filterType, setFilterType] = useState<'all' | 'needs_review' | 'sukar' | 'sedang' | 'mudah'>('all');

  // State untuk input skor siswa mandiri
  const [useCustomData, setUseCustomData] = useState(false);
  const [totalStudents, setTotalStudents] = useState<number>(30);
  const [groupSize, setGroupSize] = useState<number>(10); // Kelompok Atas & Bawah (±33% dari 30 siswa)
  const [customInputs, setCustomInputs] = useState<
    Record<
      number,
      { totalCorrect: number; upperCorrect: number; lowerCorrect: number }
    >
  >({});

  // Hitung laporan analisis butir soal
  const report: PackageItemAnalysisReport = useMemo(() => {
    if (!useCustomData) {
      return analyzePackageItems(pkg);
    }

    const customMapped: Record<
      number,
      {
        totalCorrect: number;
        totalStudents: number;
        upperCorrect: number;
        lowerCorrect: number;
        groupSize: number;
      }
    > = {};

    (pkg.questions || []).forEach((q) => {
      const input = customInputs[q.number] || {
        totalCorrect: Math.round(totalStudents * 0.6),
        upperCorrect: Math.round(groupSize * 0.8),
        lowerCorrect: Math.round(groupSize * 0.4),
      };

      customMapped[q.number] = {
        totalCorrect: input.totalCorrect,
        totalStudents,
        upperCorrect: input.upperCorrect,
        lowerCorrect: input.lowerCorrect,
        groupSize,
      };
    });

    return analyzePackageItems(pkg, customMapped);
  }, [pkg, useCustomData, customInputs, totalStudents, groupSize]);

  if (!isOpen) return null;

  // Filter butir soal yang ditampilkan di tabel
  const filteredItems = report.items.filter((item) => {
    if (filterType === 'needs_review') {
      return item.recommendation !== 'Diterima';
    }
    if (filterType === 'sukar') {
      return item.difficultyCategory === 'Sukar';
    }
    if (filterType === 'sedang') {
      return item.difficultyCategory === 'Sedang';
    }
    if (filterType === 'mudah') {
      return item.difficultyCategory === 'Mudah';
    }
    return true;
  });

  const handleExportExcel = () => {
    const blob = exportItemAnalysisToExcel(pkg, report, schoolProfile);
    const cleanTitle = pkg.title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 35);
    triggerBrowserDownload(blob, `Analisis_Statistik_Soal_${cleanTitle}.xlsx`);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleUpdateStudentInput = (
    qNumber: number,
    field: 'totalCorrect' | 'upperCorrect' | 'lowerCorrect',
    val: number
  ) => {
    setCustomInputs((prev) => {
      const current = prev[qNumber] || {
        totalCorrect: Math.round(totalStudents * 0.6),
        upperCorrect: Math.round(groupSize * 0.8),
        lowerCorrect: Math.round(groupSize * 0.4),
      };

      const updated = { ...current, [field]: Math.max(0, val) };
      return { ...prev, [qNumber]: updated };
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/70 backdrop-blur-xs overflow-y-auto"
    >
      <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in duration-200">
        {/* Modal Header */}
        <div className="p-5 bg-gradient-to-r from-teal-800 to-slate-900 text-white flex items-start justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-teal-600/30 border border-teal-400/40 text-teal-200 flex items-center justify-center shrink-0">
              <BarChart2 className="w-6 h-6 text-teal-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold tracking-tight">
                  Analisis Statistik Butir Soal (P & D)
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-teal-900/80 text-teal-200 border border-teal-500/40">
                  Evaluasi Mandiri Guru
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {pkg.title} • {pkg.subject} Kelas {pkg.grade} ({pkg.phase}) • {report.totalQuestions} Butir Soal
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition"
            aria-label="Tutup jendela analisis"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher & Export Bar */}
        <div className="px-5 py-3 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-200/80 text-xs font-semibold text-slate-700">
            <button
              type="button"
              onClick={() => setActiveTab('report')}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeTab === 'report' ? 'bg-white text-teal-950 font-bold shadow-2xs' : 'hover:text-slate-900'
              }`}
            >
              Hasil Evaluasi & Diagnostik
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('calculator')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                activeTab === 'calculator' ? 'bg-white text-teal-950 font-bold shadow-2xs' : 'hover:text-slate-900'
              }`}
            >
              <Calculator className="w-3.5 h-3.5 text-teal-600" />
              <span>Simulasi / Input Skor Siswa</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('guide')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                activeTab === 'guide' ? 'bg-white text-teal-950 font-bold shadow-2xs' : 'hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-teal-600" />
              <span>Panduan Arikunto</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold shadow-2xs transition"
              title="Unduh Laporan Analisis Butir Soal ke Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              <span>Unduh Excel</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition"
              title="Cetak Laporan Analisis Butir Soal"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>Cetak</span>
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5 text-slate-800">
          {/* TAB 1: HASIL EVALUASI & DIAGNOSTIK */}
          {activeTab === 'report' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Overall Quality Banner */}
              <div className="p-4 rounded-xl border bg-slate-50/70 border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-teal-700" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full border ${report.overallQualityAssessment.badgeClass}`}>
                        {report.overallQualityAssessment.grade}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900">
                        {report.overallQualityAssessment.label}
                      </h3>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                      {report.overallQualityAssessment.description}
                    </p>
                  </div>
                </div>

                {useCustomData ? (
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-300 text-teal-800 shrink-0">
                    Berdasarkan Data Hasil Siswa ({totalStudents} Siswa)
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-slate-200/70 text-slate-700 shrink-0">
                    Berdasarkan Bobot Kognitif Kurikulum Merdeka
                  </span>
                )}
              </div>

              {/* 4 Summary Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                {/* 1. Tingkat Kesukaran Rata-rata */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Rata-rata Kesukaran (P)
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-black text-slate-900">
                      {report.averageFacilityIndex}
                    </span>
                    <span className="text-[11px] font-bold text-slate-600">
                      ({report.averageFacilityIndex > 0.70 ? 'Mudah' : report.averageFacilityIndex >= 0.30 ? 'Sedang' : 'Sukar'})
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Target ideal: 0.30 - 0.70
                  </p>
                </div>

                {/* 2. Daya Pembeda Rata-rata */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Rata-rata Daya Beda (D)
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-black text-teal-900">
                      {report.averageDiscriminationIndex}
                    </span>
                    <span className="text-[11px] font-bold text-teal-700">
                      ({report.averageDiscriminationIndex >= 0.40 ? 'Sangat Baik' : report.averageDiscriminationIndex >= 0.30 ? 'Baik' : 'Cukup'})
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Target ideal: D ≥ 0.30
                  </p>
                </div>

                {/* 3. Sebaran Kesukaran Butir */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Sebaran Kesukaran
                  </span>
                  <div className="text-xs font-bold space-y-0.5 text-slate-700">
                    <div className="flex justify-between">
                      <span className="text-emerald-700">Mudah:</span>
                      <span>{report.difficultySummary.mudahCount} ({report.difficultySummary.mudahPct}%)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sky-700">Sedang:</span>
                      <span>{report.difficultySummary.sedangCount} ({report.difficultySummary.sedangPct}%)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-purple-700">Sukar:</span>
                      <span>{report.difficultySummary.sukarCount} ({report.difficultySummary.sukarPct}%)</span>
                    </div>
                  </div>
                </div>

                {/* 4. Rekomendasi Kelayakan */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Status Kelayakan
                  </span>
                  <div className="text-xs font-bold space-y-0.5 text-slate-700">
                    <div className="flex justify-between">
                      <span className="text-emerald-700">Diterima:</span>
                      <span>{report.recommendationSummary.diterimaCount} Butir</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-amber-700">Revisi Pengecoh:</span>
                      <span>{report.recommendationSummary.revisiCount} Butir</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-rose-700">Kaji Ulang:</span>
                      <span>{report.recommendationSummary.dibuangCount} Butir</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Table Filter Tabs */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 text-xs font-semibold text-slate-700">
                  <button
                    type="button"
                    onClick={() => setFilterType('all')}
                    className={`px-3 py-1 rounded-lg transition ${
                      filterType === 'all' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'hover:text-slate-900'
                    }`}
                  >
                    Semua Butir ({report.items.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType('needs_review')}
                    className={`px-3 py-1 rounded-lg transition ${
                      filterType === 'needs_review' ? 'bg-white text-amber-900 font-bold shadow-2xs' : 'hover:text-amber-900'
                    }`}
                  >
                    Perlu Perbaikan ({report.recommendationSummary.revisiCount + report.recommendationSummary.dibuangCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType('sukar')}
                    className={`px-3 py-1 rounded-lg transition ${
                      filterType === 'sukar' ? 'bg-white text-purple-900 font-bold shadow-2xs' : 'hover:text-purple-900'
                    }`}
                  >
                    Sukar ({report.difficultySummary.sukarCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType('sedang')}
                    className={`px-3 py-1 rounded-lg transition ${
                      filterType === 'sedang' ? 'bg-white text-sky-900 font-bold shadow-2xs' : 'hover:text-sky-900'
                    }`}
                  >
                    Sedang ({report.difficultySummary.sedangCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType('mudah')}
                    className={`px-3 py-1 rounded-lg transition ${
                      filterType === 'mudah' ? 'bg-white text-emerald-900 font-bold shadow-2xs' : 'hover:text-emerald-900'
                    }`}
                  >
                    Mudah ({report.difficultySummary.mudahCount})
                  </button>
                </div>

                <span className="text-xs text-slate-500 font-medium">
                  Menampilkan {filteredItems.length} dari {report.items.length} butir
                </span>
              </div>

              {/* Detail Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                        <th className="py-2.5 px-3 text-center w-12">No</th>
                        <th className="py-2.5 px-3 w-28">Bentuk</th>
                        <th className="py-2.5 px-3 min-w-[200px]">Indikator / Materi</th>
                        <th className="py-2.5 px-3 text-center w-24">Kesukaran (P)</th>
                        <th className="py-2.5 px-3 text-center w-28">Daya Beda (D)</th>
                        <th className="py-2.5 px-3 text-center w-32">Rekomendasi</th>
                        <th className="py-2.5 px-3 min-w-[220px]">Catatan Pedagogis</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredItems.map((item) => (
                        <tr key={item.questionId || item.questionNumber} className="hover:bg-slate-50/80 transition">
                          <td className="py-2.5 px-3 text-center font-bold text-slate-900">
                            #{item.questionNumber}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-slate-700">
                              {item.type === 'multiple_choice'
                                ? 'PG Biasa'
                                : item.type === 'complex_multiple_choice'
                                ? 'PG Kompleks'
                                : item.type === 'short_answer'
                                ? 'Isian'
                                : 'Uraian'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 line-clamp-2">
                            {item.indicator || item.topic || 'Indikator ketercapaian materi madrasah'}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="font-bold text-slate-900">{item.facilityIndex}</div>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full border ${
                                item.difficultyCategory === 'Mudah'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                  : item.difficultyCategory === 'Sedang'
                                  ? 'bg-sky-50 text-sky-800 border-sky-300'
                                  : 'bg-purple-50 text-purple-800 border-purple-300'
                              }`}
                            >
                              {item.difficultyCategory}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="font-bold text-slate-900">{item.discriminationIndex}</div>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full border ${
                                item.discriminationCategory === 'Sangat Baik'
                                  ? 'bg-teal-50 text-teal-800 border-teal-300'
                                  : item.discriminationCategory === 'Baik'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                  : item.discriminationCategory === 'Cukup'
                                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                                  : 'bg-rose-50 text-rose-800 border-rose-300'
                              }`}
                            >
                              {item.discriminationCategory}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${item.badgeClass}`}>
                              {item.recommendation}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-[11px] text-slate-600 leading-relaxed">
                            {item.recommendationNote}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: KALKULATOR / INPUT SKOR SISWA */}
          {activeTab === 'calculator' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="p-4 rounded-xl bg-teal-50/70 border border-teal-200 text-teal-950 text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-teal-900 text-sm">
                  <Calculator className="w-4 h-4 text-teal-700" />
                  <span>Kalkulator & Evaluasi Hasil Asesmen Siswa Secara Mandiri</span>
                </div>
                <p className="leading-relaxed">
                  Setelah ujian selesai dikoreksi, guru dapat memasukkan jumlah peserta didik yang menjawab benar untuk setiap butir soal. Sistem akan menghitung indeks <strong>Tingkat Kesukaran (P)</strong> dan <strong>Daya Beda (D)</strong> secara presisi sesuai rumus evaluasi pendidikan formal Arikunto.
                </p>
                <div className="flex items-center gap-3 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                    <input
                      type="checkbox"
                      checked={useCustomData}
                      onChange={(e) => setUseCustomData(e.target.checked)}
                      className="w-4 h-4 accent-teal-600 rounded"
                    />
                    <span>Aktifkan Perhitungan Berdasarkan Hasil Ujian Siswa Riil</span>
                  </label>
                </div>
              </div>

              {useCustomData && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Total Jumlah Siswa Mengikuti Ujian (N):
                      </label>
                      <input
                        type="number"
                        min="5"
                        max="200"
                        value={totalStudents}
                        onChange={(e) => {
                          const n = Number(e.target.value) || 30;
                          setTotalStudents(n);
                          setGroupSize(Math.max(2, Math.round(n * 0.33)));
                        }}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold bg-white text-sm"
                      />
                      <span className="text-[11px] text-slate-500 mt-0.5 block">
                        Contoh: 30 siswa kelas 4 MI
                      </span>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Jumlah Siswa Kelompok Atas & Bawah (Ja = Jb):
                      </label>
                      <input
                        type="number"
                        min="2"
                        max={Math.floor(totalStudents / 2)}
                        value={groupSize}
                        onChange={(e) => setGroupSize(Number(e.target.value) || 10)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold bg-white text-sm"
                      />
                      <span className="text-[11px] text-slate-500 mt-0.5 block">
                        Standar: 27% – 33% siswa tertinggi dan terendah (saat ini {groupSize} siswa)
                      </span>
                    </div>
                  </div>

                  {/* Input Grid per Butir Soal */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    <div className="p-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>Input Koreksi per Butir Soal</span>
                      <button
                        type="button"
                        onClick={() => setCustomInputs({})}
                        className="text-teal-700 hover:text-teal-900 underline flex items-center gap-1 font-semibold"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Reset ke Default Rata-rata</span>
                      </button>
                    </div>

                    <div className="overflow-x-auto max-h-[350px]">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                          <tr>
                            <th className="py-2 px-3 text-center w-12">No</th>
                            <th className="py-2 px-3 w-28">Bentuk</th>
                            <th className="py-2 px-3">Siswa Benar Kelompok Atas (Ba ≤ {groupSize})</th>
                            <th className="py-2 px-3">Siswa Benar Kelompok Bawah (Bb ≤ {groupSize})</th>
                            <th className="py-2 px-3">Total Siswa Benar (B ≤ {totalStudents})</th>
                            <th className="py-2 px-3 text-center w-20">Hasil P</th>
                            <th className="py-2 px-3 text-center w-20">Hasil D</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(pkg.questions || []).map((q) => {
                            const inp = customInputs[q.number] || {
                              totalCorrect: Math.round(totalStudents * 0.6),
                              upperCorrect: Math.round(groupSize * 0.8),
                              lowerCorrect: Math.round(groupSize * 0.4),
                            };

                            const itemP = Math.round((inp.totalCorrect / totalStudents) * 100) / 100;
                            const itemD = Math.round(((inp.upperCorrect - inp.lowerCorrect) / groupSize) * 100) / 100;

                            return (
                              <tr key={q.id || q.number} className="hover:bg-slate-50">
                                <td className="py-2 px-3 text-center font-bold text-slate-900">
                                  #{q.number}
                                </td>
                                <td className="py-2 px-3 font-semibold text-slate-600">
                                  {q.type === 'multiple_choice' ? 'PG' : q.type === 'short_answer' ? 'Isian' : q.type === 'essay' ? 'Uraian' : 'PG-K'}
                                </td>
                                <td className="py-2 px-3">
                                  <input
                                    type="number"
                                    min="0"
                                    max={groupSize}
                                    value={inp.upperCorrect}
                                    onChange={(e) => handleUpdateStudentInput(q.number, 'upperCorrect', Number(e.target.value))}
                                    className="w-20 px-2 py-1 rounded border border-slate-300 font-bold text-center"
                                  />
                                </td>
                                <td className="py-2 px-3">
                                  <input
                                    type="number"
                                    min="0"
                                    max={groupSize}
                                    value={inp.lowerCorrect}
                                    onChange={(e) => handleUpdateStudentInput(q.number, 'lowerCorrect', Number(e.target.value))}
                                    className="w-20 px-2 py-1 rounded border border-slate-300 font-bold text-center"
                                  />
                                </td>
                                <td className="py-2 px-3">
                                  <input
                                    type="number"
                                    min="0"
                                    max={totalStudents}
                                    value={inp.totalCorrect}
                                    onChange={(e) => handleUpdateStudentInput(q.number, 'totalCorrect', Number(e.target.value))}
                                    className="w-20 px-2 py-1 rounded border border-slate-300 font-bold text-center"
                                  />
                                </td>
                                <td className="py-2 px-3 text-center font-bold text-slate-900">
                                  {itemP}
                                </td>
                                <td className="py-2 px-3 text-center font-bold text-teal-800">
                                  {itemD}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('report')}
                      className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-xs transition flex items-center gap-2"
                    >
                      <span>Lihat Hasil Evaluasi Lengkap</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PANDUAN ARIKUNTO & PUSPENDIK */}
          {activeTab === 'guide' && (
            <div className="space-y-4 animate-in fade-in duration-150 text-xs">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <h3 className="font-bold text-sm text-slate-900">
                  Pedoman Baku Evaluasi Butir Soal (Prof. Dr. Suharsimi Arikunto)
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  Evaluasi kualitas instrumen asesmen madrasah bertujuan memastikan bahwa tes yang diujikan adil, valid, dan dapat membedakan siswa yang telah menguasai kompetensi dengan siswa yang masih membutuhkan remidial.
                </p>
              </div>

              {/* 1. Tabel Klasifikasi Tingkat Kesukaran (P) */}
              <div className="space-y-2">
                <h4 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />
                  <span>1. Klasifikasi Indeks Tingkat Kesukaran (P = B / N)</span>
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-100 font-bold text-slate-700">
                      <tr>
                        <th className="py-2 px-3">Rentang Nilai P</th>
                        <th className="py-2 px-3">Kategori</th>
                        <th className="py-2 px-3">Interpretasi Guru Madrasah</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="py-2 px-3 font-bold text-emerald-800">0.71 – 1.00</td>
                        <td className="py-2 px-3 font-semibold">Mudah</td>
                        <td className="py-2 px-3 text-slate-600">Sebagian besar siswa menjawab benar. Bagus untuk menumbuhkan motivasi pada butir awal.</td>
                      </tr>
                      <tr className="bg-emerald-50/30">
                        <td className="py-2 px-3 font-bold text-sky-800">0.30 – 0.70</td>
                        <td className="py-2 px-3 font-semibold">Sedang (Ideal)</td>
                        <td className="py-2 px-3 text-slate-600">Tingkat kesulitan paling ideal. Memberikan informasi paling optimal terhadap capaian belajar.</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-bold text-purple-800">0.00 – 0.29</td>
                        <td className="py-2 px-3 font-semibold">Sukar (HOTS)</td>
                        <td className="py-2 px-3 text-slate-600">Hanya sedikit siswa yang mampu menjawab. Efektif menguji daya nalar tingkat tinggi.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 2. Tabel Klasifikasi Daya Beda (D) */}
              <div className="space-y-2 pt-2">
                <h4 className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-600 inline-block" />
                  <span>2. Klasifikasi Indeks Daya Pembeda (D = Ba/Ja - Bb/Jb)</span>
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-100 font-bold text-slate-700">
                      <tr>
                        <th className="py-2 px-3">Rentang Nilai D</th>
                        <th className="py-2 px-3">Klasifikasi</th>
                        <th className="py-2 px-3">Tindakan Rekomendasi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr className="bg-teal-50/40">
                        <td className="py-2 px-3 font-bold text-teal-900">0.40 – 1.00</td>
                        <td className="py-2 px-3 font-bold text-teal-800">Sangat Baik</td>
                        <td className="py-2 px-3 text-slate-700">Butir soal sangat baik dan diterima langsung ke bank soal.</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-bold text-emerald-800">0.30 – 0.39</td>
                        <td className="py-2 px-3 font-bold text-emerald-700">Baik</td>
                        <td className="py-2 px-3 text-slate-700">Diterima tetapi mungkin memerlukan sedikit perbaikan redaksional.</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-bold text-amber-800">0.20 – 0.29</td>
                        <td className="py-2 px-3 font-bold text-amber-700">Cukup</td>
                        <td className="py-2 px-3 text-slate-700">Soal diperbaiki: periksa opsi pengecoh (distraktor) agar lebih efektif.</td>
                      </tr>
                      <tr className="bg-rose-50/30">
                        <td className="py-2 px-3 font-bold text-rose-800">&lt; 0.20</td>
                        <td className="py-2 px-3 font-bold text-rose-700">Jelek / Buruk</td>
                        <td className="py-2 px-3 text-slate-700">Soal dibuang atau diganti karena tidak mampu membedakan kemampuan siswa.</td>
                      </tr>
                      <tr className="bg-rose-100/50">
                        <td className="py-2 px-3 font-bold text-rose-900">&lt; 0.00 (Negatif)</td>
                        <td className="py-2 px-3 font-bold text-rose-800">Sangat Jelek</td>
                        <td className="py-2 px-3 text-rose-900 font-semibold">Kunci jawaban salah atau kalimat soal sangat membingungkan kelompok siswa pintar. Wajib direvisi total!</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0 text-xs">
          <div className="text-slate-500 font-medium">
            Instrumen evaluasi mandiri Kurikulum Merdeka Madrasah Ibtidaiyah (Kemenag RI)
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition shadow-xs"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
