import React, { useState, useMemo } from 'react';
import {
  Save,
  ArrowLeft,
  Eye,
  Table2,
  Trash2,
  ArrowUp,
  ArrowDown,
  PlusCircle,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  HelpCircle,
  BookOpen,
  Edit3,
  Award,
  Layers,
  Image as ImageIcon,
  Upload,
  Loader2,
  AlertCircle,
  RefreshCw,
  X,
  Info,
  Copy,
  Check,
  ExternalLink,
  KeyRound,
  BarChart3,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  ActiveView,
  CognitiveLevel,
  QuestionItem,
  QuestionPackage,
  QuestionType,
  RubricItem,
} from '../../types';
import {
  analyzePackageDifficulty,
  getQuestionDifficulty,
  getDifficultyBadge,
  NormalizedDifficulty,
} from '../../utils/difficultyAnalysis';
import { compressImageFile } from '../../utils/imageCompression';
import { extractErrorMessage } from '../../utils/errorParser';
import {
  autoNumberQuestions,
  sortQuestionsByAssessmentSections,
} from '../../utils/curriculum';
import { buildManualImagePrompt } from '../../utils/imagePromptBuilder';
import { ConfirmModal } from '../common/ConfirmModal';
import { ManualImagePromptModal } from './ManualImagePromptModal';
import { BatchImagePromptsModal } from './BatchImagePromptsModal';

interface QuestionEditorViewProps {
  packageData: QuestionPackage;
  onSavePackage: (pkg: QuestionPackage) => void;
  onNavigate: (view: ActiveView) => void;
  onOpenPreview: (pkg: QuestionPackage) => void;
  onOpenKisiKisi: (pkg: QuestionPackage) => void;
  onOpenKunciJawaban?: (pkg: QuestionPackage) => void;
  onRegenerateRequest: () => void;
}

export const QuestionEditorView: React.FC<QuestionEditorViewProps> = ({
  packageData,
  onSavePackage,
  onNavigate,
  onOpenPreview,
  onOpenKisiKisi,
  onOpenKunciJawaban,
  onRegenerateRequest,
}) => {
  const [questions, setQuestions] = useState<QuestionItem[]>(() =>
    autoNumberQuestions(packageData.questions || [])
  );
  const [isDirty, setIsDirty] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'multiple_choice' | 'complex_multiple_choice' | 'short_answer' | 'essay'>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | 'Mudah' | 'Sedang' | 'Sulit'>('all');
  const [showDifficultySection, setShowDifficultySection] = useState(true);
  const [generatingImageIndex, setGeneratingImageIndex] = useState<number | null>(null);
  const [imageErrorState, setImageErrorState] = useState<{ index: number; message: string } | null>(null);
  const [dismissBillingNotice, setDismissBillingNotice] = useState(false);
  const [deleteTargetIndex, setDeleteTargetIndex] = useState<number | null>(null);
  const [selectedPromptModalIndex, setSelectedPromptModalIndex] = useState<number | null>(null);
  const [showBatchPromptModal, setShowBatchPromptModal] = useState(false);
  const [copiedPromptIndex, setCopiedPromptIndex] = useState<number | null>(null);

  // Analisis statistik sebaran tingkat kesulitan terkini
  const difficultyAnalysis = useMemo(
    () => analyzePackageDifficulty({ ...packageData, questions }),
    [packageData, questions]
  );

  // Mengubah tingkat kesulitan butir soal secara cepat
  const handleUpdateDifficulty = (actualIndex: number, newDiff: NormalizedDifficulty) => {
    const badge = getDifficultyBadge(newDiff);
    handleUpdateQuestion(actualIndex, {
      cognitiveLevel: badge.cognitiveLevelDefault as CognitiveLevel,
    });
  };

  // Menyalin prompt gambar secara cepat langsung dari kartu butir soal
  const handleCopyInlinePrompt = async (qIndex: number) => {
    const targetQ = questions[qIndex];
    if (!targetQ) return;
    const promptInfo = buildManualImagePrompt(targetQ, {
      subject: packageData.subject,
      grade: packageData.grade,
      phase: packageData.phase,
      topic: targetQ.topic || packageData.topic,
    });

    try {
      await navigator.clipboard.writeText(promptInfo.indonesianPrompt);
      setCopiedPromptIndex(qIndex);
      setTimeout(() => setCopiedPromptIndex(null), 2000);
    } catch {}
  };

  // Unggah & kompresi gambar lokal
  const handleUploadImage = async (qIndex: number, file: File) => {
    setImageErrorState(null);
    try {
      const result = await compressImageFile(file, { maxWidth: 800, maxHeight: 800, quality: 0.82 });
      setQuestions((prev) => {
        const next = [...prev];
        const currentQ = next[qIndex];
        next[qIndex] = {
          ...currentQ,
          imageUrl: result.dataUrl,
          imageAlt: currentQ.imageAlt || file.name,
          imageCaption: currentQ.imageCaption || `Gambar Soal Nomor ${currentQ.number}`,
          imagePosition: currentQ.imagePosition || packageData.defaultImagePosition || 'below_question',
          imageAiStatus: undefined,
        };
        return next;
      });
      setIsDirty(true);
    } catch (err: any) {
      setImageErrorState({ index: qIndex, message: err?.message || 'Gagal memproses gambar.' });
    }
  };

  // Generate gambar AI untuk butir soal ini
  const handleGenerateAiImage = async (qIndex: number, promptText?: string) => {
    setImageErrorState(null);
    const targetQ = questions[qIndex];
    const prompt = promptText || targetQ.imageAlt || `${targetQ.questionText} materi ${packageData.subject} ${packageData.topic}`;

    setGeneratingImageIndex(qIndex);
    try {
      const response = await fetch('/api/generate-question-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, questionNumber: targetQ.number }),
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok && data.success && data.imageUrl) {
        setQuestions((prev) => {
          const next = [...prev];
          next[qIndex] = {
            ...next[qIndex],
            imageUrl: data.imageUrl,
            imageCaption: next[qIndex].imageCaption || `Gambar Soal Nomor ${next[qIndex].number}`,
            imageAiStatus: { status: 'success', message: 'Gambar berhasil dibuat.' },
          };
          return next;
        });
        setIsDirty(true);
      } else {
        const errMsg = extractErrorMessage(data.error || data.message || data);
        setImageErrorState({ index: qIndex, message: errMsg });
        setQuestions((prev) => {
          const next = [...prev];
          next[qIndex] = {
            ...next[qIndex],
            imageAiStatus: { status: data.status || 'error', message: errMsg },
          };
          return next;
        });
      }
    } catch (err: any) {
      const errMsg = extractErrorMessage(err);
      setImageErrorState({ index: qIndex, message: errMsg });
    } finally {
      setGeneratingImageIndex(null);
    }
  };

  // Hapus gambar dari butir soal
  const handleRemoveImage = (qIndex: number) => {
    setQuestions((prev) => {
      const next = [...prev];
      next[qIndex] = {
        ...next[qIndex],
        imageUrl: undefined,
        imageCaption: undefined,
        imageAiStatus: undefined,
      };
      return next;
    });
    setIsDirty(true);
  };

  // Perbarui satu pertanyaan
  const handleUpdateQuestion = (index: number, updated: Partial<QuestionItem>) => {
    setQuestions((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updated };
      return next;
    });
    setIsDirty(true);
  };

  // Perbarui opsi pilihan ganda
  const handleUpdateOption = (qIndex: number, optKey: string, newText: string) => {
    setQuestions((prev) => {
      const next = [...prev];
      const currentOpts = next[qIndex].options || [];
      const updatedOpts = currentOpts.map((opt) =>
        opt.key === optKey ? { ...opt, text: newText } : opt
      );
      next[qIndex] = { ...next[qIndex], options: updatedOpts };
      return next;
    });
    setIsDirty(true);
  };

  // Hapus butir soal (membuka dialog konfirmasi aman tanpa window.confirm)
  const handleDeleteQuestion = (index: number) => {
    setDeleteTargetIndex(index);
  };

  const confirmDeleteQuestion = () => {
    if (deleteTargetIndex === null) return;
    setQuestions((prev) => {
      const next = prev.filter((_, i) => i !== deleteTargetIndex);
      return autoNumberQuestions(next);
    });
    setIsDirty(true);
    setDeleteTargetIndex(null);
  };

  // Pindahkan urutan soal ke atas (dengan penomoran otomatis berkesinambungan)
  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    setQuestions((prev) => {
      const next = [...prev];
      const temp = next[index - 1];
      next[index - 1] = next[index];
      next[index] = temp;
      return autoNumberQuestions(next);
    });
    setIsDirty(true);
  };

  // Pindahkan urutan soal ke bawah (dengan penomoran otomatis berkesinambungan)
  const handleMoveDown = (index: number) => {
    if (index >= questions.length - 1) return;
    setQuestions((prev) => {
      const next = [...prev];
      const temp = next[index + 1];
      next[index + 1] = next[index];
      next[index] = temp;
      return autoNumberQuestions(next);
    });
    setIsDirty(true);
  };

  // Rapikan seluruh soal sesuai urutan standar asesmen (PG -> PGK -> Isian -> Uraian) dan nomor kontinu 1..N
  const handleSortByStandardSections = () => {
    setQuestions((prev) => sortQuestionsByAssessmentSections(prev));
    setIsDirty(true);
  };

  // Tambah butir soal manual baru dengan penomoran otomatis
  const handleAddQuestion = (type: QuestionType) => {
    const isChoice = type === 'multiple_choice' || type === 'complex_multiple_choice';
    const is3Options = packageData.mcOptionCount === 3;

    const defaultOptions = is3Options
      ? [
          { key: 'A', text: '' },
          { key: 'B', text: '' },
          { key: 'C', text: '' },
        ]
      : [
          { key: 'A', text: '' },
          { key: 'B', text: '' },
          { key: 'C', text: '' },
          { key: 'D', text: '' },
        ];

    const tempId = `q_${Date.now()}_${questions.length + 1}`;

    const newQuestion: QuestionItem = {
      id: tempId,
      number: questions.length + 1,
      type,
      questionText: type === 'complex_multiple_choice' ? '(Pilihlah 2 jawaban yang benar!) ' : '',
      options: isChoice ? defaultOptions : undefined,
      answerKey:
        type === 'multiple_choice'
          ? 'A'
          : type === 'complex_multiple_choice'
          ? 'A, B'
          : '',
      acceptedAnswers: type === 'short_answer' ? [''] : undefined,
      explanation: '',
      score:
        type === 'multiple_choice'
          ? 1
          : type === 'complex_multiple_choice'
          ? 2
          : type === 'short_answer'
          ? 2
          : 5,
      indicator: `Peserta didik dapat menyelesaikan soal materi ${packageData.topic}`,
      cognitiveLevel: type === 'complex_multiple_choice' ? 'L2 (Menerapkan)' : 'L1 (Mengingat/Memahami)',
      rubric:
        type === 'essay'
          ? [
              { criteria: 'Jawaban lengkap dan tepat', score: 3 },
              { criteria: 'Jawaban kurang lengkap', score: 2 },
            ]
          : undefined,
    };

    setQuestions((prev) => {
      // Sisipkan setelah soal terakhir bertipe sama agar bagian naskah tetap teratur
      let insertIdx = -1;
      for (let i = prev.length - 1; i >= 0; i--) {
        if (prev[i].type === type) {
          insertIdx = i + 1;
          break;
        }
      }
      const next = [...prev];
      if (insertIdx !== -1) {
        next.splice(insertIdx, 0, newQuestion);
      } else {
        next.push(newQuestion);
      }
      return autoNumberQuestions(next);
    });
    setIsDirty(true);
  };

  // Simpan perubahan ke Local Storage
  const handleSave = () => {
    const renumberedQuestions = autoNumberQuestions(questions);
    const mcCount = renumberedQuestions.filter((q) => q.type === 'multiple_choice').length;
    const cmcCount = renumberedQuestions.filter((q) => q.type === 'complex_multiple_choice').length;
    const saCount = renumberedQuestions.filter((q) => q.type === 'short_answer').length;
    const esCount = renumberedQuestions.filter((q) => q.type === 'essay').length;

    const updatedPackage: QuestionPackage = {
      ...packageData,
      multipleChoiceCount: mcCount,
      complexMultipleChoiceCount: cmcCount,
      shortAnswerCount: saCount,
      essayCount: esCount,
      questions: renumberedQuestions,
      status: 'completed',
      updatedAt: new Date().toISOString(),
    };

    onSavePackage(updatedPackage);
    setQuestions(renumberedQuestions);
    setIsDirty(false);
  };

  // Filter butir soal berdasarkan bentuk soal dan tingkat kesulitan
  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      const matchesType = activeTab === 'all' || q.type === activeTab;
      const qDiff = getQuestionDifficulty(q);
      const matchesDiff = difficultyFilter === 'all' || qDiff === difficultyFilter;
      return matchesType && matchesDiff;
    });
  }, [questions, activeTab, difficultyFilter]);

  const totalScore = questions.reduce((sum, q) => sum + (q.score || 0), 0);

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-150">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <button
            type="button"
            onClick={() => onNavigate('create-package')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-2 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Formulir Paket</span>
          </button>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Review & Editor Butir Soal
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-800 border border-teal-200">
              {questions.length} Butir Soal
            </span>
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200"
              title="Nomor butir soal terupdate secara otomatis saat soal dihapus, ditambah, atau digeser"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Penomoran Otomatis Aktif</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {packageData.title} • {packageData.subject} Kelas {packageData.grade} ({packageData.phase})
          </p>
        </div>

        {/* Action Header Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onRegenerateRequest}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
            title="Generate ulang seluruh soal dengan Gemini AI"
          >
            <RotateCcw className="w-4 h-4 text-slate-500" />
            <span>Generate Ulang AI</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenKisiKisi({ ...packageData, questions })}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-teal-300 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-semibold transition"
          >
            <Table2 className="w-4 h-4 text-teal-700" />
            <span>Matriks Kisi-kisi</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const updatedPkg = { ...packageData, questions };
              if (onOpenKunciJawaban) {
                onOpenKunciJawaban(updatedPkg);
              } else {
                onNavigate('kunci-jawaban');
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-semibold transition"
            title="Kelola dan cetak lembar kunci jawaban & pedoman penskoran terpisah"
          >
            <KeyRound className="w-4 h-4 text-amber-700" />
            <span>Kunci Jawaban</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenPreview({ ...packageData, questions })}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition"
          >
            <Eye className="w-4 h-4 text-sky-600" />
            <span>Pratinjau Dokumen</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold shadow-xs transition"
          >
            <Save className="w-4 h-4" />
            <span>Simpan Perubahan</span>
          </button>
        </div>
      </div>

      {/* Info Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-slate-900 text-white text-xs shadow-md">
        <div className="flex flex-wrap items-center gap-4">
          <span className="font-semibold text-slate-300">
            Total Butir: <strong className="text-teal-400">{questions.length}</strong>
          </span>
          <span className="text-slate-500">|</span>
          <span>
            PG:{' '}
            <strong className="text-white">
              {questions.filter((q) => q.type === 'multiple_choice').length}
            </strong>
          </span>
          <span>
            Isian:{' '}
            <strong className="text-white">
              {questions.filter((q) => q.type === 'short_answer').length}
            </strong>
          </span>
          <span>
            Uraian:{' '}
            <strong className="text-white">
              {questions.filter((q) => q.type === 'essay').length}
            </strong>
          </span>
          <span className="text-slate-500">|</span>
          <span>
            Akumulasi Skor Maksimal: <strong className="text-amber-400">{totalScore}</strong>
          </span>
        </div>

        {isDirty && (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
            Ada perubahan manual belum disimpan
          </span>
        )}
      </div>

      {/* RINGKASAN DISTRIBUSI TINGKAT KESULITAN (MUDAH, SEDANG, SUKAR) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4 transition">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center shrink-0 shadow-2xs">
              <BarChart3 className="w-5 h-5 text-teal-700" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">
                  Ringkasan Distribusi Tingkat Kesulitan
                </h2>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${difficultyAnalysis.balanceStatus.badgeClass}`}>
                  {difficultyAnalysis.balanceStatus.label.split('(')[0].trim()}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Sebaran {difficultyAnalysis.totalQuestions} Butir Soal • Rasio:{' '}
                <strong className="text-slate-800">{difficultyAnalysis.ratioString}</strong> (Mudah : Sedang : Sukar)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700">
              <span>Rasio:</span>
              <strong className="text-slate-900">{difficultyAnalysis.ratioString}</strong>
            </div>
            <button
              type="button"
              onClick={() => setShowDifficultySection(!showDifficultySection)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs shadow-2xs transition"
            >
              <span>{showDifficultySection ? 'Sembunyikan' : 'Lihat Ringkasan'}</span>
              {showDifficultySection ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {showDifficultySection && (
          <div className="space-y-4 pt-1 animate-in fade-in duration-200">
            {/* Visual Multi-Segment Bar */}
            <div className="space-y-1.5">
              <div className="h-3.5 w-full bg-slate-100 rounded-full overflow-hidden flex p-0.5 border border-slate-200">
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
                    title={`Sukar / HOTS: ${difficultyAnalysis.sulit.count} butir (${difficultyAnalysis.sulit.percentage}%)`}
                  />
                )}
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 px-0.5">
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                  Mudah: <strong>{difficultyAnalysis.mudah.count}</strong> ({difficultyAnalysis.mudah.percentage}%)
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block" />
                  Sedang: <strong>{difficultyAnalysis.sedang.count}</strong> ({difficultyAnalysis.sedang.percentage}%)
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-600 inline-block" />
                  Sukar / HOTS: <strong>{difficultyAnalysis.sulit.count}</strong> ({difficultyAnalysis.sulit.percentage}%)
                </span>
              </div>
            </div>

            {/* 3 Metric Cards: Mudah, Sedang, Sukar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* 1. MUDAH */}
              <div
                onClick={() => setDifficultyFilter(difficultyFilter === 'Mudah' ? 'all' : 'Mudah')}
                className={`p-3.5 rounded-xl border transition cursor-pointer ${
                  difficultyFilter === 'Mudah'
                    ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/30'
                    : 'border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50'
                }`}
                title="Klik untuk memfilter soal Mudah"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-900">
                    <span className="w-2 h-2 rounded-full bg-emerald-600" />
                    <span>Mudah (L1)</span>
                  </div>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                    {difficultyAnalysis.mudah.percentage}%
                  </span>
                </div>

                <div className="flex items-baseline gap-1.5 my-1.5">
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
                <p className="text-[10px] text-emerald-700 font-semibold mt-1">
                  {difficultyFilter === 'Mudah' ? '✓ Sedang difilter (Klik untuk reset)' : 'Klik untuk filter butir Mudah'}
                </p>
              </div>

              {/* 2. SEDANG */}
              <div
                onClick={() => setDifficultyFilter(difficultyFilter === 'Sedang' ? 'all' : 'Sedang')}
                className={`p-3.5 rounded-xl border transition cursor-pointer ${
                  difficultyFilter === 'Sedang'
                    ? 'border-sky-500 bg-sky-50 ring-2 ring-sky-500/30'
                    : 'border-sky-200 bg-sky-50/50 hover:bg-sky-50'
                }`}
                title="Klik untuk memfilter soal Sedang"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-sky-900">
                    <span className="w-2 h-2 rounded-full bg-sky-600" />
                    <span>Sedang (L2)</span>
                  </div>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-300">
                    {difficultyAnalysis.sedang.percentage}%
                  </span>
                </div>

                <div className="flex items-baseline gap-1.5 my-1.5">
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
                <p className="text-[10px] text-sky-700 font-semibold mt-1">
                  {difficultyFilter === 'Sedang' ? '✓ Sedang difilter (Klik untuk reset)' : 'Klik untuk filter butir Sedang'}
                </p>
              </div>

              {/* 3. SUKAR / HOTS */}
              <div
                onClick={() => setDifficultyFilter(difficultyFilter === 'Sulit' ? 'all' : 'Sulit')}
                className={`p-3.5 rounded-xl border transition cursor-pointer ${
                  difficultyFilter === 'Sulit'
                    ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-500/30'
                    : 'border-purple-200 bg-purple-50/50 hover:bg-purple-50'
                }`}
                title="Klik untuk memfilter soal Sukar"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-purple-900">
                    <span className="w-2 h-2 rounded-full bg-purple-600" />
                    <span>Sukar / HOTS (L3)</span>
                  </div>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-300">
                    {difficultyAnalysis.sulit.percentage}%
                  </span>
                </div>

                <div className="flex items-baseline gap-1.5 my-1.5">
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
                <p className="text-[10px] text-purple-700 font-semibold mt-1">
                  {difficultyFilter === 'Sulit' ? '✓ Sedang difilter (Klik untuk reset)' : 'Klik untuk filter butir Sukar'}
                </p>
              </div>
            </div>

            {/* Target Standar Kurikulum Merdeka */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2.5 text-xs text-slate-700">
              <Info className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-900">{difficultyAnalysis.balanceStatus.label}:</strong>
                <span className="text-slate-600 ml-1">{difficultyAnalysis.balanceStatus.description}</span>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Billing Guidance & Manual Prompt Banner */}
      {!dismissBillingNotice && questions.some((q) => q.imageAiStatus?.status === 'quota_exceeded' || q.imageAiStatus?.status === 'unavailable' || (!q.imageUrl && q.imageAlt)) && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs flex items-start justify-between gap-3 shadow-2xs">
          <div className="flex items-start gap-2.5">
            <Info className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <div>
                <strong className="text-sm font-bold text-amber-900 block">
                  Pemberitahuan Gambar Stimulus & Prompt AI Manual:
                </strong>
                <p className="leading-relaxed mt-0.5">
                  Layanan pembuatan gambar Google AI memerlukan API Key dengan penagihan aktif (Pay-as-you-go). Seluruh naskah soal teks, kunci jawaban, dan kisi-kisi Kurikulum Merdeka telah <strong>berhasil disusun 100%</strong>. Anda dapat membuat gambar secara gratis menggunakan prompt AI yang telah kami sediakan untuk tiap soal di Gemini, Bing Image Creator, atau Canva, lalu mengunggahnya secara mandiri.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowBatchPromptModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs shadow-2xs transition cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Lihat & Salin Seluruh Prompt Gambar Paket</span>
                </button>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDismissBillingNotice(true)}
            className="text-amber-700 hover:text-amber-900 font-bold p-1 shrink-0"
            title="Tutup pemberitahuan"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filter Tabs & Add Question Dropdown */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-200/70 text-xs font-semibold text-slate-700">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeTab === 'all' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'hover:text-slate-900'
              }`}
            >
              Semua ({questions.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('multiple_choice')}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeTab === 'multiple_choice' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'hover:text-slate-900'
              }`}
            >
              PG Biasa ({questions.filter((q) => q.type === 'multiple_choice').length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('complex_multiple_choice')}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeTab === 'complex_multiple_choice' ? 'bg-white text-indigo-950 font-bold shadow-2xs' : 'hover:text-indigo-900'
              }`}
            >
              PG Kompleks ({questions.filter((q) => q.type === 'complex_multiple_choice').length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('short_answer')}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeTab === 'short_answer' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'hover:text-slate-900'
              }`}
            >
              Isian ({questions.filter((q) => q.type === 'short_answer').length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('essay')}
              className={`px-3 py-1.5 rounded-lg transition ${
                activeTab === 'essay' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'hover:text-slate-900'
              }`}
            >
              Uraian ({questions.filter((q) => q.type === 'essay').length})
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSortByStandardSections}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-teal-300 bg-teal-50/70 hover:bg-teal-100 text-teal-800 text-xs font-semibold shadow-2xs transition"
              title="Susun ulang urutan butir soal sesuai tata urutan bagian asesmen standar (PG -> PG Kompleks -> Isian -> Uraian) dan perbarui nomor 1..N secara otomatis"
            >
              <Layers className="w-3.5 h-3.5 text-teal-700" />
              <span>Rapikan Nomor Standar</span>
            </button>
            <button
              type="button"
              onClick={() => handleAddQuestion('multiple_choice')}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition"
            >
              <PlusCircle className="w-3.5 h-3.5 text-teal-600" />
              <span>+ PG Biasa</span>
            </button>
            <button
              type="button"
              onClick={() => handleAddQuestion('complex_multiple_choice')}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-indigo-300 bg-indigo-50/60 hover:bg-indigo-100 text-indigo-900 text-xs font-bold shadow-2xs transition"
            >
              <PlusCircle className="w-3.5 h-3.5 text-indigo-700" />
              <span>+ PG Kompleks</span>
            </button>
            <button
              type="button"
              onClick={() => handleAddQuestion('short_answer')}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition"
            >
              <PlusCircle className="w-3.5 h-3.5 text-teal-600" />
              <span>+ Isian</span>
            </button>
            <button
              type="button"
              onClick={() => handleAddQuestion('essay')}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition"
            >
              <PlusCircle className="w-3.5 h-3.5 text-teal-600" />
              <span>+ Uraian</span>
            </button>
          </div>
        </div>

        {/* Filter Tingkat Kesulitan Cepat */}
        <div className="flex flex-wrap items-center gap-2 p-2 rounded-xl bg-slate-100 border border-slate-200 text-xs">
          <span className="font-bold text-slate-700 text-[11px] uppercase tracking-wider pl-1">
            Filter Kesulitan:
          </span>
          <button
            type="button"
            onClick={() => setDifficultyFilter('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
              difficultyFilter === 'all'
                ? 'bg-slate-900 text-white shadow-2xs font-bold'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Semua Tingkat ({questions.length})
          </button>
          <button
            type="button"
            onClick={() => setDifficultyFilter('Mudah')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              difficultyFilter === 'Mudah'
                ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${difficultyFilter === 'Mudah' ? 'bg-white' : 'bg-emerald-500'}`} />
            <span>Mudah ({difficultyAnalysis.mudah.count})</span>
          </button>
          <button
            type="button"
            onClick={() => setDifficultyFilter('Sedang')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              difficultyFilter === 'Sedang'
                ? 'bg-sky-600 text-white shadow-2xs font-bold'
                : 'bg-sky-50 text-sky-800 border border-sky-200 hover:bg-sky-100'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${difficultyFilter === 'Sedang' ? 'bg-white' : 'bg-sky-500'}`} />
            <span>Sedang ({difficultyAnalysis.sedang.count})</span>
          </button>
          <button
            type="button"
            onClick={() => setDifficultyFilter('Sulit')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              difficultyFilter === 'Sulit'
                ? 'bg-purple-600 text-white shadow-2xs font-bold'
                : 'bg-purple-50 text-purple-900 border border-purple-200 hover:bg-purple-100'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${difficultyFilter === 'Sulit' ? 'bg-white' : 'bg-purple-600'}`} />
            <span>Sukar / HOTS ({difficultyAnalysis.sulit.count})</span>
          </button>

          {difficultyFilter !== 'all' && (
            <button
              type="button"
              onClick={() => setDifficultyFilter('all')}
              className="text-[11px] text-slate-500 hover:text-slate-800 underline ml-auto pr-1"
            >
              Reset Filter
            </button>
          )}
      </div>
    </div>

      {/* Question Cards List */}
      <div className="space-y-5">
        {filteredQuestions.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 space-y-2">
            <BookOpen className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-sm font-semibold text-slate-700">Tidak ada butir soal dalam kategori ini.</p>
          </div>
        ) : (
          filteredQuestions.map((q) => {
            const actualIndex = questions.findIndex((item) => item.id === q.id);

            return (
              <div
                key={q.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition overflow-hidden"
              >
                {/* Question Card Header */}
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="w-7 h-7 rounded-lg bg-slate-900 text-white font-extrabold text-xs flex items-center justify-center">
                      {q.number}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        q.type === 'multiple_choice'
                          ? 'bg-blue-100 text-blue-800'
                          : q.type === 'complex_multiple_choice'
                          ? 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                          : q.type === 'short_answer'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}
                    >
                      {q.type === 'multiple_choice'
                        ? 'PG Biasa (1 Kunci)'
                        : q.type === 'complex_multiple_choice'
                        ? 'PG Kompleks (2-3 Kunci)'
                        : q.type === 'short_answer'
                        ? 'Isian Singkat'
                        : 'Uraian / Essay'}
                    </span>

                    {/* INDIKATOR TINGKAT KESULITAN (MUDAH, SEDANG, SUKAR) */}
                    {(() => {
                      const qDiff = getQuestionDifficulty(q);
                      const b = getDifficultyBadge(qDiff);
                      return (
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border shadow-2xs ${b.badgeClass}`}
                          title={`Tingkat Kesulitan: ${b.label}`}
                        >
                          <span className={`w-2 h-2 rounded-full ${b.dotColor}`} />
                          <span>{b.label}</span>
                        </span>
                      );
                    })()}

                    <span className="text-xs font-semibold text-slate-500">
                      Level: <strong className="text-slate-800">{q.cognitiveLevel}</strong>
                    </span>
                  </div>

                  {/* Card Controls */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleMoveUp(actualIndex)}
                      disabled={actualIndex === 0}
                      className="p-1.5 rounded-lg border border-slate-300 hover:bg-white text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Geser soal ke atas"
                      aria-label={`Geser soal ${q.number} ke atas`}
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveDown(actualIndex)}
                      disabled={actualIndex === questions.length - 1}
                      className="p-1.5 rounded-lg border border-slate-300 hover:bg-white text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Geser soal ke bawah"
                      aria-label={`Geser soal ${q.number} ke bawah`}
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteQuestion(actualIndex)}
                      className="p-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600 ml-1"
                      title="Hapus butir soal ini"
                      aria-label={`Hapus butir soal ${q.number}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Question Body */}
                <div className="p-5 space-y-4">
                  {/* Teks Pertanyaan */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Teks Pertanyaan Soal
                    </label>
                    <textarea
                      rows={2}
                      value={q.questionText}
                      onChange={(e) => handleUpdateQuestion(actualIndex, { questionText: e.target.value })}
                      placeholder="Ketik teks pertanyaan butir soal di sini..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm font-medium leading-relaxed"
                    />
                  </div>

                  {/* KELOLA GAMBAR BUTIR SOAL */}
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-teal-700" />
                        <span className="text-xs font-bold text-slate-800">
                          Stimulus Gambar Soal
                        </span>
                        {q.imageUrl ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Ada Gambar
                          </span>
                        ) : q.imageAlt ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            Perlu Gambar
                          </span>
                        ) : null}
                      </div>

                      {/* Kontrol Gambar */}
                      <div className="flex items-center gap-1.5">
                        <input
                          type="file"
                          id={`img-upload-${q.id}`}
                          accept="image/jpeg,image/png,image/webp,image/jpg"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadImage(actualIndex, file);
                            e.target.value = '';
                          }}
                        />

                        <label
                          htmlFor={`img-upload-${q.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer shadow-2xs transition"
                          title="Unggah gambar dari komputer atau smartphone"
                        >
                          <Upload className="w-3.5 h-3.5 text-sky-600" />
                          <span>{q.imageUrl ? 'Ganti Gambar' : 'Unggah Gambar'}</span>
                        </label>

                        <button
                          type="button"
                          onClick={() => setSelectedPromptModalIndex(actualIndex)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-indigo-200 bg-indigo-50/90 hover:bg-indigo-100 text-indigo-900 text-xs font-semibold shadow-2xs transition cursor-pointer"
                          title="Lihat prompt AI gambar untuk dibuat secara manual di Gemini/Canva/Bing"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Prompt AI Gambar</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleGenerateAiImage(actualIndex)}
                          disabled={generatingImageIndex === actualIndex}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-teal-300 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-semibold shadow-2xs transition disabled:opacity-50"
                          title="Buat gambar otomatis menggunakan Google AI"
                        >
                          {generatingImageIndex === actualIndex ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-700" />
                              <span>Membuat...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                              <span>{q.imageUrl ? 'Regenerate AI' : 'Generate AI'}</span>
                            </>
                          )}
                        </button>

                        {q.imageUrl && (
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(actualIndex)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 text-xs font-semibold shadow-2xs transition"
                            title="Hapus gambar dari butir soal ini"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Hapus</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Jika Ada Gambar Terpasang */}
                    {q.imageUrl && (
                      <div className="space-y-2 pt-1">
                        <div className="flex flex-col items-center bg-white p-2.5 rounded-lg border border-slate-200">
                          <img
                            src={q.imageUrl}
                            alt={q.imageAlt || `Stimulus soal nomor ${q.number}`}
                            referrerPolicy="no-referrer"
                            className="max-h-52 max-w-full rounded border border-slate-200 object-contain shadow-2xs bg-slate-50"
                          />
                        </div>

                        {/* Input Keterangan Gambar */}
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-slate-600 shrink-0">
                            Keterangan Gambar:
                          </span>
                          <input
                            type="text"
                            value={q.imageCaption || ''}
                            onChange={(e) => handleUpdateQuestion(actualIndex, { imageCaption: e.target.value })}
                            placeholder="Contoh: Gambar 1. Rantai Makanan Ekosistem Sawah"
                            className="flex-1 bg-white px-2.5 py-1 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500 font-medium"
                          />
                        </div>

                        {/* Pengaturan Posisi Gambar (Di Atas Soal vs Di Bawah Soal) */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-bold text-slate-700">Posisi Peletakan:</span>
                            <span className="text-[10px] text-slate-500 font-medium">
                              {(q.imagePosition || packageData.defaultImagePosition || 'below_question') === 'above_question'
                                ? 'Di Atas Kalimat Soal'
                                : 'Di Bawah Kalimat (Antara Soal & Pilihan)'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-200/80 border border-slate-300 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleUpdateQuestion(actualIndex, { imagePosition: 'above_question' })}
                              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                                (q.imagePosition || packageData.defaultImagePosition || 'below_question') === 'above_question'
                                  ? 'bg-teal-700 text-white shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                              }`}
                              title="Gambar diletakkan sebelum teks kalimat soal (sebagai stimulus pembuka)"
                            >
                              Di Atas Soal
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateQuestion(actualIndex, { imagePosition: 'below_question' })}
                              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition ${
                                (q.imagePosition || packageData.defaultImagePosition || 'below_question') === 'below_question'
                                  ? 'bg-teal-700 text-white shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                              }`}
                              title="Gambar diletakkan setelah kalimat soal dan sebelum pilihan jawaban"
                            >
                              Di Bawah Soal
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Jika Belum Ada Gambar tapi Ada Deskripsi Stimulus atau Status AI */}
                    {!q.imageUrl && (q.imageAlt || q.imageAiStatus) && (
                      <div className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-200 text-xs space-y-2.5">
                        {q.imageAlt && (
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-amber-900 block text-[11px]">
                                Saran Stimulus Visual Soal:
                              </span>
                              <span className="text-[10px] text-amber-700 font-bold px-2 py-0.5 rounded-full bg-amber-100 border border-amber-200/80">
                                Prompt AI Tersedia
                              </span>
                            </div>
                            <p className="text-amber-950 text-xs leading-relaxed italic bg-amber-100/60 p-2 rounded-lg border border-amber-200/80 mt-1">
                              "{q.imageAlt}"
                            </p>
                          </div>
                        )}

                        {/* Tombol Cepat Salin Prompt AI & Panduan */}
                        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-200/60">
                          <button
                            type="button"
                            onClick={() => handleCopyInlinePrompt(actualIndex)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-bold text-[11px] shadow-2xs transition cursor-pointer"
                            title="Salin teks prompt AI untuk membuat gambar di Gemini/ChatGPT/Bing"
                          >
                            {copiedPromptIndex === actualIndex ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-300" />
                                <span>Prompt Tersalin!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Salin Prompt AI</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedPromptModalIndex(actualIndex)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-amber-300 bg-white hover:bg-amber-100 text-amber-900 font-bold text-[11px] transition cursor-pointer"
                          >
                            <Sparkles className="w-3 h-3 text-amber-600" />
                            <span>Buka Generator AI & Panduan</span>
                          </button>

                          <label
                            htmlFor={`img-upload-${q.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-[11px] cursor-pointer transition ml-auto"
                            title="Unggah berkas gambar hasil generate"
                          >
                            <Upload className="w-3 h-3 text-sky-600" />
                            <span>Unggah Gambar</span>
                          </label>
                        </div>

                        {q.imageAiStatus?.message && (
                          <div className="text-[11px] text-amber-900/80 pt-1 border-t border-amber-200/60 leading-relaxed">
                            <strong>Status AI:</strong> {q.imageAiStatus.message}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Pesan Error Pemrosesan Gambar */}
                    {imageErrorState?.index === actualIndex && (
                      <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>{imageErrorState.message}</span>
                      </div>
                    )}
                  </div>

                  {/* Pilihan Ganda: Opsi A, B, C (atau D) */}
                  {q.type === 'multiple_choice' && q.options && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold text-slate-700">
                          {q.options.length === 3 ? '3 Pilihan Jawaban (A, B, C)' : '4 Pilihan Jawaban (A, B, C, D)'} & Kunci Jawaban
                        </label>
                        <div className="flex items-center gap-1.5">
                          {q.options.length === 3 ? (
                            <button
                              type="button"
                              onClick={() => {
                                const newOpts = [...q.options!, { key: 'D', text: '' }];
                                handleUpdateQuestion(actualIndex, { options: newOpts });
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-teal-300 bg-teal-50 hover:bg-teal-100 text-teal-800 text-[11px] font-semibold transition"
                              title="Tambahkan opsi D untuk butir soal ini"
                            >
                              <span>+ Tambah Opsi D</span>
                            </button>
                          ) : q.options.length === 4 ? (
                            <button
                              type="button"
                              onClick={() => {
                                const newOpts = q.options!.filter((o) => o.key !== 'D');
                                const newKey = q.answerKey === 'D' ? 'A' : q.answerKey;
                                handleUpdateQuestion(actualIndex, { options: newOpts, answerKey: newKey });
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 hover:text-rose-600 text-[11px] font-semibold transition"
                              title="Hapus opsi D untuk butir soal ini"
                            >
                              <span>- Kurangi Opsi D</span>
                            </button>
                          ) : null}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {q.options.map((opt) => (
                          <div
                            key={opt.key}
                            className={`flex items-center gap-2.5 p-2 rounded-xl border transition ${
                              q.answerKey === opt.key
                                ? 'bg-teal-50/70 border-teal-400 ring-1 ring-teal-400'
                                : 'bg-slate-50/60 border-slate-200'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => handleUpdateQuestion(actualIndex, { answerKey: opt.key })}
                              className={`w-7 h-7 rounded-lg font-bold text-xs shrink-0 transition ${
                                q.answerKey === opt.key
                                  ? 'bg-teal-700 text-white shadow-2xs'
                                  : 'bg-white border border-slate-300 text-slate-700 hover:border-teal-500'
                              }`}
                              title={`Jadikan ${opt.key} sebagai kunci jawaban benar`}
                            >
                              {opt.key}
                            </button>
                            <input
                              type="text"
                              value={opt.text}
                              onChange={(e) => handleUpdateOption(actualIndex, opt.key, e.target.value)}
                              placeholder={`Teks pilihan ${opt.key}`}
                              className="w-full bg-white px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pilihan Ganda Kompleks: Opsi A, B, C (atau D) & 2-3 Kunci Jawaban */}
                  {q.type === 'complex_multiple_choice' && q.options && (
                    <div className="space-y-2 p-3.5 rounded-xl bg-indigo-50/40 border border-indigo-200">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                        <div>
                          <label className="block text-xs font-bold text-indigo-950">
                            {q.options.length === 3 ? '3 Pilihan Jawaban (A, B, C)' : '4 Pilihan Jawaban (A, B, C, D)'} — Pilih 2 atau 3 Kunci Jawaban Benar
                          </label>
                          <p className="text-[11px] text-indigo-700/80">
                            Klik tombol huruf opsi untuk mengaktifkan atau menonaktifkan kunci jawaban yang benar.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-900 border border-indigo-300">
                            Kunci: {q.answerKey || 'Belum ada'}
                          </span>
                          {q.options.length === 3 ? (
                            <button
                              type="button"
                              onClick={() => {
                                const newOpts = [...q.options!, { key: 'D', text: '' }];
                                handleUpdateQuestion(actualIndex, { options: newOpts });
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-indigo-300 bg-white hover:bg-indigo-50 text-indigo-800 text-[11px] font-semibold transition"
                              title="Tambahkan opsi D untuk butir soal ini"
                            >
                              <span>+ Tambah Opsi D</span>
                            </button>
                          ) : q.options.length === 4 ? (
                            <button
                              type="button"
                              onClick={() => {
                                const newOpts = q.options!.filter((o) => o.key !== 'D');
                                const currentKeys = (q.answerKey || '')
                                  .split(',')
                                  .map((k) => k.trim().toUpperCase())
                                  .filter((k) => k && k !== 'D');
                                const newKey = currentKeys.length > 0 ? currentKeys.join(', ') : 'A, B';
                                handleUpdateQuestion(actualIndex, { options: newOpts, answerKey: newKey });
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 hover:text-rose-600 text-[11px] font-semibold transition"
                              title="Hapus opsi D untuk butir soal ini"
                            >
                              <span>- Kurangi Opsi D</span>
                            </button>
                          ) : null}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                        {q.options.map((opt) => {
                          const currentKeys = (q.answerKey || '')
                            .split(',')
                            .map((k) => k.trim().toUpperCase())
                            .filter(Boolean);
                          const isSelected = currentKeys.includes(opt.key);

                          const toggleKey = () => {
                            let nextKeys: string[];
                            if (isSelected) {
                              nextKeys = currentKeys.filter((k) => k !== opt.key);
                            } else {
                              if (currentKeys.length >= 3) {
                                nextKeys = [...currentKeys.slice(0, 2), opt.key];
                              } else {
                                nextKeys = [...currentKeys, opt.key];
                              }
                            }
                            nextKeys.sort();
                            handleUpdateQuestion(actualIndex, { answerKey: nextKeys.join(', ') });
                          };

                          return (
                            <div
                              key={opt.key}
                              className={`flex items-center gap-2.5 p-2 rounded-xl border transition ${
                                isSelected
                                  ? 'bg-white border-indigo-500 ring-2 ring-indigo-400 shadow-2xs'
                                  : 'bg-white/80 border-slate-200'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={toggleKey}
                                className={`w-8 h-7 rounded-lg font-bold text-xs shrink-0 transition flex items-center justify-center gap-0.5 ${
                                  isSelected
                                    ? 'bg-indigo-700 text-white shadow-2xs'
                                    : 'bg-slate-100 border border-slate-300 text-slate-700 hover:border-indigo-400 hover:bg-indigo-50'
                                }`}
                                title={`Klik untuk ${isSelected ? 'menghapus' : 'menjadikan'} ${opt.key} sebagai kunci jawaban benar (bisa 2 atau 3)`}
                              >
                                {isSelected ? '✓ ' : ''}{opt.key}
                              </button>
                              <input
                                type="text"
                                value={opt.text}
                                onChange={(e) => handleUpdateOption(actualIndex, opt.key, e.target.value)}
                                placeholder={`Teks pilihan ${opt.key}`}
                                className="w-full bg-white px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Isian Singkat: Kunci Jawaban */}
                  {q.type === 'short_answer' && (
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700">
                        Kunci Jawaban Isian Singkat
                      </label>
                      <input
                        type="text"
                        value={q.answerKey || ''}
                        onChange={(e) => handleUpdateQuestion(actualIndex, { answerKey: e.target.value })}
                        placeholder="Contoh jawaban tepat..."
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs font-semibold bg-emerald-50/30"
                      />
                    </div>
                  )}

                  {/* Uraian: Contoh Jawaban Lengkap & Rubrik */}
                  {q.type === 'essay' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Contoh Jawaban Lengkap / Kunci Jawaban Uraian
                        </label>
                        <textarea
                          rows={2}
                          value={q.answerKey || ''}
                          onChange={(e) => handleUpdateQuestion(actualIndex, { answerKey: e.target.value })}
                          placeholder="Tuliskan uraian jawaban yang diharapkan dari peserta didik..."
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs bg-purple-50/20"
                        />
                      </div>

                      {q.rubric && q.rubric.length > 0 && (
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                          <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                            Rubrik Pedoman Penskoran
                          </span>
                          <div className="space-y-1.5">
                            {q.rubric.map((r, rIdx) => (
                              <div key={rIdx} className="flex items-center gap-2 text-xs">
                                <span className="text-slate-400">•</span>
                                <input
                                  type="text"
                                  value={r.criteria}
                                  onChange={(e) => {
                                    const nextRubric = [...(q.rubric || [])];
                                    nextRubric[rIdx] = { ...nextRubric[rIdx], criteria: e.target.value };
                                    handleUpdateQuestion(actualIndex, { rubric: nextRubric });
                                  }}
                                  className="flex-1 bg-white px-2 py-1 rounded border border-slate-300 text-xs"
                                />
                                <div className="flex items-center gap-1 shrink-0">
                                  <span className="text-[11px] text-slate-500">Skor:</span>
                                  <input
                                    type="number"
                                    min="1"
                                    max="10"
                                    value={r.score}
                                    onChange={(e) => {
                                      const nextRubric = [...(q.rubric || [])];
                                      nextRubric[rIdx] = { ...nextRubric[rIdx], score: Number(e.target.value) || 1 };
                                      handleUpdateQuestion(actualIndex, { rubric: nextRubric });
                                    }}
                                    className="w-12 bg-white px-1.5 py-1 rounded border border-slate-300 text-xs font-bold text-center"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Pembahasan & Indikator Pedagogis */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2 border-t border-slate-100 text-xs">
                    <div className="sm:col-span-5">
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Pembahasan Guru
                      </label>
                      <input
                        type="text"
                        value={q.explanation || ''}
                        onChange={(e) => handleUpdateQuestion(actualIndex, { explanation: e.target.value })}
                        placeholder="Penjelasan ringkas konsep..."
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                      />
                    </div>

                    {/* Pengatur Cepat Tingkat Kesulitan */}
                    <div className="sm:col-span-4">
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Tingkat Kesulitan (Kurikulum Merdeka)
                      </label>
                      <div className="flex items-center gap-1">
                        {(['Mudah', 'Sedang', 'Sulit'] as NormalizedDifficulty[]).map((d) => {
                          const currentDiff = getQuestionDifficulty(q);
                          const isSelected = currentDiff === d;
                          const b = getDifficultyBadge(d);
                          return (
                            <button
                              key={d}
                              type="button"
                              onClick={() => handleUpdateDifficulty(actualIndex, d)}
                              className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold border transition flex items-center justify-center gap-1 ${
                                isSelected
                                  ? `${b.badgeClass} ring-2 ring-slate-400 shadow-2xs`
                                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                              }`}
                              title={`Ubah butir nomor ${q.number} menjadi ${b.label}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${b.dotColor}`} />
                              <span>{b.shortLabel}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Level Kognitif
                      </label>
                      <select
                        value={q.cognitiveLevel}
                        onChange={(e) => handleUpdateQuestion(actualIndex, { cognitiveLevel: e.target.value as CognitiveLevel })}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white font-medium"
                      >
                        <option value="L1 (Mengingat/Memahami)">L1 (Mengingat/Memahami)</option>
                        <option value="L2 (Menerapkan)">L2 (Menerapkan)</option>
                        <option value="L3 (Penalaran/HOTS)">L3 (Penalaran/HOTS)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                    {/* Pemilihan Materi Pokok / Bab jika paket memiliki multi-bab */}
                    {packageData.topics && packageData.topics.length > 0 ? (
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Materi Pokok / Bab
                        </label>
                        <select
                          value={q.topic || packageData.topic}
                          onChange={(e) => handleUpdateQuestion(actualIndex, { topic: e.target.value })}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white font-medium"
                        >
                          {packageData.topics.map((top) => (
                            <option key={top.id} value={top.topic}>
                              {top.topic}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}

                    <div className={packageData.topics && packageData.topics.length > 0 ? "sm:col-span-2" : "sm:col-span-3"}>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Indikator Ketercapaian Soal
                      </label>
                      <input
                        type="text"
                        value={q.indicator || ''}
                        onChange={(e) => handleUpdateQuestion(actualIndex, { indicator: e.target.value })}
                        placeholder="Indikator operasional..."
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Bobot Skor
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={q.score || 1}
                        onChange={(e) => handleUpdateQuestion(actualIndex, { score: Number(e.target.value) || 1 })}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-center"
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Sticky Save Bar */}
      <div className="sticky bottom-4 z-20 bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-slate-200 shadow-xl flex items-center justify-between gap-3">
        <span className="text-xs text-slate-500">
          Total Butir Soal Terdata: <strong>{questions.length}</strong> (Akumulasi Skor: {totalScore})
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenPreview({ ...packageData, questions })}
            className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
          >
            Pratinjau Dokumen
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold shadow-xs transition inline-flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>Simpan Seluruh Soal</span>
          </button>
        </div>
      </div>

      {/* Modal Prompt AI Gambar Manual untuk Butir Soal Tertentu */}
      {selectedPromptModalIndex !== null && questions[selectedPromptModalIndex] && (
        <ManualImagePromptModal
          isOpen={true}
          onClose={() => setSelectedPromptModalIndex(null)}
          question={questions[selectedPromptModalIndex]}
          packageContext={{
            subject: packageData.subject,
            grade: packageData.grade,
            phase: packageData.phase,
            topic: questions[selectedPromptModalIndex].topic || packageData.topic,
          }}
          onUploadImage={(file) => {
            handleUploadImage(selectedPromptModalIndex, file);
          }}
          onUpdateImageAlt={(newAlt) => {
            handleUpdateQuestion(selectedPromptModalIndex, { imageAlt: newAlt });
          }}
        />
      )}

      {/* Modal Prompt AI Gambar untuk Seluruh Paket (Batch) */}
      <BatchImagePromptsModal
        isOpen={showBatchPromptModal}
        onClose={() => setShowBatchPromptModal(false)}
        packageData={packageData}
        questions={questions}
        onOpenSinglePrompt={(index) => {
          setSelectedPromptModalIndex(index);
        }}
      />

      {/* Modal Konfirmasi Hapus Soal dengan Penomoran Otomatis */}
      <ConfirmModal
        isOpen={deleteTargetIndex !== null}
        title="Hapus Butir Soal"
        message={
          deleteTargetIndex !== null && questions[deleteTargetIndex]
            ? `Apakah Anda yakin ingin menghapus butir soal nomor ${questions[deleteTargetIndex].number}? Nomor butir soal berikutnya akan otomatis bergeser dan disesuaikan berurutan (1..${questions.length - 1}).`
            : 'Hapus butir soal ini?'
        }
        confirmLabel="Hapus Soal"
        cancelLabel="Batal"
        isDestructive={true}
        onConfirm={confirmDeleteQuestion}
        onCancel={() => setDeleteTargetIndex(null)}
      />
    </div>
  );
};
