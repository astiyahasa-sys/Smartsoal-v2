import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getPhaseByGrade,
  calculateTotalQuestions,
  validatePackageForm,
  generateUniqueId,
  autoNumberQuestions,
  sortQuestionsByAssessmentSections,
  normalizeQuestionNumbering,
  ASSESSMENT_TYPES,
  createBlankQuestionsForPackage,
  scaleQuestionCountsToTotal,
} from './curriculum';
import { QuestionItem, QuestionPackage } from '../types';

test('getPhaseByGrade correctly maps MI classes to Kurikulum Merdeka phases', () => {
  assert.equal(getPhaseByGrade(1), 'Fase A');
  assert.equal(getPhaseByGrade(2), 'Fase A');
  assert.equal(getPhaseByGrade(3), 'Fase B');
  assert.equal(getPhaseByGrade(4), 'Fase B');
  assert.equal(getPhaseByGrade(5), 'Fase C');
  assert.equal(getPhaseByGrade(6), 'Fase C');
});

test('calculateTotalQuestions sums multiple choice, complex multiple choice, short answer, and essay properly', () => {
  assert.equal(calculateTotalQuestions(10, 5, 5), 20);
  assert.equal(calculateTotalQuestions(10, 5, 5, 5), 25);
  assert.equal(calculateTotalQuestions(25, 0, 5, 10), 40);
  assert.equal(calculateTotalQuestions(0, 0, 0, 0), 0);
  // handles string or edge values safely
  assert.equal(calculateTotalQuestions('15' as any, '5' as any, '0' as any, '5' as any), 25);
  // handles negative by clamping to 0
  assert.equal(calculateTotalQuestions(-5, 10, 2, 3), 15);
});

test('validatePackageForm catches missing required fields', () => {
  const emptyForm: Partial<QuestionPackage> = {};
  const errors = validatePackageForm(emptyForm);

  assert.ok(errors.some((e) => e.field === 'title'));
  assert.ok(errors.some((e) => e.field === 'schoolName'));
  assert.ok(errors.some((e) => e.field === 'teacherName'));
  assert.ok(errors.some((e) => e.field === 'subject'));
  assert.ok(errors.some((e) => e.field === 'topic'));
  assert.ok(errors.some((e) => e.field === 'totalQuestions'));
});

test('validatePackageForm approves a valid package configuration', () => {
  const validPackage: Partial<QuestionPackage> = {
    title: 'Sumatif Lingkup Materi Fikih Kelas 4',
    schoolName: 'MI Al-Hidayah',
    teacherName: 'Ust. Ahmad Fauzi, S.Pd.I',
    academicYear: '2024/2025',
    subject: 'Fikih',
    grade: 4,
    topic: 'Ketentuan Shalat Berjamaah',
    durationMinutes: 90,
    multipleChoiceCount: 20,
    shortAnswerCount: 5,
    essayCount: 5,
  };

  const errors = validatePackageForm(validPackage);
  assert.equal(errors.length, 0);
});

test('validatePackageForm approves package with multi-topics array', () => {
  const multiTopicPackage: Partial<QuestionPackage> = {
    title: 'Sumatif Akhir Semester Fikih Kelas 4',
    schoolName: 'MIN 1 Ciamis',
    teacherName: 'Ust. Agus Arifien, S.Pd.I',
    academicYear: '2024/2025',
    subject: 'Fikih',
    grade: 4,
    topic: '', // blank single topic
    topics: [
      { id: 't1', topic: 'Bab 1: Shalat Berjamaah', learningObjectives: 'Memahami shalat berjamaah' },
      { id: 't2', topic: 'Bab 2: Shalat Masbuq', learningObjectives: 'Mempraktikkan makmum masbuq' },
    ],
    durationMinutes: 90,
    multipleChoiceCount: 20,
    shortAnswerCount: 5,
    essayCount: 5,
  };

  const errors = validatePackageForm(multiTopicPackage);
  assert.equal(errors.length, 0);
});

test('generateUniqueId returns distinct strings with pkg_ prefix', () => {
  const id1 = generateUniqueId();
  const id2 = generateUniqueId();
  assert.ok(id1.startsWith('pkg_'));
  assert.ok(id2.startsWith('pkg_'));
  assert.notEqual(id1, id2);
});

test('autoNumberQuestions assigns contiguous numbers 1..N and updates default captions', () => {
  const sample: QuestionItem[] = [
    { id: 'q_a', number: 10, type: 'multiple_choice', questionText: 'Soal 1', score: 1 },
    { id: 'q_b', number: 45, type: 'short_answer', questionText: 'Soal 2', score: 2, imageCaption: 'Gambar Soal Nomor 45' },
    { id: 'q_c', number: 2, type: 'essay', questionText: 'Soal 3', score: 4, imageCaption: 'Peta Indonesia' },
  ];

  const result = autoNumberQuestions(sample);
  assert.equal(result.length, 3);
  assert.equal(result[0].number, 1);
  assert.equal(result[1].number, 2);
  assert.equal(result[1].imageCaption, 'Gambar Soal Nomor 2');
  assert.equal(result[2].number, 3);
  // Custom caption preserved
  assert.equal(result[2].imageCaption, 'Peta Indonesia');
});

test('sortQuestionsByAssessmentSections orders by PG -> PGK -> Isian -> Uraian and auto-numbers', () => {
  const disordered: QuestionItem[] = [
    { id: 'q_essay', number: 1, type: 'essay', questionText: 'Uraian 1', score: 5 },
    { id: 'q_mc2', number: 2, type: 'multiple_choice', questionText: 'PG 2', score: 1 },
    { id: 'q_cmc', number: 3, type: 'complex_multiple_choice', questionText: 'PGK 1', score: 2 },
    { id: 'q_sa', number: 4, type: 'short_answer', questionText: 'Isian 1', score: 2 },
    { id: 'q_mc1', number: 5, type: 'multiple_choice', questionText: 'PG 1', score: 1 },
  ];

  const result = sortQuestionsByAssessmentSections(disordered);
  assert.equal(result.length, 5);
  // Bagian I: PG
  assert.equal(result[0].type, 'multiple_choice');
  assert.equal(result[0].number, 1);
  assert.equal(result[1].type, 'multiple_choice');
  assert.equal(result[1].number, 2);
  // Bagian II: PGK
  assert.equal(result[2].type, 'complex_multiple_choice');
  assert.equal(result[2].number, 3);
  // Bagian III: Isian
  assert.equal(result[3].type, 'short_answer');
  assert.equal(result[3].number, 4);
  // Bagian IV: Uraian
  assert.equal(result[4].type, 'essay');
  assert.equal(result[4].number, 5);
});

test('normalizeQuestionNumbering handles empty or null safely', () => {
  assert.deepEqual(normalizeQuestionNumbering([]), []);
  assert.deepEqual(normalizeQuestionNumbering(null as any), []);
});

test('ASSESSMENT_TYPES contains all requested assessment types in correct order', () => {
  const expectedTypes = [
    'Asesmen Harian',
    'Asesmen Sumatif Tengah Semester (ASTS)',
    'Asesmen Sumatif Akhir Semester (ASAS)',
    'Asesmen Sumatif Akhir Tahun (ASAT)',
    'Asesmen Madrasah (AM)',
    'Asesmen Sumatif Lingkup Materi',
    'Lainnya',
  ];
  assert.deepEqual(Array.from(ASSESSMENT_TYPES), expectedTypes);
});

test('createBlankQuestionsForPackage generates expected questions per type and assigns topics', () => {
  const topics = [
    { id: 't1', topic: 'Bab 1: Rukun Islam', learningObjectives: 'Memahami rukun Islam' },
    { id: 't2', topic: 'Bab 2: Shalat Fardhu', learningObjectives: 'Mempraktikkan shalat' },
  ];

  const blankItems = createBlankQuestionsForPackage(3, 2, 2, 1, 4, topics, 'Bab 1: Rukun Islam');
  assert.equal(blankItems.length, 8);
  assert.equal(blankItems[0].type, 'multiple_choice');
  assert.equal(blankItems[0].number, 1);
  assert.equal(blankItems[0].options?.length, 4);

  assert.equal(blankItems[3].type, 'complex_multiple_choice');
  assert.equal(blankItems[3].number, 4);
  assert.equal(blankItems[3].answerKey, 'A, B');

  assert.equal(blankItems[5].type, 'short_answer');
  assert.equal(blankItems[5].number, 6);

  assert.equal(blankItems[7].type, 'essay');
  assert.equal(blankItems[7].number, 8);
  assert.ok(blankItems[7].rubric && blankItems[7].rubric.length > 0);
});

test('scaleQuestionCountsToTotal proportionally rescales counts accurately', () => {
  // Base 30 questions (15 PG, 5 PGK, 5 Isian, 5 Uraian)
  const scaledTo20 = scaleQuestionCountsToTotal(20, 15, 5, 5, 5);
  const totalScaled = scaledTo20.mc + scaledTo20.cmc + scaledTo20.sa + scaledTo20.es;
  assert.equal(totalScaled, 20);
  assert.ok(scaledTo20.mc >= scaledTo20.cmc);

  // Scaling single active type
  const scaledPgOnly = scaleQuestionCountsToTotal(25, 20, 0, 0, 0);
  assert.equal(scaledPgOnly.mc, 25);
  assert.equal(scaledPgOnly.cmc, 0);
  assert.equal(scaledPgOnly.sa, 0);
  assert.equal(scaledPgOnly.es, 0);
});

