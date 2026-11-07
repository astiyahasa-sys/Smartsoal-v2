import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  PlusCircle,
  Eye,
  Edit,
  Copy,
  Trash2,
  FolderArchive,
  Clock,
  BookOpen,
  School,
  X,
  FileText,
  FileDown,
  Loader2,
  KeyRound,
  BarChart2,
  Activity,
} from 'lucide-react';
import { ActiveView, Grade, QuestionPackage, SchoolProfile } from '../../types';
import { ItemAnalysisModal } from './ItemAnalysisModal';
import { WordExportModal } from './WordExportModal';
import {
  formatIndonesianDate,
  calculateTotalQuestions,
  MI_SUBJECTS,
} from '../../utils/curriculum';
import {
  downloadWordPackage,
  downloadPdfPackage,
} from '../../services/exportService';

interface BankSoalViewProps {
  packages: QuestionPackage[];
  schoolProfile?: SchoolProfile | null;
  onNavigate: (view: ActiveView) => void;
  onOpenPackage: (pkg: QuestionPackage) => void;
  onOpenKunciJawaban?: (pkg: QuestionPackage) => void;
  onEditPackage: (pkg: QuestionPackage) => void;
  onDuplicatePackage: (id: string) => void;
  onDeletePackageRequest: (pkg: QuestionPackage) => void;
}

export const BankSoalView: React.FC<BankSoalViewProps> = ({
  packages,
  schoolProfile,
  onNavigate,
  onOpenPackage,
  onOpenKunciJawaban,
  onEditPackage,
  onDuplicatePackage,
  onDeletePackageRequest,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [downloadingPkg, setDownloadingPkg] = useState<{ id: string; type: 'word' | 'pdf' } | null>(null);
  const [selectedAnalysisPkg, setSelectedAnalysisPkg] = useState<QuestionPackage | null>(null);
  const [selectedWordPkg, setSelectedWordPkg] = useState<QuestionPackage | null>(null);

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

  // Filter & Search logic
  const filteredPackages = useMemo(() => {
    return packages.filter((pkg) => {
      // Search matching title, subject, topic, school
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        pkg.title.toLowerCase().includes(q) ||
        pkg.subject.toLowerCase().includes(q) ||
        pkg.topic.toLowerCase().includes(q) ||
        pkg.schoolName.toLowerCase().includes(q);

      // Grade matching
      const matchesGrade =
        selectedGrade === 'all' || pkg.grade.toString() === selectedGrade;

      // Status matching
      const matchesStatus =
        selectedStatus === 'all' || pkg.status === selectedStatus;

      // Subject matching
      const matchesSubject =
        selectedSubject === 'all' || pkg.subject === selectedSubject;

      return matchesSearch && matchesGrade && matchesStatus && matchesSubject;
    });
  }, [packages, searchQuery, selectedGrade, selectedStatus, selectedSubject]);

  const hasActiveFilters =
    searchQuery !== '' ||
    selectedGrade !== 'all' ||
    selectedStatus !== 'all' ||
    selectedSubject !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedGrade('all');
    setSelectedStatus('all');
    setSelectedSubject('all');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <FolderArchive className="w-7 h-7 text-teal-700" />
            <span>Bank Soal Madrasah Ibtidaiyah</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Koleksi seluruh draf dan paket soal asesmen yang tersimpan di peramban ini.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('create-package')}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-xs transition"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Buat Paket Baru</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Search input */}
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari berdasarkan judul, mata pelajaran, materi pokok..."
              className="w-full pl-10 pr-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                aria-label="Bersihkan pencarian"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter Kelas */}
          <div>
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="all">Semua Kelas MI (1 - 6)</option>
              {([1, 2, 3, 4, 5, 6] as Grade[]).map((g) => (
                <option key={g} value={g.toString()}>
                  Kelas {g} (Fase {g <= 2 ? 'A' : g <= 4 ? 'B' : 'C'})
                </option>
              ))}
            </select>
          </div>

          {/* Filter Status */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="all">Semua Status Draf</option>
              <option value="draft">Draf Rancangan</option>
              <option value="completed">Selesai / Siap Cetak</option>
            </select>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
            <span>
              Menemukan <strong>{filteredPackages.length}</strong> dari{' '}
              <strong>{packages.length}</strong> paket soal
            </span>
            <button
              type="button"
              onClick={clearFilters}
              className="text-teal-700 hover:text-teal-900 font-semibold underline"
            >
              Reset Filter
            </button>
          </div>
        )}
      </div>

      {/* Package List or Empty State */}
      {packages.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-teal-50 text-teal-700 mx-auto flex items-center justify-center">
            <FolderArchive className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base font-bold text-slate-800">
              Bank Soal Masih Kosong
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Anda belum memiliki naskah atau paket asesmen yang tersimpan. Klik tombol di
              bawah untuk membuat paket soal asesmen pertama Anda.
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
      ) : filteredPackages.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-3">
          <p className="text-sm font-semibold text-slate-700">
            Tidak ada paket soal yang cocok dengan filter pencarian Anda.
          </p>
          <button
            type="button"
            onClick={clearFilters}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
          >
            Hapus Kriteria Pencarian
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPackages.map((pkg) => {
            const total = calculateTotalQuestions(
              pkg.multipleChoiceCount,
              pkg.shortAnswerCount,
              pkg.essayCount,
              pkg.complexMultipleChoiceCount
            );

            return (
              <div
                key={pkg.id}
                className="bg-white rounded-2xl border border-slate-200 hover:border-teal-400/60 hover:shadow-md transition flex flex-col justify-between overflow-hidden group"
              >
                <div className="p-5 space-y-3">
                  {/* Badges */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-100 text-teal-800">
                      {pkg.subject}
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

                  {/* Title */}
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-teal-700 transition line-clamp-2">
                    {pkg.title}
                  </h3>

                  {/* Meta Tags */}
                  <div className="space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 font-semibold text-slate-700 text-[11px]">
                        Kelas {pkg.grade} • {pkg.phase}
                      </span>
                      <span className="text-slate-400">•</span>
                      <span className="text-slate-500 text-[11px] truncate">
                        {pkg.assessmentType}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 line-clamp-1">
                      Materi: <strong className="text-slate-700">{pkg.topic}</strong>
                    </p>

                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-[11px] flex items-center justify-between">
                      <span className="font-semibold text-slate-700">
                        Total {total} Soal
                      </span>
                      <span className="text-slate-500">
                        PG: {pkg.multipleChoiceCount} | PG-K: {pkg.complexMultipleChoiceCount || 0} | Isian: {pkg.shortAnswerCount} | Ur: {pkg.essayCount}
                      </span>
                    </div>

                    {/* Analisis Statistik Soal (Tingkat Kesukaran P & Daya Beda D) */}
                    <div className="p-2.5 rounded-xl bg-teal-50/70 border border-teal-100 flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5 font-semibold text-teal-950">
                        <BarChart2 className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                        <span>Statistik Soal:</span>
                        <span className="text-teal-800 font-bold">P & D Teranalisis</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAnalysisPkg(pkg);
                        }}
                        className="font-bold text-teal-700 hover:text-teal-900 underline flex items-center gap-0.5"
                        title="Evaluasi Tingkat Kesukaran & Daya Beda Soal Mandiri"
                      >
                        <span>Evaluasi</span>
                        <span>→</span>
                      </button>
                    </div>
                  </div>

                  {/* Timestamp & Author */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="truncate max-w-[130px]">{pkg.teacherName || 'Guru MI'}</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatIndonesianDate(pkg.updatedAt || pkg.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="p-2.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-1.5">
                  <button
                    type="button"
                    onClick={() => onOpenPackage(pkg)}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-white border border-slate-200 hover:border-slate-300 text-slate-700 hover:text-teal-700 text-xs font-semibold flex items-center justify-center gap-1 shadow-2xs transition"
                    title="Buka Pratinjau Dokumen Naskah"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Buka</span>
                  </button>

                  {/* Kunci Jawaban Terpisah */}
                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenKunciJawaban) {
                        onOpenKunciJawaban(pkg);
                      } else {
                        onNavigate('kunci-jawaban');
                      }
                    }}
                    className="py-1.5 px-2 rounded-lg bg-amber-50 border border-amber-200 hover:bg-amber-100 text-amber-900 text-xs font-semibold flex items-center justify-center gap-1 shadow-2xs transition"
                    title="Kelola & Cetak Lembar Kunci Jawaban & Pembahasan Terpisah"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-amber-700" />
                    <span>Kunci</span>
                  </button>

                  {/* Analisis Statistik Soal (P & D) */}
                  <button
                    type="button"
                    onClick={() => setSelectedAnalysisPkg(pkg)}
                    className="py-1.5 px-2 rounded-lg bg-teal-50 border border-teal-200 hover:bg-teal-100 text-teal-900 text-xs font-semibold flex items-center justify-center gap-1 shadow-2xs transition"
                    title="Buka Analisis Statistik Soal (Tingkat Kesukaran & Daya Beda)"
                  >
                    <BarChart2 className="w-3.5 h-3.5 text-teal-700" />
                    <span>Statistik</span>
                  </button>

                  {/* Unduh Word */}
                  <button
                    type="button"
                    onClick={() => setSelectedWordPkg(pkg)}
                    className="py-1.5 px-2 rounded-lg bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-800 text-xs font-semibold flex items-center justify-center gap-1 shadow-2xs transition"
                    title="Unduh Paket Soal & Kunci format Word (.docx) dengan Kop Madrasah"
                  >
                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                    <span>Word</span>
                  </button>

                  {/* Unduh PDF */}
                  <button
                    type="button"
                    onClick={() => handleQuickDownload(pkg, 'pdf')}
                    disabled={downloadingPkg?.id === pkg.id}
                    className="py-1.5 px-2 rounded-lg bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-800 text-xs font-semibold flex items-center justify-center gap-1 shadow-2xs transition disabled:opacity-50"
                    title="Unduh Naskah PDF (.pdf)"
                  >
                    {downloadingPkg?.id === pkg.id && downloadingPkg.type === 'pdf' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600" />
                    ) : (
                      <FileDown className="w-3.5 h-3.5 text-rose-600" />
                    )}
                    <span>PDF</span>
                  </button>

                  <div className="flex items-center gap-0.5 border-l border-slate-200 pl-1">
                    <button
                      type="button"
                      onClick={() => onEditPackage(pkg)}
                      className="p-1.5 rounded-lg hover:bg-white text-slate-500 hover:text-sky-700 transition"
                      title="Edit Paket"
                      aria-label={`Edit ${pkg.title}`}
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onDuplicatePackage(pkg.id)}
                      className="p-1.5 rounded-lg hover:bg-white text-slate-500 hover:text-slate-900 transition"
                      title="Duplikasi Paket"
                      aria-label={`Duplikasi ${pkg.title}`}
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeletePackageRequest(pkg)}
                      className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition"
                      title="Hapus Paket"
                      aria-label={`Hapus ${pkg.title}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Analisis Statistik Soal (Tingkat Kesukaran & Daya Beda) */}
      {selectedAnalysisPkg && (
        <ItemAnalysisModal
          isOpen={!!selectedAnalysisPkg}
          onClose={() => setSelectedAnalysisPkg(null)}
          pkg={selectedAnalysisPkg}
          schoolProfile={schoolProfile}
        />
      )}

      {/* Modal Unduh Word (.docx) dengan Kop Madrasah & Pilihan Paket Lengkap */}
      {selectedWordPkg && (
        <WordExportModal
          isOpen={!!selectedWordPkg}
          onClose={() => setSelectedWordPkg(null)}
          pkg={selectedWordPkg}
          schoolProfile={schoolProfile}
        />
      )}
    </div>
  );
};
