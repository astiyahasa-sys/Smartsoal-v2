import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getQuestionDifficulty,
  analyzePackageDifficulty,
  getDifficultyBadge,
} from './difficultyAnalysis';
import { QuestionItem, QuestionPackage } from '../types';

test('getQuestionDifficulty identifies cognitive levels correctly', () => {
  const qL1: QuestionItem = {
    id: '1',
    number: 1,
    type: 'multiple_choice',
    questionText: 'Apa arti shalat?',
    cognitiveLevel: 'L1 (Mengingat/Memahami)',
  };
  assert.equal(getQuestionDifficulty(qL1), 'Mudah');

  const qL2: QuestionItem = {
    id: '2',
    number: 2,
    type: 'multiple_choice',
    questionText: 'Hitung jumlah rakaat...',
    cognitiveLevel: 'L2 (Menerapkan)',
  };
  assert.equal(getQuestionDifficulty(qL2), 'Sedang');

  const qL3: QuestionItem = {
    id: '3',
    number: 3,
    type: 'essay',
    questionText: 'Analisis dampak musibah...',
    cognitiveLevel: 'L3 (Penalaran/HOTS)',
  };
  assert.equal(getQuestionDifficulty(qL3), 'Sulit');

  // Fallbacks
  const qFallbackEssay: QuestionItem = {
    id: '4',
    number: 4,
    type: 'essay',
    questionText: 'Jelaskan...',
  };
  assert.equal(getQuestionDifficulty(qFallbackEssay), 'Sulit');

  const qFallbackCMC: QuestionItem = {
    id: '5',
    number: 5,
    type: 'complex_multiple_choice',
    questionText: 'Pilihlah 2...',
  };
  assert.equal(getQuestionDifficulty(qFallbackCMC), 'Sedang');

  const qFallbackMC: QuestionItem = {
    id: '6',
    number: 6,
    type: 'multiple_choice',
    questionText: 'Siapa nama nabi pertama?',
  };
  assert.equal(getQuestionDifficulty(qFallbackMC), 'Mudah');

  // Explicit Sukar in indicator
  const qSukar: QuestionItem = {
    id: '7',
    number: 7,
    type: 'multiple_choice',
    questionText: 'Soal penalaran tingkat tinggi...',
    indicator: 'Kategori Sukar (C5/C6)',
  };
  assert.equal(getQuestionDifficulty(qSukar), 'Sulit');
});

test('getDifficultyBadge returns complete UI metadata for Mudah, Sedang, and Sukar', () => {
  const mudahBadge = getDifficultyBadge('Mudah');
  assert.equal(mudahBadge.shortLabel, 'Mudah');
  assert.ok(mudahBadge.badgeClass.includes('emerald'));

  const sedangBadge = getDifficultyBadge('Sedang');
  assert.equal(sedangBadge.shortLabel, 'Sedang');
  assert.ok(sedangBadge.badgeClass.includes('sky'));

  const sulitBadge = getDifficultyBadge('Sulit');
  assert.equal(sulitBadge.shortLabel, 'Sukar');
  assert.ok(sulitBadge.badgeClass.includes('purple'));
});

test('analyzePackageDifficulty handles empty package safely', () => {
  const emptyPkg: QuestionPackage = {
    id: 'pkg_empty',
    title: 'Paket Kosong',
    schoolName: 'MIN 1',
    teacherName: 'Guru',
    academicYear: '2024/2025',
    semester: 'Ganjil',
    assessmentType: 'Formatif',
    subject: 'Fikih',
    grade: 4,
    phase: 'Fase B',
    topic: 'Shalat',
    learningObjectives: 'Tujuan',
    durationMinutes: 60,
    multipleChoiceCount: 0,
    shortAnswerCount: 0,
    essayCount: 0,
    difficulty: 'Campuran',
    language: 'Indonesia',
    sourceMaterial: '',
    additionalNotes: '',
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    questions: [],
  };

  const analysis = analyzePackageDifficulty(emptyPkg);
  assert.equal(analysis.totalQuestions, 0);
  assert.equal(analysis.totalScore, 0);
  assert.equal(analysis.mudah.count, 0);
  assert.equal(analysis.sedang.count, 0);
  assert.equal(analysis.sulit.count, 0);
  assert.equal(analysis.balanceStatus.status, 'belum_ada_soal');
});

test('analyzePackageDifficulty computes accurate percentages and tracks question numbers', () => {
  const samplePkg: QuestionPackage = {
    id: 'pkg_sample',
    title: 'Paket Asesmen IPAS',
    schoolName: 'MIN 1',
    teacherName: 'Guru',
    academicYear: '2024/2025',
    semester: 'Ganjil',
    assessmentType: 'SAS',
    subject: 'IPAS',
    grade: 4,
    phase: 'Fase B',
    topic: 'Ekosistem',
    learningObjectives: 'Tujuan',
    durationMinutes: 90,
    multipleChoiceCount: 6,
    shortAnswerCount: 2,
    essayCount: 2,
    difficulty: 'Campuran',
    language: 'Indonesia',
    sourceMaterial: '',
    additionalNotes: '',
    status: 'completed',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    questions: [
      { id: '1', number: 1, type: 'multiple_choice', questionText: 'Soal 1', cognitiveLevel: 'L1 (Mengingat/Memahami)', score: 1 },
      { id: '2', number: 2, type: 'multiple_choice', questionText: 'Soal 2', cognitiveLevel: 'L1 (Mengingat/Memahami)', score: 1 },
      { id: '3', number: 3, type: 'multiple_choice', questionText: 'Soal 3', cognitiveLevel: 'L1 (Mengingat/Memahami)', score: 1 },
      { id: '4', number: 4, type: 'multiple_choice', questionText: 'Soal 4', cognitiveLevel: 'L2 (Menerapkan)', score: 1 },
      { id: '5', number: 5, type: 'multiple_choice', questionText: 'Soal 5', cognitiveLevel: 'L2 (Menerapkan)', score: 1 },
      { id: '6', number: 6, type: 'multiple_choice', questionText: 'Soal 6', cognitiveLevel: 'L2 (Menerapkan)', score: 1 },
      { id: '7', number: 7, type: 'complex_multiple_choice', questionText: 'Soal 7', cognitiveLevel: 'L2 (Menerapkan)', score: 2 },
      { id: '8', number: 8, type: 'short_answer', questionText: 'Soal 8', cognitiveLevel: 'L2 (Menerapkan)', score: 2 },
      { id: '9', number: 9, type: 'essay', questionText: 'Soal 9', cognitiveLevel: 'L3 (Penalaran/HOTS)', score: 4 },
      { id: '10', number: 10, type: 'essay', questionText: 'Soal 10', cognitiveLevel: 'L3 (Penalaran/HOTS)', score: 4 },
    ],
  };

  const analysis = analyzePackageDifficulty(samplePkg);
  assert.equal(analysis.totalQuestions, 10);
  assert.equal(analysis.totalScore, 18);

  // Mudah: 3 out of 10 = 30%
  assert.equal(analysis.mudah.count, 3);
  assert.equal(analysis.mudah.percentage, 30);
  assert.deepEqual(analysis.mudah.questionNumbers, [1, 2, 3]);
  assert.equal(analysis.mudah.totalScore, 3);

  // Sedang: 5 out of 10 = 50%
  assert.equal(analysis.sedang.count, 5);
  assert.equal(analysis.sedang.percentage, 50);
  assert.deepEqual(analysis.sedang.questionNumbers, [4, 5, 6, 7, 8]);
  assert.equal(analysis.sedang.totalScore, 7);

  // Sulit: 2 out of 10 = 20%
  assert.equal(analysis.sulit.count, 2);
  assert.equal(analysis.sulit.percentage, 20);
  assert.deepEqual(analysis.sulit.questionNumbers, [9, 10]);
  assert.equal(analysis.sulit.totalScore, 8);

  // Ratio
  assert.equal(analysis.ratioString, '30% : 50% : 20%');

  // Balance status should be ideal / seimbang
  assert.equal(analysis.balanceStatus.status, 'seimbang');

  // Breakdown by type
  assert.equal(analysis.byType.length, 4);
});
