/**
 * Utilitas Kurikulum Madrasah Ibtidaiyah (MI) dan Perhitungan Soal
 * Versi 1.0 — Fondasi Aplikasi
 */

import { Grade, Phase, QuestionItem, QuestionPackage } from '../types';

/**
 * Menentukan Fase Pembelajaran Kurikulum Merdeka berdasarkan Kelas MI:
 * - Kelas 1 & 2 = Fase A
 * - Kelas 3 & 4 = Fase B
 * - Kelas 5 & 6 = Fase C
 */
export function getPhaseByGrade(grade: Grade): Phase {
  if (grade === 1 || grade === 2) {
    return 'Fase A';
  }
  if (grade === 3 || grade === 4) {
    return 'Fase B';
  }
  return 'Fase C';
}

/**
 * Daftar Mata Pelajaran Standar Madrasah Ibtidaiyah (Kemenag & Kurikulum Merdeka)
 */
export const MI_SUBJECTS = [
  // Mata Pelajaran Ciri Khas Kemenag (PAI & Bahasa Arab)
  "Al-Qur'an Hadis",
  'Akidah Akhlak',
  'Fikih',
  'Sejarah Kebudayaan Islam (SKI)',
  'Bahasa Arab',
  // Mata Pelajaran Umum Kurikulum Merdeka
  'Pendidikan Pancasila',
  'Bahasa Indonesia',
  'Matematika',
  'Ilmu Pengetahuan Alam dan Sosial (IPAS)',
  'Seni dan Budaya (SBdP)',
  'Pendidikan Jasmani, Olahraga, dan Kesehatan (PJOK)',
  'Bahasa Inggris',
  'Muatan Lokal / Bahasa Daerah',
  'Lainnya',
] as const;

/**
 * Daftar Jenis Asesmen Pembelajaran Madrasah
 */
export const ASSESSMENT_TYPES = [
  'Asesmen Harian',
  'Asesmen Sumatif Tengah Semester (ASTS)',
  'Asesmen Sumatif Akhir Semester (ASAS)',
  'Asesmen Sumatif Akhir Tahun (ASAT)',
  'Asesmen Madrasah (AM)',
  'Asesmen Sumatif Lingkup Materi',
  'Lainnya',
] as const;

/**
 * Menghitung total butir soal dari pilihan ganda biasa, pilihan ganda kompleks, isian, dan uraian
 */
export function calculateTotalQuestions(
  multipleChoiceCount: number,
  shortAnswerCount: number,
  essayCount: number,
  complexMultipleChoiceCount?: number
): number {
  const mc = Math.max(0, Math.floor(Number(multipleChoiceCount) || 0));
  const cmc = Math.max(0, Math.floor(Number(complexMultipleChoiceCount) || 0));
  const sa = Math.max(0, Math.floor(Number(shortAnswerCount) || 0));
  const es = Math.max(0, Math.floor(Number(essayCount) || 0));
  return mc + cmc + sa + es;
}

/**
 * Validasi form paket soal sebelum disimpan
 */
export interface ValidationError {
  field: string;
  message: string;
}

export function validatePackageForm(data: Partial<QuestionPackage>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!data.title || data.title.trim().length === 0) {
    errors.push({ field: 'title', message: 'Judul paket soal wajib diisi.' });
  }

  if (!data.schoolName || data.schoolName.trim().length === 0) {
    errors.push({ field: 'schoolName', message: 'Nama madrasah wajib diisi.' });
  }

  if (!data.teacherName || data.teacherName.trim().length === 0) {
    errors.push({ field: 'teacherName', message: 'Nama guru penyusun wajib diisi.' });
  }

  if (!data.academicYear || data.academicYear.trim().length === 0) {
    errors.push({ field: 'academicYear', message: 'Tahun pelajaran wajib diisi.' });
  }

  if (!data.subject || data.subject.trim().length === 0) {
    errors.push({ field: 'subject', message: 'Mata pelajaran wajib dipilih atau diisi.' });
  }

  if (!data.grade || data.grade < 1 || data.grade > 6) {
    errors.push({ field: 'grade', message: 'Kelas harus dipilih antara kelas 1 sampai 6.' });
  }

  const hasSingleTopic = Boolean(data.topic && data.topic.trim().length > 0);
  const hasArrayTopic = Boolean(data.topics && data.topics.some((t) => t.topic && t.topic.trim().length > 0));

  if (!hasSingleTopic && !hasArrayTopic) {
    errors.push({ field: 'topic', message: 'Minimal satu materi pokok / bab wajib diisi.' });
  }

  if (!data.durationMinutes || data.durationMinutes <= 0) {
    errors.push({ field: 'durationMinutes', message: 'Alokasi waktu harus lebih dari 0 menit.' });
  }

  const mc = Number(data.multipleChoiceCount ?? 0);
  const cmc = Number(data.complexMultipleChoiceCount ?? 0);
  const sa = Number(data.shortAnswerCount ?? 0);
  const es = Number(data.essayCount ?? 0);

  if (mc < 0 || !Number.isInteger(mc)) {
    errors.push({ field: 'multipleChoiceCount', message: 'Jumlah pilihan ganda harus bilangan bulat non-negatif.' });
  }
  if (cmc < 0 || !Number.isInteger(cmc)) {
    errors.push({ field: 'complexMultipleChoiceCount', message: 'Jumlah pilihan ganda kompleks harus bilangan bulat non-negatif.' });
  }
  if (sa < 0 || !Number.isInteger(sa)) {
    errors.push({ field: 'shortAnswerCount', message: 'Jumlah isian singkat harus bilangan bulat non-negatif.' });
  }
  if (es < 0 || !Number.isInteger(es)) {
    errors.push({ field: 'essayCount', message: 'Jumlah uraian harus bilangan bulat non-negatif.' });
  }

  const total = calculateTotalQuestions(mc, sa, es, cmc);
  if (total <= 0) {
    errors.push({ field: 'totalQuestions', message: 'Minimal harus ada 1 butir soal yang diatur (PG, PG Kompleks, Isian, atau Uraian).' });
  }

  return errors;
}

/**
 * Menghasilkan ID unik untuk paket soal
 */
export function generateUniqueId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 9);
  return `pkg_${timestamp}_${randomPart}`;
}

/**
 * Format tanggal Indonesia
 */
export function formatIndonesianDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  } catch {
    return '-';
  }
}

/**
 * Format tanggal dan waktu Indonesia
 */
export function formatIndonesianDateTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return '-';
  }
}

/**
 * Melakukan penomoran otomatis (auto-numbering) untuk setiap butir soal secara berurutan (1, 2, 3, ... N).
 * Menjaga nomor tetap teratur tanpa celah saat soal dihapus, disisipkan, atau digeser.
 * Sinkron pula dengan keterangan gambar stimulus bawaan jika memakai format nomor.
 */
export function autoNumberQuestions(questions: QuestionItem[]): QuestionItem[] {
  if (!Array.isArray(questions)) return [];
  return questions.map((q, index) => {
    const newNumber = index + 1;
    let newCaption = q.imageCaption;
    // Perbarui caption jika memakai format bawaan "Gambar Soal Nomor X"
    if (newCaption && /^Gambar Soal Nomor \d+$/i.test(newCaption.trim())) {
      newCaption = `Gambar Soal Nomor ${newNumber}`;
    }
    return {
      ...q,
      number: newNumber,
      imageCaption: newCaption,
    };
  });
}

/**
 * Prioritas urutan bagian naskah asesmen standar Madrasah Ibtidaiyah:
 * Bagian I   : Pilihan Ganda (multiple_choice)
 * Bagian II  : Pilihan Ganda Kompleks (complex_multiple_choice)
 * Bagian III : Isian Singkat (short_answer)
 * Bagian IV  : Uraian / Essay (essay)
 */
export const ASSESSMENT_SECTION_ORDER: Record<string, number> = {
  multiple_choice: 1,
  complex_multiple_choice: 2,
  short_answer: 3,
  essay: 4,
};

/**
 * Mengurutkan butir soal sesuai tata urutan bagian standar asesmen Madrasah Ibtidaiyah Kemenag RI
 * (PG -> PG Kompleks -> Isian Singkat -> Uraian) dan memperbarui nomornya secara berkesinambungan 1..N.
 */
export function sortQuestionsByAssessmentSections(questions: QuestionItem[]): QuestionItem[] {
  if (!Array.isArray(questions)) return [];
  const sorted = [...questions].sort((a, b) => {
    const orderA = ASSESSMENT_SECTION_ORDER[a.type] ?? 99;
    const orderB = ASSESSMENT_SECTION_ORDER[b.type] ?? 99;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return (a.number || 0) - (b.number || 0);
  });

  return autoNumberQuestions(sorted);
}

/**
 * Menormalkan penomoran soal untuk keperluan pratinjau antarmuka dan dokumen cetak / ekspor.
 * Mengelompokkan soal berdasarkan urutan bagian resmi dan menjamin nomor urut berjalan kontinu 1 sampai N.
 */
export function normalizeQuestionNumbering(questions: QuestionItem[]): QuestionItem[] {
  if (!Array.isArray(questions) || questions.length === 0) return [];
  return sortQuestionsByAssessmentSections(questions);
}

/**
 * Menghasilkan daftar butir soal draf kosong berstruktur (PG, PG Kompleks, Isian, Uraian)
 * sesuai komposisi dan materi yang ditentukan guru.
 * Berguna saat guru ingin menyusun soal mandiri di Editor atau saat layanan AI limit.
 */
export function createBlankQuestionsForPackage(
  mcCount: number,
  cmcCount: number,
  saCount: number,
  esCount: number,
  mcOptionCount: 3 | 4 = 4,
  topics?: { id: string; topic: string; learningObjectives?: string }[],
  defaultTopic: string = 'Materi Pokok'
): QuestionItem[] {
  const items: QuestionItem[] = [];
  let itemNumber = 1;
  const optionKeys = mcOptionCount === 3 ? ['A', 'B', 'C'] : ['A', 'B', 'C', 'D'];

  const getTopic = (idx: number): string => {
    if (topics && topics.length > 0) {
      const valid = topics.filter((t) => t.topic && t.topic.trim().length > 0);
      if (valid.length > 0) {
        return valid[idx % valid.length].topic;
      }
    }
    return defaultTopic || 'Materi Pokok';
  };

  // 1. Pilihan Ganda (PG) Biasa
  for (let i = 0; i < mcCount; i++) {
    const itemTopic = getTopic(i);
    items.push({
      id: `q_mc_${Date.now()}_${itemNumber}_${Math.random().toString(36).substring(2, 6)}`,
      number: itemNumber++,
      type: 'multiple_choice',
      questionText: `[Soal PG #${i + 1}] Tuliskan pertanyaan materi ${itemTopic}...`,
      options: optionKeys.map((key) => ({ key, text: `Pilihan jawaban ${key}` })),
      answerKey: 'A',
      explanation: `Kunci jawaban A. Pembahasan konsep materi ${itemTopic}.`,
      score: 1,
      indicator: `Peserta didik dapat memahami konsep ${itemTopic}.`,
      cognitiveLevel: 'L1 (Mengingat/Memahami)',
      topic: itemTopic,
    });
  }

  // 2. Pilihan Ganda (PG) Kompleks
  for (let i = 0; i < cmcCount; i++) {
    const itemTopic = getTopic(mcCount + i);
    items.push({
      id: `q_cmc_${Date.now()}_${itemNumber}_${Math.random().toString(36).substring(2, 6)}`,
      number: itemNumber++,
      type: 'complex_multiple_choice',
      questionText: `[Soal PG Kompleks #${i + 1}] Tuliskan pertanyaan materi ${itemTopic} (Pilihlah 2 atau 3 jawaban yang benar!)...`,
      options: optionKeys.map((key) => ({ key, text: `Pernyataan / Pilihan ${key}` })),
      answerKey: 'A, B',
      explanation: `Kunci jawaban benar: A dan B. Pembahasan materi ${itemTopic}.`,
      score: 2,
      indicator: `Peserta didik dapat menganalisis beberapa aspek materi ${itemTopic}.`,
      cognitiveLevel: 'L2 (Menerapkan)',
      topic: itemTopic,
    });
  }

  // 3. Isian Singkat
  for (let i = 0; i < saCount; i++) {
    const itemTopic = getTopic(mcCount + cmcCount + i);
    items.push({
      id: `q_sa_${Date.now()}_${itemNumber}_${Math.random().toString(36).substring(2, 6)}`,
      number: itemNumber++,
      type: 'short_answer',
      questionText: `[Soal Isian Singkat #${i + 1}] Tuliskan pertanyaan isian untuk materi ${itemTopic}...`,
      answerKey: 'Jawaban singkat',
      acceptedAnswers: ['Jawaban singkat'],
      explanation: `Kunci jawaban dan penjelasan materi ${itemTopic}.`,
      score: 2,
      indicator: `Peserta didik dapat menyebutkan fakta materi ${itemTopic}.`,
      cognitiveLevel: 'L1 (Mengingat/Memahami)',
      topic: itemTopic,
    });
  }

  // 4. Uraian / Essay
  for (let i = 0; i < esCount; i++) {
    const itemTopic = getTopic(mcCount + cmcCount + saCount + i);
    items.push({
      id: `q_es_${Date.now()}_${itemNumber}_${Math.random().toString(36).substring(2, 6)}`,
      number: itemNumber++,
      type: 'essay',
      questionText: `[Soal Uraian #${i + 1}] Jelaskan secara rinci konsep tentang materi ${itemTopic}...`,
      answerKey: `Pedoman jawaban lengkap untuk materi ${itemTopic}.`,
      rubric: [
        { criteria: 'Menjelaskan konsep utama dengan tepat', score: 2 },
        { criteria: 'Menyertakan contoh atau dalil pendukung yang relevan', score: 2 },
      ],
      explanation: `Pedoman penilaian dan rubrik penskoran materi ${itemTopic}.`,
      score: 4,
      indicator: `Peserta didik dapat menguraikan dan menyimpulkan materi ${itemTopic}.`,
      cognitiveLevel: 'L3 (Penalaran/HOTS)',
      topic: itemTopic,
    });
  }

  return items;
}

/**
 * Skala proporsional jumlah butir soal aktif ke target total baru
 */
export function scaleQuestionCountsToTotal(
  targetTotal: number,
  mc: number,
  cmc: number,
  sa: number,
  es: number
): { mc: number; cmc: number; sa: number; es: number } {
  const currentTotal = mc + cmc + sa + es;
  if (currentTotal === 0 || targetTotal <= 0) {
    return { mc: targetTotal, cmc: 0, sa: 0, es: 0 };
  }

  // Hitung pembagian proporsional
  const rawMc = Math.round((mc / currentTotal) * targetTotal);
  const rawCmc = Math.round((cmc / currentTotal) * targetTotal);
  const rawSa = Math.round((sa / currentTotal) * targetTotal);
  const rawEs = targetTotal - (rawMc + rawCmc + rawSa);

  let finalMc = rawMc;
  let finalCmc = rawCmc;
  let finalSa = rawSa;
  let finalEs = Math.max(0, rawEs);

  const diff = targetTotal - (finalMc + finalCmc + finalSa + finalEs);
  if (diff !== 0) {
    if (mc > 0 && finalMc + diff >= 0) {
      finalMc += diff;
    } else if (cmc > 0 && finalCmc + diff >= 0) {
      finalCmc += diff;
    } else if (sa > 0 && finalSa + diff >= 0) {
      finalSa += diff;
    } else {
      finalEs += diff;
    }
  }

  return {
    mc: Math.max(0, finalMc),
    cmc: Math.max(0, finalCmc),
    sa: Math.max(0, finalSa),
    es: Math.max(0, finalEs),
  };
}

