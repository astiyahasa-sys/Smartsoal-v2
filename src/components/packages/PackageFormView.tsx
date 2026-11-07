import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Save,
  Eye,
  RotateCcw,
  ArrowLeft,
  Sparkles,
  School,
  AlertCircle,
  HelpCircle,
  Clock,
  BookOpen,
  Info,
  Loader2,
  CheckCircle2,
  Edit3,
  Image as ImageIcon,
  Upload,
  Wand2,
  Plus,
  Trash2,
  ListPlus,
  FolderPlus,
  CheckSquare,
  Layers,
  Sliders,
  FileText,
  Minus,
  RefreshCw,
  Play,
} from 'lucide-react';
import {
  ActiveView,
  DifficultyLevel,
  Grade,
  ImageMode,
  ImagePosition,
  MultipleChoiceOptionCount,
  QuestionItem,
  QuestionPackage,
  SchoolProfile,
  Semester,
  TopicItem,
} from '../../types';
import {
  getPhaseByGrade,
  calculateTotalQuestions,
  validatePackageForm,
  generateUniqueId,
  autoNumberQuestions,
  MI_SUBJECTS,
  ASSESSMENT_TYPES,
  ValidationError,
  createBlankQuestionsForPackage,
  scaleQuestionCountsToTotal,
} from '../../utils/curriculum';
import { extractErrorMessage } from '../../utils/errorParser';

/**
 * Spesifikasi setiap batch permintaan pembangkitan soal AI
 */
export interface QuestionBatchSpec {
  batchIndex: number;
  batchNumber: number;
  totalBatches: number;
  multipleChoiceCount: number;
  complexMultipleChoiceCount: number;
  shortAnswerCount: number;
  essayCount: number;
  totalQuestions: number;
  description: string;
}

/**
 * Status progres sequential batching yang sedang berjalan
 */
export interface BatchProgressState {
  totalBatches: number;
  currentBatchIndex: number;
  completedBatches: number;
  totalTargetQuestions: number;
  generatedQuestionsCount: number;
  currentBatchDescription: string;
  stageMessage: string;
  percent: number;
}

export function formatBatchDescription(mc: number, cmc: number, sa: number, es: number): string {
  const parts: string[] = [];
  if (mc > 0) parts.push(`${mc} Pilihan Ganda`);
  if (cmc > 0) parts.push(`${cmc} PG Kompleks`);
  if (sa > 0) parts.push(`${sa} Isian`);
  if (es > 0) parts.push(`${es} Uraian`);
  return parts.join(', ') || '0 Butir';
}

/**
 * Membagi target butir soal asesmen menjadi batch-batch kecil (maksimal 15 butir per batch)
 * untuk menghindari batas waktu eksekusi Vercel Serverless (HTTP 504).
 * Mempertahankan komposisi jenis soal secara tepat (PG -> PG Kompleks -> Isian -> Uraian).
 */
export function planQuestionBatches(
  multipleChoiceCount: number,
  complexMultipleChoiceCount: number,
  shortAnswerCount: number,
  essayCount: number,
  maxPerBatch: number = 15
): QuestionBatchSpec[] {
  const mc = Math.max(0, Math.floor(Number(multipleChoiceCount) || 0));
  const cmc = Math.max(0, Math.floor(Number(complexMultipleChoiceCount) || 0));
  const sa = Math.max(0, Math.floor(Number(shortAnswerCount) || 0));
  const es = Math.max(0, Math.floor(Number(essayCount) || 0));
  const total = mc + cmc + sa + es;

  if (total <= 0) return [];

  // Jika total <= 15: gunakan 1 batch tunggal tanpa batching bertingkat
  if (total <= maxPerBatch) {
    return [
      {
        batchIndex: 0,
        batchNumber: 1,
        totalBatches: 1,
        multipleChoiceCount: mc,
        complexMultipleChoiceCount: cmc,
        shortAnswerCount: sa,
        essayCount: es,
        totalQuestions: total,
        description: formatBatchDescription(mc, cmc, sa, es),
      },
    ];
  }

  // Jika total > 15: bagi secara sekuensial dengan batas max 15 per batch
  // Mengikuti tata urutan standar: PG -> PG Kompleks -> Isian -> Uraian
  let remMC = mc;
  let remCMC = cmc;
  let remSA = sa;
  let remES = es;

  const rawBatches: Array<{
    mc: number;
    cmc: number;
    sa: number;
    es: number;
    total: number;
  }> = [];

  while (remMC > 0 || remCMC > 0 || remSA > 0 || remES > 0) {
    let capacity = maxPerBatch;

    const takeMC = Math.min(remMC, capacity);
    capacity -= takeMC;
    remMC -= takeMC;

    const takeCMC = Math.min(remCMC, capacity);
    capacity -= takeCMC;
    remCMC -= takeCMC;

    const takeSA = Math.min(remSA, capacity);
    capacity -= takeSA;
    remSA -= takeSA;

    const takeES = Math.min(remES, capacity);
    capacity -= takeES;
    remES -= takeES;

    const batchTotal = takeMC + takeCMC + takeSA + takeES;
    if (batchTotal > 0) {
      rawBatches.push({
        mc: takeMC,
        cmc: takeCMC,
        sa: takeSA,
        es: takeES,
        total: batchTotal,
      });
    } else {
      break;
    }
  }

  const totalBatches = rawBatches.length;
  return rawBatches.map((b, idx) => ({
    batchIndex: idx,
    batchNumber: idx + 1,
    totalBatches,
    multipleChoiceCount: b.mc,
    complexMultipleChoiceCount: b.cmc,
    shortAnswerCount: b.sa,
    essayCount: b.es,
    totalQuestions: b.total,
    description: formatBatchDescription(b.mc, b.cmc, b.sa, b.es),
  }));
}

interface PackageFormViewProps {
  packageToEdit: QuestionPackage | null;
  schoolProfile: SchoolProfile | null;
  onSave: (pkg: QuestionPackage, andPreview?: boolean) => void;
  onNavigate: (view: ActiveView) => void;
  onPreview: (pkg: QuestionPackage) => void;
  onOpenEditor?: (pkg: QuestionPackage) => void;
}

export const PackageFormView: React.FC<PackageFormViewProps> = ({
  packageToEdit,
  schoolProfile,
  onSave,
  onNavigate,
  onPreview,
  onOpenEditor,
}) => {
  // Initial state setup
  const [title, setTitle] = useState(packageToEdit?.title || '');
  const [schoolName, setSchoolName] = useState(
    packageToEdit?.schoolName || schoolProfile?.schoolName || ''
  );
  const [teacherName, setTeacherName] = useState(
    packageToEdit?.teacherName || schoolProfile?.teacherName || ''
  );
  const [academicYear, setAcademicYear] = useState(
    packageToEdit?.academicYear || '2024/2025'
  );
  const [semester, setSemester] = useState<Semester>(
    packageToEdit?.semester || 'Ganjil'
  );
  const [assessmentType, setAssessmentType] = useState<string>(() => {
    if (packageToEdit?.assessmentType) {
      if (packageToEdit.assessmentType === 'Penilaian Harian') return 'Asesmen Harian';
      if (packageToEdit.assessmentType === 'Penilaian Tengah Semester') return 'Asesmen Sumatif Tengah Semester (ASTS)';
      if (packageToEdit.assessmentType === 'Sumatif Akhir Semester (SAS)') return 'Asesmen Sumatif Akhir Semester (ASAS)';
      if (packageToEdit.assessmentType === 'Sumatif Lingkup Materi') return 'Asesmen Sumatif Lingkup Materi';
      return packageToEdit.assessmentType;
    }
    return 'Asesmen Harian';
  });
  const [customAssessmentType, setCustomAssessmentType] = useState('');

  const [selectedSubject, setSelectedSubject] = useState(
    packageToEdit ? (MI_SUBJECTS.includes(packageToEdit.subject as any) ? packageToEdit.subject : 'Lainnya') : "Al-Qur'an Hadis"
  );
  const [customSubject, setCustomSubject] = useState(
    packageToEdit && !MI_SUBJECTS.includes(packageToEdit.subject as any) ? packageToEdit.subject : ''
  );

  const [grade, setGrade] = useState<Grade>(packageToEdit?.grade || 4);
  const [topic, setTopic] = useState(packageToEdit?.topic || '');
  const [learningObjectives, setLearningObjectives] = useState(
    packageToEdit?.learningObjectives || ''
  );
  // State materi pokok & TP multi-bab terpisah
  const [topics, setTopics] = useState<TopicItem[]>(() => {
    if (packageToEdit?.topics && packageToEdit.topics.length > 0) {
      return packageToEdit.topics;
    }
    if (packageToEdit?.topic) {
      return [{
        id: 'top_1',
        topic: packageToEdit.topic,
        learningObjectives: packageToEdit.learningObjectives || '',
      }];
    }
    return [{
      id: 'top_1',
      topic: '',
      learningObjectives: '',
    }];
  });
  const [durationMinutes, setDurationMinutes] = useState<number>(
    packageToEdit?.durationMinutes || 90
  );

  // Question configuration
  const [multipleChoiceCount, setMultipleChoiceCount] = useState<number>(
    packageToEdit ? packageToEdit.multipleChoiceCount : 15
  );
  const [complexMultipleChoiceCount, setComplexMultipleChoiceCount] = useState<number>(
    packageToEdit ? (packageToEdit.complexMultipleChoiceCount ?? 5) : 5
  );
  const [shortAnswerCount, setShortAnswerCount] = useState<number>(
    packageToEdit ? packageToEdit.shortAnswerCount : 5
  );
  const [essayCount, setEssayCount] = useState<number>(
    packageToEdit ? packageToEdit.essayCount : 5
  );
  const [difficulty, setDifficulty] = useState<DifficultyLevel>(
    packageToEdit?.difficulty || 'Campuran'
  );
  const [language, setLanguage] = useState(
    packageToEdit?.language || 'Bahasa Indonesia'
  );
  const [customLanguage, setCustomLanguage] = useState('');
  const [sourceMaterial, setSourceMaterial] = useState(
    packageToEdit?.sourceMaterial || ''
  );
  const [additionalNotes, setAdditionalNotes] = useState(
    packageToEdit?.additionalNotes || ''
  );
  const [imageMode, setImageMode] = useState<ImageMode>(
    packageToEdit?.imageMode || 'none'
  );
  const [defaultImagePosition, setDefaultImagePosition] = useState<ImagePosition>(
    packageToEdit?.defaultImagePosition || 'below_question'
  );
  const [mcOptionCount, setMcOptionCount] = useState<MultipleChoiceOptionCount>(
    packageToEdit?.mcOptionCount || (packageToEdit ? 4 : (grade <= 2 ? 3 : 4))
  );
  const [hasManuallySetOptionCount, setHasManuallySetOptionCount] = useState<boolean>(
    Boolean(packageToEdit?.mcOptionCount)
  );

  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [showAiModal, setShowAiModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStage, setGenerationStage] = useState('');
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // State untuk Sequential Batching Pembangkitan Soal
  const [batchProgress, setBatchProgress] = useState<BatchProgressState | null>(null);
  const [accumulatedBatchQuestions, setAccumulatedBatchQuestions] = useState<QuestionItem[]>([]);
  const [failedBatchIndex, setFailedBatchIndex] = useState<number | null>(null);
  const [batchPackageTitle, setBatchPackageTitle] = useState<string>('');

  // Auto calculate phase based on grade
  const phase = useMemo(() => getPhaseByGrade(grade), [grade]);

  // Saran otomatis jumlah opsi jawaban (3 opsi untuk Fase A Kelas 1-2, 4 opsi untuk Fase B-C Kelas 3-6)
  useEffect(() => {
    if (!hasManuallySetOptionCount && !packageToEdit) {
      setMcOptionCount(grade <= 2 ? 3 : 4);
    }
  }, [grade, hasManuallySetOptionCount, packageToEdit]);

  // Auto calculate total questions
  const totalQuestions = useMemo(
    () => calculateTotalQuestions(multipleChoiceCount, shortAnswerCount, essayCount, complexMultipleChoiceCount),
    [multipleChoiceCount, shortAnswerCount, essayCount, complexMultipleChoiceCount]
  );

  // Rencana pembagian batching otomatis jika total butir soal > 15
  const batchPlan = useMemo(() => {
    return planQuestionBatches(
      multipleChoiceCount,
      complexMultipleChoiceCount || 0,
      shortAnswerCount,
      essayCount,
      15
    );
  }, [multipleChoiceCount, complexMultipleChoiceCount, shortAnswerCount, essayCount]);

  // Estimasi total skor maksimal naskah
  const estimatedMaxScore = useMemo(() => {
    return (
      multipleChoiceCount * 1 +
      (complexMultipleChoiceCount || 0) * 2 +
      shortAnswerCount * 2 +
      essayCount * 4
    );
  }, [multipleChoiceCount, complexMultipleChoiceCount, shortAnswerCount, essayCount]);

  // Model pola komposisi soal
  type CompositionPreset =
    | 'campuran_lengkap'
    | 'campuran_klasik'
    | 'pg_uraian'
    | 'pg_saja'
    | 'isian_uraian'
    | 'kustom';

  const currentPreset = useMemo<CompositionPreset>(() => {
    if (multipleChoiceCount === 15 && complexMultipleChoiceCount === 5 && shortAnswerCount === 5 && essayCount === 5) {
      return 'campuran_lengkap';
    }
    if (multipleChoiceCount === 20 && complexMultipleChoiceCount === 0 && shortAnswerCount === 5 && essayCount === 5) {
      return 'campuran_klasik';
    }
    if (multipleChoiceCount === 20 && complexMultipleChoiceCount === 5 && shortAnswerCount === 0 && essayCount === 5) {
      return 'pg_uraian';
    }
    if (shortAnswerCount === 0 && essayCount === 0 && (multipleChoiceCount > 0 || complexMultipleChoiceCount > 0)) {
      return 'pg_saja';
    }
    if (multipleChoiceCount === 0 && complexMultipleChoiceCount === 0 && (shortAnswerCount > 0 || essayCount > 0)) {
      return 'isian_uraian';
    }
    if (multipleChoiceCount > 0 && complexMultipleChoiceCount > 0 && shortAnswerCount > 0 && essayCount > 0) {
      return 'campuran_lengkap';
    }
    return 'kustom';
  }, [multipleChoiceCount, complexMultipleChoiceCount, shortAnswerCount, essayCount]);

  const handleApplyPreset = (preset: CompositionPreset) => {
    if (preset === 'campuran_lengkap') {
      setMultipleChoiceCount(15);
      setComplexMultipleChoiceCount(5);
      setShortAnswerCount(5);
      setEssayCount(5);
    } else if (preset === 'campuran_klasik') {
      setMultipleChoiceCount(20);
      setComplexMultipleChoiceCount(0);
      setShortAnswerCount(5);
      setEssayCount(5);
    } else if (preset === 'pg_uraian') {
      setMultipleChoiceCount(20);
      setComplexMultipleChoiceCount(5);
      setShortAnswerCount(0);
      setEssayCount(5);
    } else if (preset === 'pg_saja') {
      setMultipleChoiceCount(25);
      setComplexMultipleChoiceCount(5);
      setShortAnswerCount(0);
      setEssayCount(0);
    } else if (preset === 'isian_uraian') {
      setMultipleChoiceCount(0);
      setComplexMultipleChoiceCount(0);
      setShortAnswerCount(10);
      setEssayCount(5);
    }
    setIsDirty(true);
  };

  const handleScaleTotal = (targetTotal: number) => {
    const res = scaleQuestionCountsToTotal(
      targetTotal,
      multipleChoiceCount,
      complexMultipleChoiceCount,
      shortAnswerCount,
      essayCount
    );
    setMultipleChoiceCount(res.mc);
    setComplexMultipleChoiceCount(res.cmc);
    setShortAnswerCount(res.sa);
    setEssayCount(res.es);
    setIsDirty(true);
  };

  // Countdown timer untuk kuota rate limit 429
  const [retryCountdown, setRetryCountdown] = useState<number>(0);

  useEffect(() => {
    if (retryCountdown > 0) {
      const timer = setTimeout(() => {
        setRetryCountdown((prev) => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [retryCountdown]);

  // Handler untuk membuka editor manual dengan butir soal template berstruktur
  const handleOpenManualEditor = () => {
    const pkg = buildPackageObject();
    const blankQuestions = createBlankQuestionsForPackage(
      multipleChoiceCount,
      complexMultipleChoiceCount,
      shortAnswerCount,
      essayCount,
      mcOptionCount as 3 | 4,
      topics,
      topic
    );
    const manualPackage: QuestionPackage = {
      ...pkg,
      questions: blankQuestions,
      status: 'draft',
      updatedAt: new Date().toISOString(),
    };
    setShowConfirmModal(false);
    setIsGenerating(false);
    if (onOpenEditor) {
      onOpenEditor(manualPackage);
    } else {
      onSave(manualPackage, false);
    }
  };

  // Effective Subject Name
  const effectiveSubject = selectedSubject === 'Lainnya' ? customSubject : selectedSubject;

  // Effective Assessment Type
  const effectiveAssessmentType =
    assessmentType === 'Lainnya' ? customAssessmentType : assessmentType;

  // Auto generate title recommendation if blank or untouched
  useEffect(() => {
    if (!packageToEdit && !isDirty && effectiveSubject && topic) {
      setTitle(`${effectiveAssessmentType} ${effectiveSubject} Kelas ${grade} - ${topic}`);
    }
  }, [packageToEdit, isDirty, effectiveAssessmentType, effectiveSubject, grade, topic]);

  // Autofill from School Profile
  const handleAutoFillProfile = () => {
    if (schoolProfile) {
      if (schoolProfile.schoolName) setSchoolName(schoolProfile.schoolName);
      if (schoolProfile.teacherName) setTeacherName(schoolProfile.teacherName);
      setIsDirty(true);
    }
  };

  const handleAddTopic = () => {
    setTopics((prev) => [
      ...prev,
      {
        id: generateUniqueId(),
        topic: '',
        learningObjectives: '',
      },
    ]);
    setIsDirty(true);
  };

  const handleUpdateTopic = (index: number, updated: Partial<TopicItem>) => {
    setTopics((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updated };
      return next;
    });
    setIsDirty(true);
  };

  const handleRemoveTopic = (index: number) => {
    setTopics((prev) => {
      if (prev.length <= 1) {
        return [{ id: generateUniqueId(), topic: '', learningObjectives: '' }];
      }
      return prev.filter((_, i) => i !== index);
    });
    setIsDirty(true);
  };

  const buildPackageObject = (): QuestionPackage => {
    const now = new Date().toISOString();
    const cleanTopics = topics
      .map((t) => ({
        id: t.id || generateUniqueId(),
        topic: (t.topic || '').trim(),
        learningObjectives: (t.learningObjectives || '').trim(),
      }))
      .filter((t) => t.topic.length > 0);

    const primaryTopic = cleanTopics.length > 0 ? cleanTopics.map((t) => t.topic).join('; ') : topic.trim();
    const primaryObjectives = cleanTopics.length > 0
      ? cleanTopics
          .filter((t) => t.learningObjectives)
          .map((t) => `${t.topic}: ${t.learningObjectives}`)
          .join('\n')
      : learningObjectives.trim();

    return {
      id: packageToEdit?.id || generateUniqueId(),
      title: title.trim() || `${effectiveAssessmentType} ${effectiveSubject} Kelas ${grade}`,
      schoolName: schoolName.trim(),
      teacherName: teacherName.trim(),
      academicYear: academicYear.trim(),
      semester,
      assessmentType: effectiveAssessmentType.trim(),
      subject: effectiveSubject.trim(),
      grade,
      phase,
      topic: primaryTopic,
      learningObjectives: primaryObjectives,
      topics: cleanTopics.length > 0 ? cleanTopics : undefined,
      durationMinutes: Math.max(1, Number(durationMinutes) || 90),
      multipleChoiceCount: Math.max(0, Math.floor(Number(multipleChoiceCount) || 0)),
      complexMultipleChoiceCount: Math.max(0, Math.floor(Number(complexMultipleChoiceCount) || 0)),
      shortAnswerCount: Math.max(0, Math.floor(Number(shortAnswerCount) || 0)),
      essayCount: Math.max(0, Math.floor(Number(essayCount) || 0)),
      difficulty,
      language: language === 'Lainnya' ? customLanguage.trim() : language,
      sourceMaterial: sourceMaterial.trim(),
      additionalNotes: additionalNotes.trim(),
      imageMode,
      defaultImagePosition,
      mcOptionCount,
      status: packageToEdit?.status || 'draft',
      createdAt: packageToEdit?.createdAt || now,
      updatedAt: now,
      questions: packageToEdit?.questions || [],
    };
  };

  const handleSaveDraft = (previewAfterSave = false) => {
    const pkg = buildPackageObject();
    const errors = validatePackageForm(pkg);

    if (errors.length > 0) {
      setValidationErrors(errors);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setValidationErrors([]);
    onSave(pkg, previewAfterSave);
  };

  const handlePreviewDirectly = () => {
    const pkg = buildPackageObject();
    const errors = validatePackageForm(pkg);
    if (errors.length > 0) {
      setValidationErrors(errors);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    onPreview(pkg);
  };
  const handleOpenAiConfirmation = () => {
    const pkg = buildPackageObject();
    const errors = validatePackageForm(pkg);
    if (errors.length > 0) {
      setValidationErrors(errors);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setValidationErrors([]);
    setGenerationError(null);
    setFailedBatchIndex(null);
    setAccumulatedBatchQuestions([]);
    setBatchProgress(null);
    setShowConfirmModal(true);
  };

  const handleCancelAiGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsGenerating(false);
    setGenerationStage('');
    setBatchProgress(null);
    setShowConfirmModal(false);
  };

  /**
   * Jika batch gagal di tengah jalan namun beberapa batch awal sudah berhasil menghasilkan soal,
   * guru dapat memilih melanjutkan ke Editor Soal dengan butir-butir yang sudah tersusun
   * tanpa kehilangan hasil sementara.
   */
  const handleProceedWithPartialQuestions = () => {
    if (accumulatedBatchQuestions.length === 0) return;
    const numbered = autoNumberQuestions(accumulatedBatchQuestions);
    const pkg = buildPackageObject();
    const partialPkg: QuestionPackage = {
      ...pkg,
      title: batchPackageTitle || pkg.title,
      questions: numbered,
      status: 'completed',
      updatedAt: new Date().toISOString(),
    };
    setShowConfirmModal(false);
    setIsGenerating(false);
    setBatchProgress(null);
    setAccumulatedBatchQuestions([]);
    setFailedBatchIndex(null);
    if (onOpenEditor) {
      onOpenEditor(partialPkg);
    } else {
      onSave(partialPkg, true);
    }
  };

  /**
   * Utilitas parser error yang aman saat menerima respons dari /api/generate-questions.
   * Menjamin bahwa jika 'error' berupa objek, aplikasi menampilkan properti 'message' atau 'error' miliknya,
   * dan TIDAK PERNAH menampilkan '[object Object]'.
   */
  const parseApiErrorResponse = (dataOrError: any, statusCode?: number): string => {
    if (!dataOrError) {
      return extractErrorMessage(null, statusCode);
    }

    // 1. Jika respons memiliki properti 'error'
    if (dataOrError.error !== undefined && dataOrError.error !== null) {
      // Jika data.error berupa objek, periksa properti 'message' atau 'error' miliknya
      if (typeof dataOrError.error === 'object') {
        const errObj = dataOrError.error;
        const messageProp =
          typeof errObj.message === 'string' && errObj.message.trim() && errObj.message !== '[object Object]'
            ? errObj.message.trim()
            : null;
        const errorProp =
          typeof errObj.error === 'string' && errObj.error.trim() && errObj.error !== '[object Object]'
            ? errObj.error.trim()
            : null;
        const detailsProp =
          typeof errObj.details === 'string' && errObj.details.trim() && errObj.details !== '[object Object]'
            ? errObj.details.trim()
            : null;

        const candidate = messageProp || errorProp || detailsProp;
        if (candidate) {
          return extractErrorMessage(candidate, statusCode);
        }
        return extractErrorMessage(errObj, statusCode);
      }

      // Jika data.error berupa string
      if (typeof dataOrError.error === 'string' && dataOrError.error.trim() && dataOrError.error !== '[object Object]') {
        return extractErrorMessage(dataOrError.error, statusCode);
      }
    }

    // 2. Jika respons memiliki properti 'message'
    if (typeof dataOrError.message === 'string' && dataOrError.message.trim() && dataOrError.message !== '[object Object]') {
      return extractErrorMessage(dataOrError.message, statusCode);
    }

    // 3. Jika dataOrError itu sendiri adalah objek error (misal exception yang ditangkap di catch)
    if (typeof dataOrError === 'object') {
      if (typeof dataOrError.message === 'string' && dataOrError.message.trim() && dataOrError.message !== '[object Object]') {
        return extractErrorMessage(dataOrError.message, statusCode);
      }
      if (typeof dataOrError.error === 'string' && dataOrError.error.trim() && dataOrError.error !== '[object Object]') {
        return extractErrorMessage(dataOrError.error, statusCode);
      }
    }

    // Fallback parsing aman komprehensif
    return extractErrorMessage(dataOrError, statusCode);
  };

  /**
   * Eksekusi Pembangkitan Soal AI:
   * - Jika total soal <= 15: Berjalan dalam 1 request tunggal (alur asli dipertahankan).
   * - Jika total soal > 15: Berjalan dalam Sequential Batching (setiap batch maksimal 15 butir).
   * - Parameter startIndex memungkinkan mencoba kembali (retry) HANYA batch yang gagal tanpa mengulang batch yang berhasil.
   */
  const handleExecuteAiGeneration = async (startIndex: number = 0) => {
    const pkg = buildPackageObject();
    setIsGenerating(true);
    setGenerationError(null);
    setFailedBatchIndex(null);

    // KASUS 1: Total soal <= 15 butir (Alur Asli Tunggal)
    if (batchPlan.length <= 1) {
      setBatchProgress(null);
      setGenerationStage('Menghubungkan ke server dan model Gemini AI...');

      const controller = new AbortController();
      abortControllerRef.current = controller;

      // Timeout keamanan di sisi klien (58 detik, tepat sebelum batas Vercel Hobby 60 detik)
      const clientTimeoutTimer = setTimeout(() => {
        controller.abort();
      }, 58000);

      const stageTimer1 = setTimeout(() => {
        setGenerationStage('Menyusun butir pertanyaan, stimulus kontekstual MI, dan opsi jawaban...');
      }, 2500);

      const stageTimer2 = setTimeout(() => {
        setGenerationStage('Memvalidasi kunci jawaban, pembahasan guru, dan rubrik penskoran...');
      }, 6000);

      const stageTimer3 = setTimeout(() => {
        setGenerationStage('Model AI sedang memformulasikan naskah asesmen lengkap...');
      }, 12000);

      const stageTimer4 = setTimeout(() => {
        setGenerationStage('Tahap akhir penyusunan naskah asesmen dan verifikasi kelayakan Kurikulum Merdeka...');
      }, 22000);

      const cleanupTimers = () => {
        clearTimeout(clientTimeoutTimer);
        clearTimeout(stageTimer1);
        clearTimeout(stageTimer2);
        clearTimeout(stageTimer3);
        clearTimeout(stageTimer4);
      };

      try {
        const response = await fetch('/api/generate-questions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(pkg),
          signal: controller.signal,
        });

        cleanupTimers();

        const contentType = response.headers.get('content-type') || '';
        const rawText = await response.text();

        if (contentType.includes('text/html') || rawText.trim().startsWith('<')) {
          if (response.status === 404) {
            throw new Error('Endpoint API /api/generate-questions tidak ditemukan (HTTP 404). Pastikan server backend Vercel aktif.');
          } else if (response.status === 502 || response.status === 504) {
            throw new Error(`Server gateway mengalami batas waktu (HTTP ${response.status}). Coba kurangi jumlah butir soal lalu ulangi.`);
          } else {
            throw new Error(`Server mengembalikan respons halaman web (HTTP ${response.status}) alih-alih data JSON.`);
          }
        }

        if (!rawText.trim()) {
          throw new Error(`Server mengembalikan respons kosong (HTTP ${response.status}).`);
        }

        let data: any;
        try {
          data = JSON.parse(rawText);
        } catch {
          throw new Error(`Gagal membaca respons dari server (HTTP ${response.status}): Format data tidak valid.`);
        }

        if (!response.ok || !data.success) {
          const safeErrorMessage = parseApiErrorResponse(data, response.status);
          throw new Error(safeErrorMessage);
        }

        if (!Array.isArray(data.questions) || data.questions.length === 0) {
          throw new Error('Tidak ada butir soal yang berhasil digenerate.');
        }

        const updatedPackage: QuestionPackage = {
          ...pkg,
          title: data.packageTitle || pkg.title,
          questions: autoNumberQuestions(data.questions),
          status: 'completed',
          updatedAt: new Date().toISOString(),
        };

        setIsGenerating(false);
        setShowConfirmModal(false);

        if (onOpenEditor) {
          onOpenEditor(updatedPackage);
        } else {
          onSave(updatedPackage, true);
        }
      } catch (err: any) {
        cleanupTimers();

        if (err.name === 'AbortError') {
          setGenerationError('Waktu pemrosesan melebihi batas waktu tunggu (timeout). Coba kurangi jumlah butir soal per sesi atau buat per bab.');
        } else {
          const safeError = parseApiErrorResponse(err);
          setGenerationError(safeError);

          const lowerErr = (safeError + ' ' + (err?.message || '')).toLowerCase();
          if (
            lowerErr.includes('429') ||
            lowerErr.includes('kuota') ||
            lowerErr.includes('quota') ||
            lowerErr.includes('frekuensi') ||
            lowerErr.includes('resource_exhausted')
          ) {
            setRetryCountdown(45);
          }
        }
        setIsGenerating(false);
      }
      return;
    }

    // KASUS 2: Total soal > 15 butir (Sequential Batching)
    let currentAccumulator: QuestionItem[] = startIndex === 0 ? [] : [...accumulatedBatchQuestions];
    let latestPackageTitle = batchPackageTitle || pkg.title;

    for (let i = startIndex; i < batchPlan.length; i++) {
      const batch = batchPlan[i];
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // Timeout aman per batch (50 detik, cukup lapang untuk 15 soal yang rata-rata selesai dalam 15-20 detik)
      const batchTimeout = setTimeout(() => {
        controller.abort();
      }, 50000);

      const doneCount = currentAccumulator.length;
      const initialPercent = Math.min(95, Math.round((doneCount / totalQuestions) * 100));

      setBatchProgress({
        totalBatches: batchPlan.length,
        currentBatchIndex: i,
        completedBatches: i,
        totalTargetQuestions: totalQuestions,
        generatedQuestionsCount: doneCount,
        currentBatchDescription: batch.description,
        stageMessage: `Sedang menyusun Batch ${batch.batchNumber} dari ${batchPlan.length} (${batch.description})...`,
        percent: initialPercent,
      });

      setGenerationStage(
        `Batch ${batch.batchNumber} dari ${batchPlan.length}: Menyusun ${batch.description} (${doneCount}/${totalQuestions} butir selesai)...`
      );

      try {
        const batchPkg: QuestionPackage = {
          ...pkg,
          multipleChoiceCount: batch.multipleChoiceCount,
          complexMultipleChoiceCount: batch.complexMultipleChoiceCount,
          shortAnswerCount: batch.shortAnswerCount,
          essayCount: batch.essayCount,
          additionalNotes: pkg.additionalNotes
            ? `${pkg.additionalNotes} (Bagian ${batch.batchNumber} dari ${batchPlan.length}: ${batch.description})`
            : `(Bagian ${batch.batchNumber} dari ${batchPlan.length}: ${batch.description})`,
        };

        const response = await fetch('/api/generate-questions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(batchPkg),
          signal: controller.signal,
        });

        clearTimeout(batchTimeout);

        const contentType = response.headers.get('content-type') || '';
        const rawText = await response.text();

        if (contentType.includes('text/html') || rawText.trim().startsWith('<')) {
          if (response.status === 404) {
            throw new Error(`Endpoint API /api/generate-questions tidak ditemukan (HTTP 404). Pastikan server backend Vercel aktif.`);
          } else if (response.status === 502 || response.status === 504) {
            throw new Error(`Server gateway mengalami batas waktu (HTTP ${response.status}) pada Batch ${batch.batchNumber}.`);
          } else {
            throw new Error(`Server mengembalikan respons halaman web (HTTP ${response.status}) pada Batch ${batch.batchNumber}.`);
          }
        }

        if (!rawText.trim()) {
          throw new Error(`Server mengembalikan respons kosong (HTTP ${response.status}) pada Batch ${batch.batchNumber}.`);
        }

        let data: any;
        try {
          data = JSON.parse(rawText);
        } catch {
          throw new Error(`Gagal membaca respons dari server (HTTP ${response.status}) pada Batch ${batch.batchNumber}: Format data tidak valid.`);
        }

        if (!response.ok || !data.success) {
          const safeErrorMessage = parseApiErrorResponse(data, response.status);
          throw new Error(safeErrorMessage);
        }

        if (!Array.isArray(data.questions) || data.questions.length === 0) {
          throw new Error(`Tidak ada butir soal yang berhasil digenerate pada Batch ${batch.batchNumber}.`);
        }

        if (data.questions.length !== batch.totalQuestions) {
          throw new Error(
            `Jumlah butir soal Batch ${batch.batchNumber} tidak sesuai. Diharapkan ${batch.totalQuestions} butir, model menghasilkan ${data.questions.length} butir.`
          );
        }

        if (data.packageTitle) {
          latestPackageTitle = data.packageTitle;
          setBatchPackageTitle(data.packageTitle);
        }

        // Akumulasi butir soal secara sekuensial
        currentAccumulator = [...currentAccumulator, ...data.questions];
        setAccumulatedBatchQuestions(currentAccumulator);

        const updatedDoneCount = currentAccumulator.length;
        const isAllDone = i === batchPlan.length - 1;

        setBatchProgress({
          totalBatches: batchPlan.length,
          currentBatchIndex: isAllDone ? i : i + 1,
          completedBatches: i + 1,
          totalTargetQuestions: totalQuestions,
          generatedQuestionsCount: updatedDoneCount,
          currentBatchDescription: isAllDone ? 'Semua Batch Selesai' : batchPlan[i + 1]?.description || '',
          stageMessage: isAllDone
            ? `Seluruh ${updatedDoneCount} dari ${totalQuestions} butir soal selesai disusun!`
            : `Batch ${batch.batchNumber} selesai (${updatedDoneCount}/${totalQuestions} butir). Menyiapkan Batch ${batch.batchNumber + 1}...`,
          percent: isAllDone ? 100 : Math.min(95, Math.round((updatedDoneCount / totalQuestions) * 100)),
        });

      } catch (batchErr: any) {
        clearTimeout(batchTimeout);
        setFailedBatchIndex(i);
        setIsGenerating(false);

        let errorMsg = '';
        if (batchErr.name === 'AbortError') {
          errorMsg = `Waktu pemrosesan Batch ${batch.batchNumber} (${batch.description}) melebihi batas waktu tunggu server (50 detik).`;
        } else {
          errorMsg = parseApiErrorResponse(batchErr);
        }

        const fullErrMsg = `Batch ${batch.batchNumber} dari ${batchPlan.length} (${batch.description}) gagal: ${errorMsg}`;
        setGenerationError(fullErrMsg);

        const lowerErr = (fullErrMsg + ' ' + (batchErr?.message || '')).toLowerCase();
        if (
          lowerErr.includes('429') ||
          lowerErr.includes('kuota') ||
          lowerErr.includes('quota') ||
          lowerErr.includes('frekuensi') ||
          lowerErr.includes('resource_exhausted')
        ) {
          setRetryCountdown(45);
        }
        return; // Hentikan batch berikutnya seketika
      }
    }

    // Seluruh batch berhasil!
    // Gabungkan, pastikan ID unik tanpa duplikasi, dan beri penomoran berurutan 1..N
    const seenIds = new Set<string>();
    const sanitizedQuestions: QuestionItem[] = currentAccumulator.map((q, idx) => {
      const itemNumber = idx + 1;
      let id = q.id;
      if (!id || seenIds.has(id)) {
        id = `q_${Date.now()}_${itemNumber}_${Math.random().toString(36).substring(2, 6)}`;
      }
      seenIds.add(id);

      let newCaption = q.imageCaption;
      if (newCaption && /^Gambar Soal Nomor \d+$/i.test(newCaption.trim())) {
        newCaption = `Gambar Soal Nomor ${itemNumber}`;
      }

      return {
        ...q,
        id,
        number: itemNumber,
        imageCaption: newCaption,
      };
    });

    const updatedPackage: QuestionPackage = {
      ...pkg,
      title: latestPackageTitle || pkg.title,
      questions: sanitizedQuestions,
      status: 'completed',
      updatedAt: new Date().toISOString(),
    };

    setIsGenerating(false);
    setShowConfirmModal(false);
    setBatchProgress(null);
    setAccumulatedBatchQuestions([]);
    setFailedBatchIndex(null);

    if (onOpenEditor) {
      onOpenEditor(updatedPackage);
    } else {
      onSave(updatedPackage, true);
    }
  };
  const handleReset = () => {
    if (window.confirm('Apakah Anda yakin ingin mengatur ulang seluruh isian formulir?')) {
      setTitle('');
      setTopic('');
      setLearningObjectives('');
      setMultipleChoiceCount(15);
      setComplexMultipleChoiceCount(5);
      setMcOptionCount(4);
      setHasManuallySetOptionCount(false);
      setShortAnswerCount(5);
      setEssayCount(5);
      setSourceMaterial('');
      setAdditionalNotes('');
      setValidationErrors([]);
      setIsDirty(false);
    }
  };

  const handleCancel = () => {
    if (isDirty) {
      if (
        window.confirm(
          'Terdapat perubahan pada formulir yang belum disimpan. Yakin ingin kembali ke Dashboard?'
        )
      ) {
        onNavigate('dashboard');
      }
    } else {
      onNavigate('dashboard');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-150">
      {/* Top Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <button
            type="button"
            onClick={handleCancel}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-2 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Dashboard</span>
          </button>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {packageToEdit ? 'Edit Rancangan Paket Soal' : 'Formulir Pembuatan Paket Soal'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Susun identitas asesmen, materi Kurikulum Merdeka MI, dan rancangan komposisi butir soal.
          </p>
        </div>

        {/* Action Header Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
          >
            <RotateCcw className="w-4 h-4 text-slate-500" />
            <span>Reset Formulir</span>
          </button>

          <button
            type="button"
            onClick={handlePreviewDirectly}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-teal-300 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-semibold transition"
          >
            <Eye className="w-4 h-4 text-teal-600" />
            <span>Lihat Pratinjau</span>
          </button>

          <button
            type="button"
            onClick={() => handleSaveDraft(false)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold shadow-xs transition"
          >
            <Save className="w-4 h-4" />
            <span>Simpan sebagai Draf</span>
          </button>
        </div>
      </div>

      {/* Validation Error Banner */}
      {validationErrors.length > 0 && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs sm:text-sm animate-in fade-in">
          <div className="flex items-center gap-2 font-bold mb-1 text-rose-800">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Mohon lengkapi isian formulir yang diperlukan:</span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 pl-2 text-rose-700">
            {validationErrors.map((err, idx) => (
              <li key={idx}>{err.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* SECTION 1: IDENTITAS ASESMEN */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-700 text-white flex items-center justify-center font-bold text-sm">
              1
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Identitas Asesmen Madrasah</h2>
              <p className="text-xs text-slate-500">
                Informasi dasar madrasah, guru, kelas, dan mata pelajaran
              </p>
            </div>
          </div>

          {schoolProfile && (
            <button
              type="button"
              onClick={handleAutoFillProfile}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:text-teal-700 text-xs font-medium shadow-2xs transition"
            >
              <School className="w-3.5 h-3.5 text-teal-600" />
              <span>Gunakan Data Profil Madrasah</span>
            </button>
          )}
        </div>

        <div className="p-6 space-y-5">
          {/* Judul Paket Soal */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Judul Paket Soal <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setIsDirty(true);
              }}
              placeholder="Contoh: Asesmen Sumatif Akhir Semester (ASAS) Fikih Kelas 4 — Ketentuan Shalat"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm font-medium"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Judul ini memudahkan pencarian paket di Bank Soal.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Nama Madrasah */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Nama Madrasah <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={schoolName}
                onChange={(e) => {
                  setSchoolName(e.target.value);
                  setIsDirty(true);
                }}
                placeholder="Contoh: MI Al-Hidayah Jakarta"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
              />
            </div>

            {/* Nama Guru Penyusun */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Nama Guru Penyusun <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={teacherName}
                onChange={(e) => {
                  setTeacherName(e.target.value);
                  setIsDirty(true);
                }}
                placeholder="Contoh: Ust. Ahmad Fauzi, S.Pd.I"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Tahun Pelajaran */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Tahun Pelajaran <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={academicYear}
                onChange={(e) => {
                  setAcademicYear(e.target.value);
                  setIsDirty(true);
                }}
                placeholder="2024/2025"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
              />
            </div>

            {/* Semester */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Semester <span className="text-rose-500">*</span>
              </label>
              <select
                value={semester}
                onChange={(e) => {
                  setSemester(e.target.value as Semester);
                  setIsDirty(true);
                }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm bg-white"
              >
                <option value="Ganjil">Semester Ganjil</option>
                <option value="Genap">Semester Genap</option>
              </select>
            </div>

            {/* Alokasi Waktu */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Alokasi Waktu (Menit) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="300"
                  value={durationMinutes}
                  onChange={(e) => {
                    setDurationMinutes(Number(e.target.value));
                    setIsDirty(true);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm pr-16"
                />
                <span className="absolute right-3.5 top-2.5 text-xs text-slate-400 font-medium">
                  Menit
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Jenis Asesmen */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Jenis Asesmen <span className="text-rose-500">*</span>
              </label>
              <select
                value={assessmentType}
                onChange={(e) => {
                  setAssessmentType(e.target.value);
                  setIsDirty(true);
                }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm bg-white"
              >
                {ASSESSMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              {assessmentType === 'Lainnya' && (
                <input
                  type="text"
                  value={customAssessmentType}
                  onChange={(e) => {
                    setCustomAssessmentType(e.target.value);
                    setIsDirty(true);
                  }}
                  placeholder="Ketik jenis asesmen lainnya..."
                  className="mt-2 w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                />
              )}
            </div>

            {/* Mata Pelajaran */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Mata Pelajaran <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedSubject}
                onChange={(e) => {
                  setSelectedSubject(e.target.value);
                  setIsDirty(true);
                }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm bg-white font-medium"
              >
                {MI_SUBJECTS.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
              {selectedSubject === 'Lainnya' && (
                <input
                  type="text"
                  value={customSubject}
                  onChange={(e) => {
                    setCustomSubject(e.target.value);
                    setIsDirty(true);
                  }}
                  placeholder="Ketik nama mata pelajaran lainnya..."
                  className="mt-2 w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Kelas MI */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Tingkat Kelas MI <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-6 gap-2">
                {([1, 2, 3, 4, 5, 6] as Grade[]).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => {
                      setGrade(g);
                      setIsDirty(true);
                    }}
                    className={`py-2 rounded-xl text-xs font-bold border transition ${
                      grade === g
                        ? 'bg-teal-700 text-white border-teal-700 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    Kls {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Fase Kurikulum Merdeka (Otomatis) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Fase Kurikulum Merdeka
              </label>
              <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-teal-50/70 border border-teal-200 text-teal-900">
                <span className="text-sm font-bold">{phase}</span>
                <span className="text-xs text-teal-700">
                  (Otomatis berdasarkan Kelas {grade}: {grade === 1 || grade === 2 ? 'Kelas 1-2' : grade === 3 || grade === 4 ? 'Kelas 3-4' : 'Kelas 5-6'})
                </span>
              </div>
            </div>
          </div>

          {/* DAFTAR MATERI POKOK / BAB DAN TUJUAN PEMBELAJARAN (TP) */}
          <div className="space-y-4 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-teal-700" />
                  <span>Daftar Materi Pokok / Bab & Tujuan Pembelajaran (TP)</span>
                  <span className="text-rose-500">*</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Guru dapat memasukkan satu atau beberapa materi pokok/bab secara terpisah lengkap dengan Tujuan Pembelajaran (TP).
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddTopic}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-teal-600 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold shadow-2xs transition self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Materi Pokok / Bab & TP</span>
              </button>
            </div>

            <div className="space-y-4">
              {topics.map((tItem, tIdx) => (
                <div
                  key={tItem.id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50/90 transition space-y-3 relative"
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-teal-900 bg-teal-100/80 px-2.5 py-0.5 rounded-md">
                      Materi Pokok / Bab #{tIdx + 1}
                    </span>
                    {topics.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveTopic(tIdx)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-800 p-1 rounded-lg hover:bg-rose-50 transition"
                        title="Hapus bab ini"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus Bab</span>
                      </button>
                    )}
                  </div>

                  {/* Input Materi Pokok / Bab */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Materi Pokok / Bab <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={tItem.topic}
                      onChange={(e) => {
                        handleUpdateTopic(tIdx, { topic: e.target.value });
                        if (tIdx === 0) setTopic(e.target.value);
                      }}
                      placeholder="Contoh: Ketentuan Shalat Berjamaah dan Masbuq"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm bg-white"
                    />
                  </div>

                  {/* Input Tujuan Pembelajaran (TP) / Indikator Asesmen */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Tujuan Pembelajaran (TP) / Indikator Asesmen
                    </label>
                    <textarea
                      rows={2}
                      value={tItem.learningObjectives || ''}
                      onChange={(e) => {
                        handleUpdateTopic(tIdx, { learningObjectives: e.target.value });
                        if (tIdx === 0) setLearningObjectives(e.target.value);
                      }}
                      placeholder="Tuliskan tujuan pembelajaran yang hendak diukur, contoh:&#10;1. Peserta didik dapat memahami syarat sah shalat berjamaah.&#10;2. Peserta didik dapat mempraktikkan posisi makmum masbuq."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm leading-relaxed bg-white"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Tombol Cepat Tambah Materi di bagian bawah daftar */}
            <div className="pt-1">
              <button
                type="button"
                onClick={handleAddTopic}
                className="w-full py-2.5 rounded-xl border-2 border-dashed border-teal-300 hover:border-teal-500 bg-teal-50/40 hover:bg-teal-50/80 text-teal-800 text-xs font-bold flex items-center justify-center gap-2 transition"
              >
                <Plus className="w-4 h-4" />
                <span>+ Tambah Materi Pokok / Bab Berikutnya</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: PENGATURAN BUTIR SOAL */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-700 text-white flex items-center justify-center font-bold text-sm">
              2
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Pengaturan & Komposisi Butir Soal</h2>
              <p className="text-xs text-slate-500">
                Tentukan jumlah pilihan ganda, isian, uraian, dan tingkat kesulitan
              </p>
            </div>
          </div>

          {/* Total Soal Indicator Badge */}
          <div className="px-3.5 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold flex items-center gap-2 shadow-2xs">
            <span>Total:</span>
            <span className="text-teal-400 text-sm font-extrabold">{totalQuestions}</span>
            <span>Soal</span>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Menu Pilihan Jumlah Opsi Jawaban PG */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div>
                <label className="text-xs font-bold text-slate-800">
                  Pilihan Opsi Jawaban Pilihan Ganda (PG)
                </label>
                <p className="text-[11px] text-slate-500">
                  Pilih format opsi jawaban: 3 pilihan (A, B, C) atau 4 pilihan (A, B, C, D)
                </p>
              </div>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200 w-fit">
                {mcOptionCount === 3 ? '3 Opsi (A, B, C)' : '4 Opsi (A, B, C, D)'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Opsi 3: A, B, C */}
              <label
                className={`relative flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition ${
                  mcOptionCount === 3
                    ? 'bg-teal-50/80 border-teal-500 ring-1 ring-teal-500 shadow-2xs'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="mcOptionCount"
                  value={3}
                  checked={mcOptionCount === 3}
                  onChange={() => {
                    setMcOptionCount(3);
                    setHasManuallySetOptionCount(true);
                    setIsDirty(true);
                  }}
                  className="mt-0.5 text-teal-600 focus:ring-teal-500"
                />
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                    <span>3 Pilihan Jawaban (A, B, C)</span>
                    {grade <= 2 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-teal-200/70 text-teal-900">
                        Saran Kelas {grade}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    Format ringkas dengan 3 pilihan (A, B, C). Sangat sesuai untuk Fase A (Kelas 1–2) atau asesmen dasar madrasah.
                  </p>
                </div>
              </label>

              {/* Opsi 4: A, B, C, D */}
              <label
                className={`relative flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition ${
                  mcOptionCount === 4
                    ? 'bg-teal-50/80 border-teal-500 ring-1 ring-teal-500 shadow-2xs'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="mcOptionCount"
                  value={4}
                  checked={mcOptionCount === 4}
                  onChange={() => {
                    setMcOptionCount(4);
                    setHasManuallySetOptionCount(true);
                    setIsDirty(true);
                  }}
                  className="mt-0.5 text-teal-600 focus:ring-teal-500"
                />
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                    <span>4 Pilihan Jawaban (A, B, C, D)</span>
                    {grade >= 3 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-teal-200/70 text-teal-900">
                        Saran Kelas {grade}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    Format lengkap dengan 4 pilihan (A, B, C, D). Standar Kurikulum Merdeka untuk Fase B & C (Kelas 3–6) dan Asesmen Madrasah.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* MODEL / POLA KOMPOSISI BUTIR SOAL */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div>
                <label className="text-xs font-bold text-slate-800 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-teal-700" />
                  <span>Model Pola Komposisi Jenis Soal</span>
                </label>
                <p className="text-[11px] text-slate-500">
                  Pilih model instrumen evaluasi cepat atau sesuaikan jenis dan jumlah butir soal secara mandiri.
                </p>
              </div>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200 w-fit">
                {currentPreset === 'campuran_lengkap'
                  ? 'Campuran Lengkap (Standar AM)'
                  : currentPreset === 'campuran_klasik'
                  ? 'Campuran Klasik (PG, Isian & Uraian)'
                  : currentPreset === 'pg_uraian'
                  ? 'Pilihan Ganda & Uraian'
                  : currentPreset === 'pg_saja'
                  ? 'Objektif (PG Saja / CBT)'
                  : currentPreset === 'isian_uraian'
                  ? 'Non-Objektif (Isian & Uraian)'
                  : 'Kustom Mandiri'}
              </span>
            </div>

            {/* Tombol Preset Pilihan Model Soal */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              {/* Preset 1: Campuran Lengkap */}
              <button
                type="button"
                onClick={() => handleApplyPreset('campuran_lengkap')}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  currentPreset === 'campuran_lengkap'
                    ? 'bg-teal-700 text-white border-teal-700 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50/80'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider opacity-80">
                      Standar AM
                    </span>
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div className="font-bold text-xs leading-tight">Campuran Lengkap</div>
                </div>
                <div className={`text-[10px] mt-2 pt-1 border-t ${currentPreset === 'campuran_lengkap' ? 'border-teal-600/70 text-teal-100' : 'border-slate-100 text-slate-400'}`}>
                  PG, PGK, Isian & Uraian
                </div>
              </button>

              {/* Preset 2: Campuran Klasik */}
              <button
                type="button"
                onClick={() => handleApplyPreset('campuran_klasik')}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  currentPreset === 'campuran_klasik'
                    ? 'bg-teal-700 text-white border-teal-700 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50/80'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider opacity-80">
                      Klasik
                    </span>
                    <FileText className="w-3.5 h-3.5" />
                  </div>
                  <div className="font-bold text-xs leading-tight">PG, Isian & Uraian</div>
                </div>
                <div className={`text-[10px] mt-2 pt-1 border-t ${currentPreset === 'campuran_klasik' ? 'border-teal-600/70 text-teal-100' : 'border-slate-100 text-slate-400'}`}>
                  Tradisional MI (Tanpa PGK)
                </div>
              </button>

              {/* Preset 3: PG & Uraian */}
              <button
                type="button"
                onClick={() => handleApplyPreset('pg_uraian')}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  currentPreset === 'pg_uraian'
                    ? 'bg-teal-700 text-white border-teal-700 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50/80'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider opacity-80">
                      Ringkas
                    </span>
                    <CheckSquare className="w-3.5 h-3.5" />
                  </div>
                  <div className="font-bold text-xs leading-tight">PG & Uraian</div>
                </div>
                <div className={`text-[10px] mt-2 pt-1 border-t ${currentPreset === 'pg_uraian' ? 'border-teal-600/70 text-teal-100' : 'border-slate-100 text-slate-400'}`}>
                  Objektif & Esai Penilaian
                </div>
              </button>

              {/* Preset 4: Objektif Murni */}
              <button
                type="button"
                onClick={() => handleApplyPreset('pg_saja')}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  currentPreset === 'pg_saja'
                    ? 'bg-teal-700 text-white border-teal-700 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50/80'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider opacity-80">
                      CBT / Online
                    </span>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                  <div className="font-bold text-xs leading-tight">Pilihan Ganda Saja</div>
                </div>
                <div className={`text-[10px] mt-2 pt-1 border-t ${currentPreset === 'pg_saja' ? 'border-teal-600/70 text-teal-100' : 'border-slate-100 text-slate-400'}`}>
                  100% Pilihan Ganda & PGK
                </div>
              </button>

              {/* Preset 5: Non-Objektif */}
              <button
                type="button"
                onClick={() => handleApplyPreset('isian_uraian')}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  currentPreset === 'isian_uraian'
                    ? 'bg-teal-700 text-white border-teal-700 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50/80'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider opacity-80">
                      Nalar
                    </span>
                    <Edit3 className="w-3.5 h-3.5" />
                  </div>
                  <div className="font-bold text-xs leading-tight">Isian & Uraian</div>
                </div>
                <div className={`text-[10px] mt-2 pt-1 border-t ${currentPreset === 'isian_uraian' ? 'border-teal-600/70 text-teal-100' : 'border-slate-100 text-slate-400'}`}>
                  Evaluasi Tulis & Esai
                </div>
              </button>

              {/* Preset 6: Kustom */}
              <div
                className={`p-3 rounded-xl border text-left flex flex-col justify-between ${
                  currentPreset === 'kustom'
                    ? 'bg-teal-50 border-teal-500 text-teal-900 shadow-xs'
                    : 'bg-slate-50/60 border-slate-200 text-slate-500'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      Fleksibel
                    </span>
                    <Sliders className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                  <div className="font-bold text-xs leading-tight text-slate-800">Kustom Mandiri</div>
                </div>
                <div className="text-[10px] mt-2 pt-1 border-t border-slate-200/80 text-slate-400">
                  Kombinasi Bebas
                </div>
              </div>
            </div>

            {/* Skala Cepat Target Total Soal */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" />
                Target Total Soal:
              </span>
              {[10, 15, 20, 25, 30, 35, 40].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => handleScaleTotal(count)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition border ${
                    totalQuestions === count
                      ? 'bg-slate-800 text-white border-slate-800 shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {count} Soal
                </button>
              ))}
            </div>
          </div>

          {/* DAFTAR 4 KARTU JENIS SOAL */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800">
                Rincian Butir per Jenis Soal
              </label>
              <span className="text-[11px] text-slate-500">
                Centang/uncentang untuk mengaktifkan atau menonaktifkan jenis soal
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. Pilihan Ganda Biasa */}
              <div
                className={`p-4 rounded-xl border transition space-y-3 ${
                  multipleChoiceCount > 0
                    ? 'border-teal-300 bg-teal-50/30 ring-1 ring-teal-200/50'
                    : 'border-slate-200 bg-slate-50/60 opacity-75'
                }`}
              >
                <div className="flex items-center justify-between">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={multipleChoiceCount > 0}
                      onChange={(e) => {
                        setMultipleChoiceCount(e.target.checked ? 15 : 0);
                        setIsDirty(true);
                      }}
                      className="rounded text-teal-600 focus:ring-teal-500 h-4 w-4"
                    />
                    <span className="text-xs font-bold text-slate-900">PG Biasa</span>
                  </label>
                  <span className="text-[10px] font-bold text-teal-800 bg-teal-100/80 px-1.5 py-0.5 rounded border border-teal-200">
                    1 Kunci Benar
                  </span>
                </div>

                {multipleChoiceCount > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setMultipleChoiceCount(Math.max(0, multipleChoiceCount - 1));
                          setIsDirty(true);
                        }}
                        className="w-8 h-9 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm transition"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={multipleChoiceCount}
                        onChange={(e) => {
                          setMultipleChoiceCount(Math.max(0, parseInt(e.target.value) || 0));
                          setIsDirty(true);
                        }}
                        className="w-full text-center px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-base font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setMultipleChoiceCount(multipleChoiceCount + 1);
                          setIsDirty(true);
                        }}
                        className="w-8 h-9 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {mcOptionCount === 3 ? '3 opsi (A-C)' : '4 opsi (A-D)'} • 1 poin / butir
                    </p>
                  </div>
                ) : (
                  <div className="py-2.5 text-center">
                    <p className="text-[11px] text-slate-400 mb-2">Tidak disertakan (0 butir)</p>
                    <button
                      type="button"
                      onClick={() => {
                        setMultipleChoiceCount(15);
                        setIsDirty(true);
                      }}
                      className="px-2.5 py-1 text-xs font-bold text-teal-700 bg-white border border-teal-300 rounded-lg hover:bg-teal-50 transition shadow-2xs"
                    >
                      + Aktifkan PG Biasa
                    </button>
                  </div>
                )}
              </div>

              {/* 2. Pilihan Ganda Kompleks */}
              <div
                className={`p-4 rounded-xl border transition space-y-3 ${
                  complexMultipleChoiceCount > 0
                    ? 'border-indigo-300 bg-indigo-50/40 ring-1 ring-indigo-200/50'
                    : 'border-slate-200 bg-slate-50/60 opacity-75'
                }`}
              >
                <div className="flex items-center justify-between">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={complexMultipleChoiceCount > 0}
                      onChange={(e) => {
                        setComplexMultipleChoiceCount(e.target.checked ? 5 : 0);
                        setIsDirty(true);
                      }}
                      className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                    <span className="text-xs font-bold text-indigo-950">PG Kompleks</span>
                  </label>
                  <span className="text-[10px] font-bold text-indigo-800 bg-indigo-100/80 px-1.5 py-0.5 rounded border border-indigo-200">
                    2-3 Kunci Benar
                  </span>
                </div>

                {complexMultipleChoiceCount > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setComplexMultipleChoiceCount(Math.max(0, complexMultipleChoiceCount - 1));
                          setIsDirty(true);
                        }}
                        className="w-8 h-9 rounded-lg border border-indigo-200 bg-white hover:bg-indigo-50 text-indigo-800 flex items-center justify-center font-bold text-sm transition"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={complexMultipleChoiceCount}
                        onChange={(e) => {
                          setComplexMultipleChoiceCount(Math.max(0, parseInt(e.target.value) || 0));
                          setIsDirty(true);
                        }}
                        className="w-full text-center px-2 py-1.5 rounded-lg border border-indigo-300 bg-white text-base font-extrabold text-indigo-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setComplexMultipleChoiceCount(complexMultipleChoiceCount + 1);
                          setIsDirty(true);
                        }}
                        className="w-8 h-9 rounded-lg border border-indigo-200 bg-white hover:bg-indigo-50 text-indigo-800 flex items-center justify-center font-bold text-sm transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-[11px] text-indigo-700/80">
                      Multi-jawaban AKM/AM • 2-3 poin / butir
                    </p>
                  </div>
                ) : (
                  <div className="py-2.5 text-center">
                    <p className="text-[11px] text-slate-400 mb-2">Tidak disertakan (0 butir)</p>
                    <button
                      type="button"
                      onClick={() => {
                        setComplexMultipleChoiceCount(5);
                        setIsDirty(true);
                      }}
                      className="px-2.5 py-1 text-xs font-bold text-indigo-700 bg-white border border-indigo-300 rounded-lg hover:bg-indigo-50 transition shadow-2xs"
                    >
                      + Aktifkan PG Kompleks
                    </button>
                  </div>
                )}
              </div>

              {/* 3. Isian Singkat */}
              <div
                className={`p-4 rounded-xl border transition space-y-3 ${
                  shortAnswerCount > 0
                    ? 'border-amber-300 bg-amber-50/40 ring-1 ring-amber-200/50'
                    : 'border-slate-200 bg-slate-50/60 opacity-75'
                }`}
              >
                <div className="flex items-center justify-between">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={shortAnswerCount > 0}
                      onChange={(e) => {
                        setShortAnswerCount(e.target.checked ? 5 : 0);
                        setIsDirty(true);
                      }}
                      className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
                    />
                    <span className="text-xs font-bold text-slate-900">Isian Singkat</span>
                  </label>
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-100/80 px-1.5 py-0.5 rounded border border-amber-200">
                    Jawaban Langsung
                  </span>
                </div>

                {shortAnswerCount > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setShortAnswerCount(Math.max(0, shortAnswerCount - 1));
                          setIsDirty(true);
                        }}
                        className="w-8 h-9 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm transition"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={shortAnswerCount}
                        onChange={(e) => {
                          setShortAnswerCount(Math.max(0, parseInt(e.target.value) || 0));
                          setIsDirty(true);
                        }}
                        className="w-full text-center px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-base font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setShortAnswerCount(shortAnswerCount + 1);
                          setIsDirty(true);
                        }}
                        className="w-8 h-9 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Jawaban pasti • 2 poin / butir
                    </p>
                  </div>
                ) : (
                  <div className="py-2.5 text-center">
                    <p className="text-[11px] text-slate-400 mb-2">Tidak disertakan (0 butir)</p>
                    <button
                      type="button"
                      onClick={() => {
                        setShortAnswerCount(5);
                        setIsDirty(true);
                      }}
                      className="px-2.5 py-1 text-xs font-bold text-amber-700 bg-white border border-amber-300 rounded-lg hover:bg-amber-50 transition shadow-2xs"
                    >
                      + Aktifkan Isian Singkat
                    </button>
                  </div>
                )}
              </div>

              {/* 4. Uraian / Essay */}
              <div
                className={`p-4 rounded-xl border transition space-y-3 ${
                  essayCount > 0
                    ? 'border-purple-300 bg-purple-50/40 ring-1 ring-purple-200/50'
                    : 'border-slate-200 bg-slate-50/60 opacity-75'
                }`}
              >
                <div className="flex items-center justify-between">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={essayCount > 0}
                      onChange={(e) => {
                        setEssayCount(e.target.checked ? 5 : 0);
                        setIsDirty(true);
                      }}
                      className="rounded text-purple-600 focus:ring-purple-500 h-4 w-4"
                    />
                    <span className="text-xs font-bold text-slate-900">Uraian / Essay</span>
                  </label>
                  <span className="text-[10px] font-bold text-purple-800 bg-purple-100/80 px-1.5 py-0.5 rounded border border-purple-200">
                    Pedoman Rubrik
                  </span>
                </div>

                {essayCount > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEssayCount(Math.max(0, essayCount - 1));
                          setIsDirty(true);
                        }}
                        className="w-8 h-9 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm transition"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={essayCount}
                        onChange={(e) => {
                          setEssayCount(Math.max(0, parseInt(e.target.value) || 0));
                          setIsDirty(true);
                        }}
                        className="w-full text-center px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-base font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setEssayCount(essayCount + 1);
                          setIsDirty(true);
                        }}
                        className="w-8 h-9 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Nalar & penjelasan • 3-5 poin / butir
                    </p>
                  </div>
                ) : (
                  <div className="py-2.5 text-center">
                    <p className="text-[11px] text-slate-400 mb-2">Tidak disertakan (0 butir)</p>
                    <button
                      type="button"
                      onClick={() => {
                        setEssayCount(5);
                        setIsDirty(true);
                      }}
                      className="px-2.5 py-1 text-xs font-bold text-purple-700 bg-white border border-purple-300 rounded-lg hover:bg-purple-50 transition shadow-2xs"
                    >
                      + Aktifkan Uraian
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* VISUAL PROPORTION BAR */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/80 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-teal-700" />
                  <span>Distribusi Butir Soal & Bobot Penilaian:</span>
                </span>
                <span className="text-slate-600 font-semibold text-[11px]">
                  Estimasi Skor Maksimal: <strong className="text-teal-900 font-bold">{estimatedMaxScore} Poin</strong>
                </span>
              </div>

              {/* Progress Bar Segmented */}
              {totalQuestions > 0 ? (
                <div className="w-full h-3 rounded-full overflow-hidden flex bg-slate-200">
                  {multipleChoiceCount > 0 && (
                    <div
                      style={{ width: `${(multipleChoiceCount / totalQuestions) * 100}%` }}
                      className="bg-teal-600 h-full"
                      title={`PG Biasa: ${multipleChoiceCount} butir (${Math.round((multipleChoiceCount / totalQuestions) * 100)}%)`}
                    />
                  )}
                  {complexMultipleChoiceCount > 0 && (
                    <div
                      style={{ width: `${(complexMultipleChoiceCount / totalQuestions) * 100}%` }}
                      className="bg-indigo-600 h-full"
                      title={`PG Kompleks: ${complexMultipleChoiceCount} butir (${Math.round((complexMultipleChoiceCount / totalQuestions) * 100)}%)`}
                    />
                  )}
                  {shortAnswerCount > 0 && (
                    <div
                      style={{ width: `${(shortAnswerCount / totalQuestions) * 100}%` }}
                      className="bg-amber-500 h-full"
                      title={`Isian Singkat: ${shortAnswerCount} butir (${Math.round((shortAnswerCount / totalQuestions) * 100)}%)`}
                    />
                  )}
                  {essayCount > 0 && (
                    <div
                      style={{ width: `${(essayCount / totalQuestions) * 100}%` }}
                      className="bg-purple-600 h-full"
                      title={`Uraian: ${essayCount} butir (${Math.round((essayCount / totalQuestions) * 100)}%)`}
                    />
                  )}
                </div>
              ) : (
                <div className="w-full h-3 rounded-full bg-rose-200 flex items-center justify-center text-[10px] text-rose-800 font-bold">
                  Belum ada jenis soal yang diaktifkan
                </div>
              )}

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600 pt-0.5">
                {multipleChoiceCount > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-teal-600 inline-block" />
                    <span>PG: <strong>{multipleChoiceCount}</strong> ({Math.round((multipleChoiceCount / totalQuestions) * 100)}%)</span>
                  </span>
                )}
                {complexMultipleChoiceCount > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block" />
                    <span>PG Kompleks: <strong>{complexMultipleChoiceCount}</strong> ({Math.round((complexMultipleChoiceCount / totalQuestions) * 100)}%)</span>
                  </span>
                )}
                {shortAnswerCount > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                    <span>Isian: <strong>{shortAnswerCount}</strong> ({Math.round((shortAnswerCount / totalQuestions) * 100)}%)</span>
                  </span>
                )}
                {essayCount > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-600 inline-block" />
                    <span>Uraian: <strong>{essayCount}</strong> ({Math.round((essayCount / totalQuestions) * 100)}%)</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Tingkat Kesulitan */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Tingkat Kesulitan
              </label>
              <select
                value={difficulty}
                onChange={(e) => {
                  setDifficulty(e.target.value as DifficultyLevel);
                  setIsDirty(true);
                }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm bg-white font-medium"
              >
                <option value="Campuran">Campuran (Mudah, Sedang, Sulit / HOTS)</option>
                <option value="Mudah">Dominan Mudah (Level Kognitif C1 - C2)</option>
                <option value="Sedang">Dominan Sedang (Level Kognitif C3 - C4)</option>
                <option value="Sulit">Dominan Sulit / Penalaran HOTS (Level Kognitif C4 - C6)</option>
              </select>
            </div>

            {/* Bahasa Soal */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Bahasa Pengantar Soal
              </label>
              <select
                value={language}
                onChange={(e) => {
                  setLanguage(e.target.value);
                  setIsDirty(true);
                }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm bg-white"
              >
                <option value="Bahasa Indonesia">Bahasa Indonesia</option>
                <option value="Bahasa Arab">Bahasa Arab (untuk Mapel Bahasa Arab / PAI)</option>
                <option value="Bahasa Inggris">Bahasa Inggris</option>
                <option value="Lainnya">Bahasa Daerah / Lainnya</option>
              </select>
              {language === 'Lainnya' && (
                <input
                  type="text"
                  value={customLanguage}
                  onChange={(e) => {
                    setCustomLanguage(e.target.value);
                    setIsDirty(true);
                  }}
                  placeholder="Ketik bahasa pengantar lainnya (misal: Bahasa Jawa, Bahasa Sunda)..."
                  className="mt-2 w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                />
              )}
            </div>
          </div>

          {/* Sumber Materi / Ringkasan Acuan */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Sumber Materi / Ringkasan Materi Acuan
            </label>
            <textarea
              rows={3}
              value={sourceMaterial}
              onChange={(e) => {
                setSourceMaterial(e.target.value);
                setIsDirty(true);
              }}
              placeholder="Contoh acuan materi: Buku Siswa Fikih MI Kelas 4 Kemenag RI 2020 Bab 3, dalil hadis tentang keutamaan shalat berjamaah 27 derajat, dan ketentuan imam masbuq."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm leading-relaxed"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Dapat mencakup halaman buku, dalil, teks bacaan, atau poin inti konsep yang diujikan.
            </p>
          </div>

          {/* Catatan Tambahan */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Catatan Khusus Penyusunan Soal
            </label>
            <textarea
              rows={2}
              value={additionalNotes}
              onChange={(e) => {
                setAdditionalNotes(e.target.value);
                setIsDirty(true);
              }}
              placeholder="Contoh: Sertakan stimulus berupa cerita pendek atau gambar denah shaf shalat berjamaah untuk soal nomor 1-5."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm leading-relaxed"
            />
          </div>

          {/* Pilihan Kebutuhan Gambar */}
          <div className="pt-4 border-t border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3">
              <div>
                <label className="block text-xs font-bold text-slate-800">
                  Kebutuhan Gambar Soal
                </label>
                <p className="text-[11px] text-slate-500">
                  Pilih opsi stimulus visual gambar untuk butir soal yang akan disusun
                </p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 w-fit">
                {imageMode === 'none'
                  ? 'Tanpa Gambar'
                  : imageMode === 'manual'
                  ? 'Unggahan Guru'
                  : imageMode === 'ai'
                  ? 'Otomatis AI'
                  : 'Kombinasi Guru & AI'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* 1. Tanpa Gambar */}
              <label
                className={`relative flex flex-col justify-between p-4 rounded-xl border cursor-pointer transition ${
                  imageMode === 'none'
                    ? 'bg-teal-50/70 border-teal-500 ring-1 ring-teal-500 shadow-2xs'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                      <BookOpen className="w-4 h-4 text-slate-600" />
                      <span>1. Tanpa Gambar</span>
                    </div>
                    <input
                      type="radio"
                      name="imageMode"
                      value="none"
                      checked={imageMode === 'none'}
                      onChange={() => {
                        setImageMode('none');
                        setIsDirty(true);
                      }}
                      className="text-teal-600 focus:ring-teal-500"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Soal dibuat dalam bentuk teks murni tanpa stimulus visual (cocok untuk ujian tertulis biasa).
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                  <span>Format: Teks murni</span>
                  <span className="font-semibold text-slate-700">Praktis & Cepat</span>
                </div>
              </label>

              {/* 2. Unggah Gambar Sendiri */}
              <label
                className={`relative flex flex-col justify-between p-4 rounded-xl border cursor-pointer transition ${
                  imageMode === 'manual'
                    ? 'bg-sky-50/70 border-sky-500 ring-1 ring-sky-500 shadow-2xs'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                      <Upload className="w-4 h-4 text-sky-600" />
                      <span>2. Unggah Gambar Sendiri</span>
                    </div>
                    <input
                      type="radio"
                      name="imageMode"
                      value="manual"
                      checked={imageMode === 'manual'}
                      onChange={() => {
                        setImageMode('manual');
                        setIsDirty(true);
                      }}
                      className="text-sky-600 focus:ring-sky-500"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Guru dapat mengunggah file JPG, JPEG, PNG, atau WEBP secara mandiri di Editor Soal tanpa biaya API.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                  <span className="text-slate-500">JPG, PNG, WEBP</span>
                  <span className="font-bold text-sky-700 bg-sky-100/80 px-1.5 py-0.5 rounded">Bebas Biaya API</span>
                </div>
              </label>

              {/* 3. Generate Gambar dengan AI */}
              <label
                className={`relative flex flex-col justify-between p-4 rounded-xl border cursor-pointer transition ${
                  imageMode === 'ai' || imageMode === 'both'
                    ? 'bg-teal-50/70 border-teal-500 ring-1 ring-teal-500 shadow-2xs'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                      <Wand2 className="w-4 h-4 text-teal-600" />
                      <span>3. Generate Gambar AI</span>
                    </div>
                    <input
                      type="radio"
                      name="imageMode"
                      value="ai"
                      checked={imageMode === 'ai' || imageMode === 'both'}
                      onChange={() => {
                        setImageMode('ai');
                        setIsDirty(true);
                      }}
                      className="text-teal-600 focus:ring-teal-500"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Google AI membuat stimulus visual edukatif. Jika billing belum aktif, soal teks tetap sukses terbuat dan guru dapat mengunggah manual.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                  <span className="text-slate-500">Google Imagen AI</span>
                  <span className="font-bold text-teal-800 bg-teal-100/80 px-1.5 py-0.5 rounded">Perlu Billing</span>
                </div>
              </label>
            </div>

            {/* Catatan Panduan Gambar */}
            {imageMode === 'ai' && (
              <div className="mt-3 p-3 rounded-xl bg-teal-50/80 border border-teal-200 text-xs text-teal-900 flex items-start gap-2 leading-relaxed">
                <Info className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                <div>
                  <strong>Keterangan Layanan AI:</strong> Layanan pembuatan gambar Google AI memerlukan API Key dengan penagihan aktif (Pay-as-you-go). Apabila billing belum aktif pada akun Google Cloud Anda, proses pembuatan soal teks <strong>tidak akan gagal</strong>; Anda tetap mendapatkan soal teks lengkap dan dapat melampirkan gambar secara manual di Editor Soal.
                </div>
              </div>
            )}

            {/* Pengaturan Peletakan Gambar Soal */}
            {imageMode !== 'none' && (
              <div className="mt-4 p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-800">
                    Posisi Standar Peletakan Gambar Soal
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Tentukan posisi penempatan stimulus visual pada lembar soal (dapat diubah kembali per butir soal di Editor)
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Opsi 1: Di Bawah Soal */}
                  <label
                    className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
                      defaultImagePosition === 'below_question'
                        ? 'bg-teal-50 border-teal-500 ring-1 ring-teal-500 shadow-2xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="defaultImagePosition"
                      value="below_question"
                      checked={defaultImagePosition === 'below_question'}
                      onChange={() => {
                        setDefaultImagePosition('below_question');
                        setIsDirty(true);
                      }}
                      className="mt-0.5 text-teal-600 focus:ring-teal-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">
                        Di Bawah Soal (Antara Kalimat & Pilihan)
                      </span>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        Teks pertanyaan diletakkan di atas, diikuti gambar stimulus di tengah, lalu opsi jawaban A/B/C/D atau titik isian.
                      </p>
                    </div>
                  </label>

                  {/* Opsi 2: Di Atas Soal */}
                  <label
                    className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
                      defaultImagePosition === 'above_question'
                        ? 'bg-teal-50 border-teal-500 ring-1 ring-teal-500 shadow-2xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="defaultImagePosition"
                      value="above_question"
                      checked={defaultImagePosition === 'above_question'}
                      onChange={() => {
                        setDefaultImagePosition('above_question');
                        setIsDirty(true);
                      }}
                      className="mt-0.5 text-teal-600 focus:ring-teal-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">
                        Di Atas Soal (Stimulus Sebelum Kalimat)
                      </span>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        Gambar stimulus diletakkan di bagian paling atas sebelum teks kalimat pertanyaan (misal untuk petunjuk "Perhatikan gambar berikut!").
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI GENERATOR ACTIVE FEATURE SECTION (Tahap 2) */}
      <div className="bg-gradient-to-r from-teal-900 via-slate-900 to-teal-950 text-white rounded-2xl p-6 border border-teal-700/50 shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Pembangkitan Soal Otomatis (Gemini AI)</span>
            </div>
            <h3 className="text-lg font-bold text-white tracking-tight">
              Buat Butir Soal, Kunci Jawaban & Rubrik Otomatis
            </h3>
            <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
              Model Google Gemini akan menyusun <strong>{totalQuestions} butir soal</strong> ({multipleChoiceCount} PG, {shortAnswerCount} Isian, {essayCount} Uraian) sesuai materi pokok &quot;{topic || 'yang ditentukan'}&quot; lengkap dengan kunci jawaban, pembahasan guru, serta matriks indikator capaian.
            </p>

            {packageToEdit?.questions && packageToEdit.questions.length > 0 && (
              <div className="pt-1 flex items-center gap-2 text-xs text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Paket ini telah memiliki <strong>{packageToEdit.questions.length} butir soal</strong> tersimpan.
                </span>
                {onOpenEditor && (
                  <button
                    type="button"
                    onClick={() => onOpenEditor(packageToEdit)}
                    className="underline font-bold hover:text-white ml-1"
                  >
                    Buka Editor Soal
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="shrink-0 flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleOpenAiConfirmation}
              disabled={isGenerating}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-teal-500/30 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-4 h-4 text-slate-950" />
              <span>Generate Soal dengan AI</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Sticky Action Bar */}
      <div className="sticky bottom-4 z-20 bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-slate-200 shadow-xl flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-500 flex items-center gap-2">
          <Info className="w-4 h-4 text-slate-400" />
          <span>
            Paket tersimpan di peramban lokal sebagai <strong>{packageToEdit?.status === 'completed' ? 'Paket Asesmen Lengkap' : 'Draf Asesmen'}</strong>.
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handlePreviewDirectly}
            className="px-4 py-2 rounded-xl border border-teal-300 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-semibold transition"
          >
            Pratinjau Naskah
          </button>

          <button
            type="button"
            onClick={() => handleSaveDraft(false)}
            className="px-5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold shadow-xs transition inline-flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>Simpan Draf</span>
          </button>
        </div>
      </div>

      {/* Modal Konfirmasi & Progres Pembangkitan AI */}
      {showConfirmModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="relative w-full max-w-lg max-h-[92vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-start justify-between px-6 pt-5 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-teal-100 text-teal-800">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    Konfirmasi Pembangkitan Soal AI
                  </h3>
                  <p className="text-xs text-slate-500">
                    Model: Gemini AI (Kurikulum Merdeka MI Kemenag RI)
                  </p>
                </div>
              </div>
              {!isGenerating && (
                <button
                  type="button"
                  onClick={handleCancelAiGeneration}
                  className="text-slate-400 hover:text-slate-600 text-xs font-bold p-1 rounded-lg hover:bg-slate-100 transition"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 space-y-4 overflow-y-auto">
              {/* Rincian Permintaan */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                <div className="grid grid-cols-2 gap-2 text-slate-700">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Mata Pelajaran:</span>
                    <strong>{effectiveSubject}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Kelas & Fase:</span>
                    <strong>Kelas {grade} ({phase})</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Materi Pokok:</span>
                    <strong className="truncate block">{topic}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Target Soal:</span>
                    <strong className="text-teal-700 font-extrabold">
                      {totalQuestions} Butir (PG: {multipleChoiceCount}{complexMultipleChoiceCount > 0 ? `, PGK: ${complexMultipleChoiceCount}` : ''}, Isian: {shortAnswerCount}, Uraian: {essayCount})
                    </strong>
                  </div>
                  <div className="col-span-2 pt-1 border-t border-slate-200 flex items-center justify-between">
                    <span className="text-slate-500 text-[11px]">Format Opsi PG:</span>
                    <strong className="text-slate-800 text-[11px]">
                      {mcOptionCount === 3 ? '3 Pilihan (A, B, C)' : '4 Pilihan (A, B, C, D)'}
                    </strong>
                  </div>
                  <div className="col-span-2 pt-1 border-t border-slate-200 flex items-center justify-between">
                    <span className="text-slate-500 text-[11px]">Kebutuhan Gambar:</span>
                    <span className="font-bold text-teal-800 bg-teal-100/80 px-2 py-0.5 rounded text-[11px]">
                      {imageMode === 'none'
                        ? 'Tanpa Gambar'
                        : imageMode === 'manual'
                        ? 'Gambar Unggahan Guru'
                        : imageMode === 'ai'
                        ? 'Gambar Otomatis AI'
                        : 'Kombinasi Guru & AI'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Rincian Sequential Batching Otomatis untuk Paket > 15 Soal */}
              {batchPlan.length > 1 && !isGenerating && (
                <div className="p-3.5 rounded-xl bg-teal-50/90 border border-teal-200 text-teal-950 text-xs space-y-2 shadow-2xs">
                  <div className="flex items-center gap-1.5 font-bold text-teal-900">
                    <Sparkles className="w-3.5 h-3.5 text-teal-700" />
                    <span>Sequential Batching Otomatis ({batchPlan.length} Tahap):</span>
                  </div>
                  <p className="text-[11px] text-teal-800 leading-relaxed">
                    Karena Anda menyusun <strong>{totalQuestions} butir soal</strong>, sistem otomatis memprosesnya dalam <strong>{batchPlan.length} batch berurutan</strong> (maksimal 15 butir per batch) agar durasi setiap tahap hanya 15–20 detik dan terhindar dari batas waktu serverless (HTTP 504):
                  </p>
                  <div className="space-y-1 pt-0.5">
                    {batchPlan.map((b) => (
                      <div
                        key={b.batchIndex}
                        className="flex items-center justify-between bg-white/80 px-2.5 py-1.5 rounded-lg border border-teal-100 text-[11px]"
                      >
                        <span className="font-semibold text-teal-900">Batch {b.batchNumber}:</span>
                        <span className="text-slate-700">{b.description} ({b.totalQuestions} butir)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Peringatan Privasi dan Transmisi Data */}
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
                <strong>Pemberitahuan Transmisi:</strong> Data rancangan asesmen dan ringkasan materi di atas akan dikirimkan ke layanan Google Gemini melalui backend aplikasi ini untuk diproses menjadi butir soal. Tidak ada kunci API yang terpapar ke peramban.
              </div>

              {/* Error Message */}
              {generationError && (
                <div className="space-y-3">
                  {failedBatchIndex !== null && batchPlan[failedBatchIndex] ? (
                    <div className="p-4 rounded-xl bg-rose-50/90 border border-rose-300 text-rose-950 text-xs space-y-3 shadow-xs">
                      <div className="flex items-start gap-2.5">
                        <div className="p-1.5 rounded-lg bg-rose-200 text-rose-900 shrink-0 mt-0.5">
                          <AlertCircle className="w-4 h-4" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-bold text-rose-950 text-xs">
                            Batch {failedBatchIndex + 1} dari {batchPlan.length} Mengalami Kendala
                          </h4>
                          <p className="text-[11px] text-rose-900 leading-relaxed">
                            {generationError}
                          </p>
                          {accumulatedBatchQuestions.length > 0 && (
                            <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] space-y-1 mt-2">
                              <span className="font-bold flex items-center gap-1.5 text-emerald-800">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>{accumulatedBatchQuestions.length} Butir Soal Sebelumnya Tersimpan Aman</span>
                              </span>
                              <p className="text-[10.5px] text-emerald-700 leading-relaxed">
                                Anda dapat mengklik tombol <strong>&quot;Coba Lagi Batch {failedBatchIndex + 1} Saja&quot;</strong> tanpa mengulang batch yang sudah berhasil, atau langsung membuka Editor Soal dengan {accumulatedBatchQuestions.length} butir yang telah tersusun.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="pt-1 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleExecuteAiGeneration(failedBatchIndex)}
                          disabled={retryCountdown > 0}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 disabled:bg-slate-300 text-white font-bold text-xs transition shadow-xs"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>
                            {retryCountdown > 0
                              ? `Tunggu (${retryCountdown}s)`
                              : `Coba Lagi Batch ${failedBatchIndex + 1} Saja (${batchPlan[failedBatchIndex].description})`}
                          </span>
                        </button>

                        {accumulatedBatchQuestions.length > 0 && (
                          <button
                            type="button"
                            onClick={handleProceedWithPartialQuestions}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs transition shadow-xs"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Gunakan {accumulatedBatchQuestions.length} Soal & Buka Editor</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleExecuteAiGeneration(0)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition shadow-xs"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Ulangi dari Awal (Batch 1)</span>
                        </button>
                      </div>
                    </div>
                  ) : /429|kuota|quota|frekuensi|RESOURCE_EXHAUSTED/i.test(generationError) || retryCountdown > 0 ? (
                    <div className="p-4 rounded-xl bg-amber-50/90 border border-amber-300 text-amber-950 text-xs space-y-3 shadow-xs">
                      <div className="flex items-start gap-2.5">
                        <div className="p-1.5 rounded-lg bg-amber-200/80 text-amber-900 shrink-0 mt-0.5">
                          <AlertCircle className="w-4 h-4" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-bold text-amber-900 text-xs flex items-center gap-2">
                            <span>Batas Kuota / Frekuensi Terlampaui (HTTP 429)</span>
                            {retryCountdown > 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 text-[10px] font-mono font-bold animate-pulse">
                                Tunggu {retryCountdown} dtk
                              </span>
                            )}
                          </h4>
                          <p className="text-[11px] text-amber-800 leading-relaxed">
                            Layanan Gemini API (kuota gratis Google AI Studio) membatasi frekuensi pembuatan soal (15 permintaan/menit). Hal ini wajar saat server Vercel memproses naskah dengan rincian soal yang padat.
                          </p>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-amber-100/70 border border-amber-200/80 text-[11px] text-amber-900 space-y-1">
                        <strong>💡 Solusi Cepat untuk Guru:</strong>
                        <ul className="list-disc list-inside space-y-0.5 text-[10.5px] text-amber-800">
                          <li>Gunakan tombol <strong>&quot;Susun Mandiri di Editor Soal&quot;</strong> di bawah untuk langsung mengisi soal tanpa menunggu API.</li>
                          <li>Tunggu jeda cooldown selesai lalu klik <strong>&quot;Coba Lagi&quot;</strong> (sistem otomatis beralih ke model cadangan Gemini 2.0 / 1.5).</li>
                          <li>Untuk deploy produksi di Vercel, pastikan kunci API di Vercel memiliki tagihan aktif (Pay-as-you-go).</li>
                        </ul>
                      </div>

                      <div className="pt-1 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handleOpenManualEditor}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs transition shadow-xs"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Susun Mandiri di Editor Soal (Tanpa AI)</span>
                        </button>
                      </div>
                    </div>
                  ) : /timeout|timed out|60 detik|60 seconds|gateway|deadline/i.test(generationError) ? (
                    <div className="p-4 rounded-xl bg-orange-50/90 border border-orange-300 text-orange-950 text-xs space-y-3 shadow-xs">
                      <div className="flex items-start gap-2.5">
                        <div className="p-1.5 rounded-lg bg-orange-200/80 text-orange-900 shrink-0 mt-0.5">
                          <AlertCircle className="w-4 h-4" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-bold text-orange-900 text-xs">
                            Batas Waktu Serverless Terlampaui (Vercel 60 Detik)
                          </h4>
                          <p className="text-[11px] text-orange-800 leading-relaxed">
                            Hosting Vercel (paket gratis/Hobby) membatasi durasi eksekusi per permintaan maksimal 60 detik. Paket besar ({totalQuestions} butir soal) membutuhkan waktu komputasi ekstra sehingga melebihi batas tersebut.
                          </p>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-orange-100/70 border border-orange-200/80 text-[11px] text-orange-900 space-y-1">
                        <strong>💡 Solusi Cepat untuk Guru:</strong>
                        <ul className="list-disc list-inside space-y-0.5 text-[10.5px] text-orange-800">
                          <li>Klik tombol <strong>&quot;Ubah ke 15 Soal (Cepat)&quot;</strong> di bawah — paket 15 butir selesai dalam 8–12 detik tanpa risiko timeout.</li>
                          <li>Atau klik <strong>&quot;Susun Mandiri di Editor Soal&quot;</strong> untuk langsung mengisi template {totalQuestions} soal tanpa batasan waktu.</li>
                          <li>Jika butuh 25+ butir, buat 15 butir terlebih dahulu lalu tambahkan soal baru di Editor Soal.</li>
                        </ul>
                      </div>

                      <div className="pt-1 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            handleScaleTotal(15);
                            setGenerationError(null);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-700 hover:bg-orange-800 text-white font-bold text-xs transition shadow-xs"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          <span>Ubah ke 15 Soal & Coba Lagi</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleOpenManualEditor}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs transition shadow-xs"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Susun Mandiri di Editor Soal (Tanpa AI)</span>
                        </button>
                      </div>
                    </div>
                  ) : /no longer available|tidak tersedia|gemini-2\.0/i.test(generationError) ? (
                    <div className="p-4 rounded-xl bg-sky-50/90 border border-sky-300 text-sky-950 text-xs space-y-3 shadow-xs">
                      <div className="flex items-start gap-2.5">
                        <div className="p-1.5 rounded-lg bg-sky-200/80 text-sky-900 shrink-0 mt-0.5">
                          <RefreshCw className="w-4 h-4" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-bold text-sky-950 text-xs">
                            Pembaruan Model Google AI (gemini-3.8-flash)
                          </h4>
                          <p className="text-[11px] text-sky-900 leading-relaxed">
                            Model lawas (gemini-2.0-flash) telah dipensiunkan oleh Google AI. Sistem aplikasi telah otomatis diperbarui menggunakan model resmi terbaru <strong>gemini-3.8-flash</strong> yang lebih cepat dan cerdas.
                          </p>
                        </div>
                      </div>

                      <div className="pt-1 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setGenerationError(null);
                            handleExecuteAiGeneration();
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs transition shadow-xs"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Coba Lagi Sekarang (Model Terbaru)</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleOpenManualEditor}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition shadow-xs"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Susun Mandiri di Editor Soal</span>
                        </button>
                      </div>
                    </div>
                  ) : /503|lonjakan beban|overloaded|unavailable/i.test(generationError) ? (
                    <div className="p-4 rounded-xl bg-amber-50/90 border border-amber-300 text-amber-950 text-xs space-y-3 shadow-xs">
                      <div className="flex items-start gap-2.5">
                        <div className="p-1.5 rounded-lg bg-amber-200/80 text-amber-900 shrink-0 mt-0.5">
                          <RefreshCw className="w-4 h-4" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-bold text-amber-950 text-xs">
                            Server Google AI Sedang Mengalami Lonjakan Beban (HTTP 503)
                          </h4>
                          <p className="text-[11px] text-amber-800 leading-relaxed">
                            Layanan server Google AI di cloud sedang sibuk memproses antrean global. Lonjakan ini bersifat sementara dan biasanya reda dalam hitungan detik.
                          </p>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-amber-100/70 border border-amber-200/80 text-[11px] text-amber-900 space-y-1">
                        <strong>💡 Solusi Cepat untuk Guru:</strong>
                        <ul className="list-disc list-inside space-y-0.5 text-[10.5px] text-amber-800">
                          <li>Klik tombol <strong>&quot;Coba Lagi Sekarang&quot;</strong> — sistem otomatis mengalihkan ke model cadangan.</li>
                          <li>Atau klik <strong>&quot;Susun Mandiri di Editor Soal&quot;</strong> untuk langsung mengisi {totalQuestions} soal tanpa antrean server AI.</li>
                          <li>Jika server terus padat, Anda juga dapat mengklik <strong>&quot;Ubah ke 15 Soal&quot;</strong> agar beban pembuatan lebih ringan.</li>
                        </ul>
                      </div>

                      <div className="pt-1 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setGenerationError(null);
                            handleExecuteAiGeneration();
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs transition shadow-xs"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Coba Lagi Sekarang</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleOpenManualEditor}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition shadow-xs"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Susun Mandiri di Editor Soal</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            handleScaleTotal(15);
                            setGenerationError(null);
                            handleExecuteAiGeneration();
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition shadow-xs"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          <span>Ubah ke 15 Soal</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div className="leading-relaxed">
                        <strong>Pembangkitan Gagal:</strong> {generationError}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Progress Bar & Stage Indicator */}
              {isGenerating && (
                <div className="p-4 rounded-xl bg-teal-50/80 border border-teal-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-teal-950">
                      <Loader2 className="w-4 h-4 text-teal-600 animate-spin" />
                      <span>
                        {batchProgress
                          ? `Menyusun Soal (Batch ${batchProgress.currentBatchIndex + 1} dari ${batchProgress.totalBatches})`
                          : 'Sedang Memproses...'}
                      </span>
                    </div>
                    {batchProgress && (
                      <span className="text-xs font-extrabold text-teal-800 bg-teal-100/90 border border-teal-200 px-2 py-0.5 rounded-full">
                        {batchProgress.percent}%
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-teal-800 leading-relaxed">
                    {generationStage || 'Memproses permintaan pembuatan soal...'}
                  </p>

                  {/* Real Progress Bar */}
                  <div className="w-full bg-teal-200/60 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-teal-600 h-2 rounded-full transition-all duration-500 ease-out"
                      style={{
                        width: batchProgress
                          ? `${Math.max(6, batchProgress.percent)}%`
                          : '60%',
                      }}
                    />
                  </div>

                  {/* Batch Status Checklist (jika total soal > 15) */}
                  {batchPlan.length > 1 && (
                    <div className="pt-2 border-t border-teal-200/80 space-y-1.5">
                      <span className="text-[11px] font-bold text-teal-900 block">
                        Rincian Alur Batching (Batas Aman Serverless Vercel):
                      </span>
                      <div className="space-y-1">
                        {batchPlan.map((b, bIdx) => {
                          const isCompleted = (batchProgress?.completedBatches ?? 0) > bIdx;
                          const isCurrent = (batchProgress?.currentBatchIndex ?? 0) === bIdx && isGenerating;
                          return (
                            <div
                              key={bIdx}
                              className={`flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-lg transition-colors ${
                                isCompleted
                                  ? 'bg-emerald-100/70 text-emerald-900 font-semibold'
                                  : isCurrent
                                  ? 'bg-teal-100 text-teal-950 font-bold border border-teal-300'
                                  : 'bg-white/60 text-slate-500'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {isCompleted ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                ) : isCurrent ? (
                                  <Loader2 className="w-3.5 h-3.5 text-teal-700 animate-spin shrink-0" />
                                ) : (
                                  <span className="w-3.5 h-3.5 rounded-full border border-slate-300 inline-block shrink-0" />
                                )}
                                <span>
                                  Batch {b.batchNumber}: {b.description} ({b.totalQuestions} butir)
                                </span>
                              </div>
                              <span className="text-[10px] font-medium">
                                {isCompleted ? 'Selesai' : isCurrent ? 'Sedang Diproses...' : 'Menunggu Antrean'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Sticky Footer Actions */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
              <span className="text-[11px] text-slate-500 hidden sm:inline">
                {isGenerating
                  ? batchPlan.length > 1
                    ? `Memproses batch bertahap (aman dari timeout 60s)...`
                    : 'Mohon tunggu hingga selesai...'
                  : 'Pilih opsi di atas atau coba kembali.'}
              </span>

              <div className="flex items-center justify-end gap-2.5 ml-auto w-full sm:w-auto">
                {isGenerating ? (
                  <button
                    type="button"
                    onClick={handleCancelAiGeneration}
                    className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition"
                  >
                    Batalkan Proses
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleCancelAiGeneration}
                      className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExecuteAiGeneration(failedBatchIndex !== null ? failedBatchIndex : 0)}
                      disabled={retryCountdown > 0}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold text-xs shadow-md transition"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>
                        {retryCountdown > 0
                          ? `Coba Lagi (${retryCountdown}s)`
                          : failedBatchIndex !== null
                          ? `Coba Lagi Batch ${failedBatchIndex + 1}`
                          : generationError
                          ? 'Coba Lagi'
                          : batchPlan.length > 1
                          ? `Mulai Generate (${batchPlan.length} Batch Bertahap)`
                          : 'Mulai Generate Soal'}
                      </span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
