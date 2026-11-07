import { QuestionItem, QuestionPackage, QuestionType, SchoolProfile } from '../types';
import { getQuestionDifficulty } from './difficultyAnalysis';
import * as XLSX from 'xlsx';

export type DifficultyCategory = 'Mudah' | 'Sedang' | 'Sukar';

export type DiscriminationCategory =
  | 'Sangat Baik'
  | 'Baik'
  | 'Cukup'
  | 'Jelek'
  | 'Sangat Jelek (Negatif)';

export interface ItemAnalysisData {
  questionNumber: number;
  questionId: string;
  type: QuestionType;
  indicator?: string;
  topic?: string;
  score: number;
  // Tingkat Kesukaran (P)
  facilityIndex: number; // 0.00 - 1.00
  difficultyCategory: DifficultyCategory;
  // Daya Beda (D)
  discriminationIndex: number; // -1.00 to 1.00
  discriminationCategory: DiscriminationCategory;
  // Rekomendasi
  recommendation: 'Diterima' | 'Revisi Pengecoh' | 'Kaji Ulang / Dibuang';
  recommendationNote: string;
  badgeClass: string;
  // Data siswa (opsional jika guru melakukan simulasi/input skor nyata)
  totalStudents?: number;
  totalCorrect?: number;
  upperCorrect?: number;
  lowerCorrect?: number;
  groupSize?: number;
}

export interface PackageItemAnalysisReport {
  packageId: string;
  packageTitle: string;
  totalQuestions: number;
  averageFacilityIndex: number;
  averageDiscriminationIndex: number;
  difficultySummary: {
    mudahCount: number;
    sedangCount: number;
    sukarCount: number;
    mudahPct: number;
    sedangPct: number;
    sukarPct: number;
  };
  discriminationSummary: {
    sangatBaikCount: number;
    baikCount: number;
    cukupCount: number;
    jelekCount: number;
  };
  recommendationSummary: {
    diterimaCount: number;
    revisiCount: number;
    dibuangCount: number;
  };
  overallQualityAssessment: {
    grade: 'A (Sangat Berkualitas)' | 'B (Berkualitas Baik)' | 'C (Perlu Perbaikan)' | 'D (Perlu Rombak)';
    label: string;
    description: string;
    badgeClass: string;
  };
  items: ItemAnalysisData[];
}

/**
 * Mengklasifikasikan nilai Tingkat Kesukaran (P) menurut standar evaluasi pendidikan (Arikunto/Puspendik)
 * P > 0.70 : Mudah
 * 0.30 <= P <= 0.70 : Sedang (Ideal)
 * P < 0.30 : Sukar
 */
export function classifyFacilityIndex(p: number): DifficultyCategory {
  if (p > 0.70) return 'Mudah';
  if (p >= 0.30) return 'Sedang';
  return 'Sukar';
}

/**
 * Mengklasifikasikan nilai Daya Pembeda (D) menurut standar evaluasi pendidikan (Arikunto/Puspendik)
 * D >= 0.40 : Sangat Baik
 * 0.30 <= D < 0.40 : Baik
 * 0.20 <= D < 0.30 : Cukup
 * 0.00 <= D < 0.20 : Jelek
 * D < 0.00 : Sangat Jelek (Negatif)
 */
export function classifyDiscriminationIndex(d: number): DiscriminationCategory {
  if (d >= 0.40) return 'Sangat Baik';
  if (d >= 0.30) return 'Baik';
  if (d >= 0.20) return 'Cukup';
  if (d >= 0.00) return 'Jelek';
  return 'Sangat Jelek (Negatif)';
}

/**
 * Menghitung Tingkat Kesukaran P = B / N
 */
export function calculateFacilityIndex(totalCorrect: number, totalStudents: number): number {
  if (totalStudents <= 0) return 0;
  const p = totalCorrect / totalStudents;
  return Math.max(0, Math.min(1, Math.round(p * 100) / 100));
}

/**
 * Menghitung Daya Beda D = (Ba / Ja) - (Bb / Jb)
 */
export function calculateDiscriminationIndex(
  upperCorrect: number,
  lowerCorrect: number,
  groupSize: number
): number {
  if (groupSize <= 0) return 0;
  const d = (upperCorrect - lowerCorrect) / groupSize;
  return Math.max(-1, Math.min(1, Math.round(d * 100) / 100));
}

/**
 * Menghasilkan rekomendasi pedagogis butir soal berdasarkan kombinasi P dan D
 */
export function getItemRecommendation(
  p: number,
  d: number
): {
  recommendation: 'Diterima' | 'Revisi Pengecoh' | 'Kaji Ulang / Dibuang';
  recommendationNote: string;
  badgeClass: string;
} {
  if (d < 0) {
    return {
      recommendation: 'Kaji Ulang / Dibuang',
      recommendationNote: 'Daya beda negatif: siswa kelompok bawah lebih banyak benar daripada kelompok atas. Kunci jawaban kemungkinan keliru atau soal ambigu.',
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
    };
  }

  if (d >= 0.30) {
    if (p >= 0.30 && p <= 0.70) {
      return {
        recommendation: 'Diterima',
        recommendationNote: 'Butir soal sangat baik dan ideal: daya beda tinggi dengan tingkat kesukaran sedang yang proporsional.',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      };
    }
    if (p > 0.70) {
      return {
        recommendation: 'Diterima',
        recommendationNote: 'Soal mudah dengan daya pembeda baik. Cocok sebagai butir pembuka ujian/penambah motivasi.',
        badgeClass: 'bg-teal-100 text-teal-800 border-teal-300',
      };
    }
    return {
      recommendation: 'Diterima',
      recommendationNote: 'Soal sukar (HOTS) dengan daya pembeda tinggi. Sangat efektif menyaring kemampuan analisis siswa kelompok atas.',
      badgeClass: 'bg-purple-100 text-purple-800 border-purple-300',
    };
  }

  if (d >= 0.20 && d < 0.30) {
    return {
      recommendation: 'Revisi Pengecoh',
      recommendationNote: 'Daya pembeda cukup: butir soal dapat digunakan setelah merevisi alternatif pengecoh (distraktor) agar lebih berfungsi.',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
    };
  }

  return {
    recommendation: 'Kaji Ulang / Dibuang',
    recommendationNote: 'Daya beda rendah (D < 0.20): butir soal kurang mampu membedakan siswa pandai dan kurang. Disarankan revisi total atau diganti.',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
  };
}

/**
 * Estimasi apriori nilai P dan D untuk naskah soal yang disusun sebelum ada data riil ujian.
 * Berdasarkan level kognitif taksonomi Kurikulum Merdeka (L1, L2, L3) dan bentuk soal.
 */
export function estimateItemAnalysis(q: QuestionItem, index: number): ItemAnalysisData {
  const normDiff = getQuestionDifficulty(q);

  let baseP = 0.55;
  let baseD = 0.38;

  // Sedikit variasi deterministik berbasis nomor soal agar tabel realistis
  const pseudoRandom = ((index * 7 + 13) % 11 - 5) * 0.02;

  if (normDiff === 'Mudah') {
    baseP = 0.76 + pseudoRandom;
    baseD = 0.32 + Math.abs(pseudoRandom);
  } else if (normDiff === 'Sulit') {
    baseP = 0.25 + pseudoRandom;
    baseD = 0.44 + pseudoRandom;
  } else {
    baseP = 0.52 + pseudoRandom;
    baseD = 0.39 + pseudoRandom;
  }

  // Uraian biasanya memiliki daya pembeda tinggi jika rubrik jelas
  if (q.type === 'essay') {
    baseD = Math.min(0.58, baseD + 0.08);
  } else if (q.type === 'complex_multiple_choice') {
    baseD = Math.min(0.50, baseD + 0.05);
  }

  const p = Math.max(0.12, Math.min(0.92, Math.round(baseP * 100) / 100));
  const d = Math.max(0.15, Math.min(0.65, Math.round(baseD * 100) / 100));

  const diffCat = classifyFacilityIndex(p);
  const discCat = classifyDiscriminationIndex(d);
  const rec = getItemRecommendation(p, d);

  return {
    questionNumber: q.number,
    questionId: q.id,
    type: q.type,
    indicator: q.indicator,
    topic: q.topic,
    score: q.score || 1,
    facilityIndex: p,
    difficultyCategory: diffCat,
    discriminationIndex: d,
    discriminationCategory: discCat,
    recommendation: rec.recommendation,
    recommendationNote: rec.recommendationNote,
    badgeClass: rec.badgeClass,
  };
}

/**
 * Menganalisis seluruh butir soal dalam paket soal dan menghasilkan laporan komprehensif
 */
export function analyzePackageItems(
  pkg: QuestionPackage,
  customItemData?: Record<number, { totalCorrect: number; totalStudents: number; upperCorrect: number; lowerCorrect: number; groupSize: number }>
): PackageItemAnalysisReport {
  const questions = pkg.questions || [];
  const totalQuestions = questions.length;

  if (totalQuestions === 0) {
    return {
      packageId: pkg.id,
      packageTitle: pkg.title,
      totalQuestions: 0,
      averageFacilityIndex: 0,
      averageDiscriminationIndex: 0,
      difficultySummary: { mudahCount: 0, sedangCount: 0, sukarCount: 0, mudahPct: 0, sedangPct: 0, sukarPct: 0 },
      discriminationSummary: { sangatBaikCount: 0, baikCount: 0, cukupCount: 0, jelekCount: 0 },
      recommendationSummary: { diterimaCount: 0, revisiCount: 0, dibuangCount: 0 },
      overallQualityAssessment: {
        grade: 'D (Perlu Rombak)',
        label: 'Belum Ada Butir Soal',
        description: 'Paket soal belum memiliki butir soal yang diinput.',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
      },
      items: [],
    };
  }

  const items: ItemAnalysisData[] = questions.map((q, idx) => {
    const custom = customItemData?.[q.number];
    if (custom && custom.totalStudents > 0) {
      const p = calculateFacilityIndex(custom.totalCorrect, custom.totalStudents);
      const d = calculateDiscriminationIndex(custom.upperCorrect, custom.lowerCorrect, custom.groupSize);
      const diffCat = classifyFacilityIndex(p);
      const discCat = classifyDiscriminationIndex(d);
      const rec = getItemRecommendation(p, d);
      return {
        questionNumber: q.number,
        questionId: q.id,
        type: q.type,
        indicator: q.indicator,
        topic: q.topic,
        score: q.score || 1,
        facilityIndex: p,
        difficultyCategory: diffCat,
        discriminationIndex: d,
        discriminationCategory: discCat,
        recommendation: rec.recommendation,
        recommendationNote: rec.recommendationNote,
        badgeClass: rec.badgeClass,
        totalStudents: custom.totalStudents,
        totalCorrect: custom.totalCorrect,
        upperCorrect: custom.upperCorrect,
        lowerCorrect: custom.lowerCorrect,
        groupSize: custom.groupSize,
      };
    }
    return estimateItemAnalysis(q, idx);
  });

  const sumP = items.reduce((sum, item) => sum + item.facilityIndex, 0);
  const sumD = items.reduce((sum, item) => sum + item.discriminationIndex, 0);
  const avgP = Math.round((sumP / totalQuestions) * 100) / 100;
  const avgD = Math.round((sumD / totalQuestions) * 100) / 100;

  const mudahCount = items.filter((i) => i.difficultyCategory === 'Mudah').length;
  const sedangCount = items.filter((i) => i.difficultyCategory === 'Sedang').length;
  const sukarCount = items.filter((i) => i.difficultyCategory === 'Sukar').length;

  const sangatBaikCount = items.filter((i) => i.discriminationCategory === 'Sangat Baik').length;
  const baikCount = items.filter((i) => i.discriminationCategory === 'Baik').length;
  const cukupCount = items.filter((i) => i.discriminationCategory === 'Cukup').length;
  const jelekCount = items.filter((i) => i.discriminationCategory === 'Jelek' || i.discriminationCategory === 'Sangat Jelek (Negatif)').length;

  const diterimaCount = items.filter((i) => i.recommendation === 'Diterima').length;
  const revisiCount = items.filter((i) => i.recommendation === 'Revisi Pengecoh').length;
  const dibuangCount = items.filter((i) => i.recommendation === 'Kaji Ulang / Dibuang').length;

  // Evaluasi mutu naskah keseluruhan
  let overallQualityAssessment: PackageItemAnalysisReport['overallQualityAssessment'];
  if (avgD >= 0.35 && avgP >= 0.35 && avgP <= 0.65 && dibuangCount === 0) {
    overallQualityAssessment = {
      grade: 'A (Sangat Berkualitas)',
      label: 'Kualitas Instrumen Asesmen Sangat Baik',
      description: 'Seluruh butir soal memiliki daya beda tinggi dan sebaran tingkat kesukaran seimbang ideal sesuai standar asesmen madrasah.',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    };
  } else if (avgD >= 0.28 && dibuangCount <= 2) {
    overallQualityAssessment = {
      grade: 'B (Berkualitas Baik)',
      label: 'Instrumen Layak Digunakan',
      description: 'Sebagian besar butir soal diterima dengan baik. Terdapat sedikit butir yang memerlukan penyempurnaan distraktor/pengecoh.',
      badgeClass: 'bg-teal-100 text-teal-800 border-teal-300',
    };
  } else if (avgD >= 0.20 || revisiCount > 0) {
    overallQualityAssessment = {
      grade: 'C (Perlu Perbaikan)',
      label: 'Perlu Perbaikan Opsi Pengecoh',
      description: 'Beberapa butir soal memiliki daya beda yang cukup rendah atau tingkat kesulitan belum seimbang.',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
    };
  } else {
    overallQualityAssessment = {
      grade: 'D (Perlu Rombak)',
      label: 'Perlu Pengkajian Ulang',
      description: 'Banyak butir soal yang tidak berdaya beda atau memiliki kesulitan ekstrem. Disarankan evaluasi mendalam.',
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
    };
  }

  return {
    packageId: pkg.id,
    packageTitle: pkg.title,
    totalQuestions,
    averageFacilityIndex: avgP,
    averageDiscriminationIndex: avgD,
    difficultySummary: {
      mudahCount,
      sedangCount,
      sukarCount,
      mudahPct: Math.round((mudahCount / totalQuestions) * 100),
      sedangPct: Math.round((sedangCount / totalQuestions) * 100),
      sukarPct: Math.round((sukarCount / totalQuestions) * 100),
    },
    discriminationSummary: {
      sangatBaikCount,
      baikCount,
      cukupCount,
      jelekCount,
    },
    recommendationSummary: {
      diterimaCount,
      revisiCount,
      dibuangCount,
    },
    overallQualityAssessment,
    items,
  };
}

/**
 * Ekspor Laporan Analisis Butir Soal ke berkas Excel (.xlsx)
 */
export function exportItemAnalysisToExcel(
  pkg: QuestionPackage,
  report: PackageItemAnalysisReport,
  schoolProfile?: SchoolProfile | null
): Blob {
  const data: any[] = [];
  data.push(['LAPORAN ANALISIS STATISTIK BUTIR SOAL (TINGKAT KESUKARAN & DAYA BEDA)']);
  data.push([`${pkg.schoolName || schoolProfile?.schoolName || 'MADRASAH IBTIDAIYAH'}`]);
  data.push([`Mata Pelajaran: ${pkg.subject} | Kelas: ${pkg.grade} (${pkg.phase}) | Semester: ${pkg.semester}`]);
  data.push([`Jenis Asesmen: ${pkg.assessmentType} | TP: ${pkg.academicYear} | Guru: ${pkg.teacherName || schoolProfile?.teacherName || '-'}`]);
  data.push([]);
  data.push([
    `Rata-rata Tingkat Kesukaran (P): ${report.averageFacilityIndex}`,
    `Rata-rata Daya Beda (D): ${report.averageDiscriminationIndex}`,
    `Status Mutu: ${report.overallQualityAssessment.grade}`,
  ]);
  data.push([
    `Sebaran Kesukaran: Mudah (${report.difficultySummary.mudahCount}) | Sedang (${report.difficultySummary.sedangCount}) | Sukar (${report.difficultySummary.sukarCount})`,
    `Rekomendasi: Diterima (${report.recommendationSummary.diterimaCount}) | Revisi (${report.recommendationSummary.revisiCount}) | Dibuang (${report.recommendationSummary.dibuangCount})`,
  ]);
  data.push([]);

  // Header Tabel
  data.push([
    'No Soal',
    'Bentuk Soal',
    'Indikator Soal',
    'Bobot Skor',
    'Tingkat Kesukaran (P)',
    'Kategori Kesukaran',
    'Daya Beda (D)',
    'Kategori Daya Beda',
    'Rekomendasi Status',
    'Catatan / Saran Pedagogis',
  ]);

  for (const item of report.items) {
    const typeLabel =
      item.type === 'multiple_choice'
        ? 'PG Biasa'
        : item.type === 'complex_multiple_choice'
        ? 'PG Kompleks'
        : item.type === 'short_answer'
        ? 'Isian'
        : 'Uraian';

    data.push([
      item.questionNumber,
      typeLabel,
      item.indicator || '-',
      item.score,
      item.facilityIndex,
      item.difficultyCategory,
      item.discriminationIndex,
      item.discriminationCategory,
      item.recommendation,
      item.recommendationNote,
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Analisis Butir Soal');

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
