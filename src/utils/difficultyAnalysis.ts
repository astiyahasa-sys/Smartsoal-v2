import { QuestionItem, QuestionPackage, QuestionType } from '../types';

export type NormalizedDifficulty = 'Mudah' | 'Sedang' | 'Sulit';

export interface DifficultyStats {
  count: number;
  percentage: number;
  questionNumbers: number[];
  totalScore: number;
}

export interface TypeDifficultyBreakdown {
  type: QuestionType;
  label: string;
  total: number;
  mudah: number;
  sedang: number;
  sulit: number;
}

export interface PackageDifficultyAnalysis {
  totalQuestions: number;
  totalScore: number;
  mudah: DifficultyStats;
  sedang: DifficultyStats;
  sulit: DifficultyStats;
  ratioString: string;
  balanceStatus: {
    status: 'seimbang' | 'dominan_mudah' | 'dominan_sedang' | 'dominan_sulit' | 'belum_ada_soal';
    label: string;
    description: string;
    badgeClass: string;
  };
  byType: TypeDifficultyBreakdown[];
}

/**
 * Mengidentifikasi tingkat kesulitan butir soal secara konsisten berdasarkan
 * cognitiveLevel ('L1', 'L2', 'L3'), teks indikator, atau tipe butir soal.
 */
export function getQuestionDifficulty(q: QuestionItem): NormalizedDifficulty {
  const raw = `${q.cognitiveLevel || ''} ${q.indicator || ''}`.toUpperCase();

  // Prioritas deteksi Level Kognitif standar Kemenag / Taksonomi Bloom Revisi
  if (
    raw.includes('L3') ||
    raw.includes('HOTS') ||
    raw.includes('SULIT') ||
    raw.includes('SUKAR') ||
    raw.includes('PENALARAN') ||
    raw.includes('EVALUASI') ||
    raw.includes('KREASI')
  ) {
    return 'Sulit';
  }

  if (
    raw.includes('L2') ||
    raw.includes('SEDANG') ||
    raw.includes('MENERAPKAN') ||
    raw.includes('APLIKASI')
  ) {
    return 'Sedang';
  }

  if (
    raw.includes('L1') ||
    raw.includes('MUDAH') ||
    raw.includes('MENGINGAT') ||
    raw.includes('MEMAHAMI') ||
    raw.includes('PENGETAHUAN')
  ) {
    return 'Mudah';
  }

  // Heuristik fallback jika level kognitif tidak tercatat spesifik
  if (q.type === 'essay') return 'Sulit';
  if (q.type === 'complex_multiple_choice') return 'Sedang';
  return 'Mudah';
}

/**
 * Metadata visual lencana tingkat kesulitan (Mudah, Sedang, Sukar)
 */
export function getDifficultyBadge(diff: NormalizedDifficulty): {
  label: string;
  shortLabel: string;
  badgeClass: string;
  dotColor: string;
  cognitiveLevelDefault: string;
} {
  if (diff === 'Sulit') {
    return {
      label: 'Sukar / HOTS (L3)',
      shortLabel: 'Sukar',
      badgeClass: 'bg-purple-100 text-purple-900 border-purple-300',
      dotColor: 'bg-purple-600',
      cognitiveLevelDefault: 'L3 (Penalaran/HOTS)',
    };
  }
  if (diff === 'Sedang') {
    return {
      label: 'Sedang (L2)',
      shortLabel: 'Sedang',
      badgeClass: 'bg-sky-100 text-sky-900 border-sky-300',
      dotColor: 'bg-sky-500',
      cognitiveLevelDefault: 'L2 (Menerapkan)',
    };
  }
  return {
    label: 'Mudah (L1)',
    shortLabel: 'Mudah',
    badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    dotColor: 'bg-emerald-500',
    cognitiveLevelDefault: 'L1 (Mengingat/Memahami)',
  };
}

/**
 * Menghitung analisis statistik tingkat kesulitan butir soal secara komprehensif
 */
export function analyzePackageDifficulty(pkg: QuestionPackage): PackageDifficultyAnalysis {
  const questions = pkg.questions || [];
  const totalQuestions = questions.length;

  if (totalQuestions === 0) {
    return {
      totalQuestions: 0,
      totalScore: 0,
      mudah: { count: 0, percentage: 0, questionNumbers: [], totalScore: 0 },
      sedang: { count: 0, percentage: 0, questionNumbers: [], totalScore: 0 },
      sulit: { count: 0, percentage: 0, questionNumbers: [], totalScore: 0 },
      ratioString: '0% : 0% : 0%',
      balanceStatus: {
        status: 'belum_ada_soal',
        label: 'Belum Ada Butir Soal',
        description: 'Paket asesmen ini belum memiliki butir soal yang di-generate atau disusun.',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
      },
      byType: [],
    };
  }

  const mudahNumbers: number[] = [];
  const sedangNumbers: number[] = [];
  const sulitNumbers: number[] = [];

  let totalScore = 0;
  let mudahScore = 0;
  let sedangScore = 0;
  let sulitScore = 0;

  // Track breakdown by question type
  const typeMap: Record<QuestionType, { mudah: number; sedang: number; sulit: number; total: number }> = {
    multiple_choice: { mudah: 0, sedang: 0, sulit: 0, total: 0 },
    complex_multiple_choice: { mudah: 0, sedang: 0, sulit: 0, total: 0 },
    short_answer: { mudah: 0, sedang: 0, sulit: 0, total: 0 },
    essay: { mudah: 0, sedang: 0, sulit: 0, total: 0 },
  };

  questions.forEach((q) => {
    const diff = getQuestionDifficulty(q);
    const score = q.score || (q.type === 'essay' ? 4 : q.type === 'short_answer' ? 2 : q.type === 'complex_multiple_choice' ? 2 : 1);
    totalScore += score;

    if (diff === 'Mudah') {
      mudahNumbers.push(q.number);
      mudahScore += score;
    } else if (diff === 'Sedang') {
      sedangNumbers.push(q.number);
      sedangScore += score;
    } else {
      sulitNumbers.push(q.number);
      sulitScore += score;
    }

    if (typeMap[q.type]) {
      typeMap[q.type].total += 1;
      if (diff === 'Mudah') typeMap[q.type].mudah += 1;
      else if (diff === 'Sedang') typeMap[q.type].sedang += 1;
      else typeMap[q.type].sulit += 1;
    }
  });

  const mudahCount = mudahNumbers.length;
  const sedangCount = sedangNumbers.length;
  const sulitCount = sulitNumbers.length;

  const mudahPct = Math.round((mudahCount / totalQuestions) * 100);
  const sedangPct = Math.round((sedangCount / totalQuestions) * 100);
  const sulitPct = Math.round((sulitCount / totalQuestions) * 100);

  const ratioString = `${mudahPct}% : ${sedangPct}% : ${sulitPct}%`;

  // Evaluasi keseimbangan komposisi soal sesuai taksonomi Kurikulum Merdeka Kemenag
  let balanceStatus: PackageDifficultyAnalysis['balanceStatus'];

  if (mudahPct >= 20 && mudahPct <= 45 && sedangPct >= 35 && sedangPct <= 65 && sulitPct >= 10 && sulitPct <= 35) {
    balanceStatus = {
      status: 'seimbang',
      label: 'Proporsi Ideal & Seimbang (Standar Kurikulum Merdeka)',
      description: 'Sebaran tingkat kognitif memenuhi proporsi standar asesmen madrasah (±30% Mudah : 50% Sedang : 20% HOTS).',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    };
  } else if (mudahPct > 45) {
    balanceStatus = {
      status: 'dominan_mudah',
      label: 'Dominan Mudah (Penguatan Fondasi Pemahaman)',
      description: 'Mayoritas soal menguji ingatan dan konsep dasar (C1-C2). Sangat efektif untuk asesmen diagnostik atau Fase A (Kelas 1-2).',
      badgeClass: 'bg-teal-100 text-teal-800 border-teal-300',
    };
  } else if (sulitPct > 35) {
    balanceStatus = {
      status: 'dominan_sulit',
      label: 'Dominan HOTS / Penalaran Kritis',
      description: 'Soal sarat tantangan analisis, evaluasi, dan kreasi (C4-C6). Sangat tepat untuk pengayaan atau Asesmen Madrasah akhir fase.',
      badgeClass: 'bg-purple-100 text-purple-800 border-purple-300',
    };
  } else if (sedangPct > 60) {
    balanceStatus = {
      status: 'dominan_sedang',
      label: 'Dominan Sedang (Aplikasi Terapan Konseptual)',
      description: 'Fokus pengujian menitikberatkan pada penerapan aturan, rumus, dan konsep dalam situasi nyata (C3-C4).',
      badgeClass: 'bg-sky-100 text-sky-800 border-sky-300',
    };
  } else {
    balanceStatus = {
      status: 'seimbang',
      label: 'Proporsi Variatif',
      description: 'Sebaran butir soal mencakup variasi tingkat kognitif berjenjang dari pemahaman hingga penalaran.',
      badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
    };
  }

  const typeLabels: Record<QuestionType, string> = {
    multiple_choice: 'Pilihan Ganda Biasa',
    complex_multiple_choice: 'Pilihan Ganda Kompleks',
    short_answer: 'Isian Singkat',
    essay: 'Uraian / Essay',
  };

  const byType: TypeDifficultyBreakdown[] = (['multiple_choice', 'complex_multiple_choice', 'short_answer', 'essay'] as QuestionType[])
    .filter((t) => typeMap[t].total > 0)
    .map((t) => ({
      type: t,
      label: typeLabels[t],
      total: typeMap[t].total,
      mudah: typeMap[t].mudah,
      sedang: typeMap[t].sedang,
      sulit: typeMap[t].sulit,
    }));

  return {
    totalQuestions,
    totalScore,
    mudah: {
      count: mudahCount,
      percentage: mudahPct,
      questionNumbers: mudahNumbers,
      totalScore: mudahScore,
    },
    sedang: {
      count: sedangCount,
      percentage: sedangPct,
      questionNumbers: sedangNumbers,
      totalScore: sedangScore,
    },
    sulit: {
      count: sulitCount,
      percentage: sulitPct,
      questionNumbers: sulitNumbers,
      totalScore: sulitScore,
    },
    ratioString,
    balanceStatus,
    byType,
  };
}
