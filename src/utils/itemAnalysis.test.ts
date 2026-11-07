import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyFacilityIndex,
  classifyDiscriminationIndex,
  calculateFacilityIndex,
  calculateDiscriminationIndex,
  getItemRecommendation,
  estimateItemAnalysis,
  analyzePackageItems,
  exportItemAnalysisToExcel,
} from './itemAnalysis';
import { QuestionPackage } from '../types';

test('calculateFacilityIndex computes correct P value bounded 0..1', () => {
  // 15 out of 30 students answered correctly => 0.50
  assert.equal(calculateFacilityIndex(15, 30), 0.5);
  // 30 out of 30 => 1.00
  assert.equal(calculateFacilityIndex(30, 30), 1.0);
  // 0 out of 30 => 0.00
  assert.equal(calculateFacilityIndex(0, 30), 0.0);
  // Edge case: totalStudents = 0
  assert.equal(calculateFacilityIndex(10, 0), 0);
});

test('classifyFacilityIndex maps P values according to Arikunto standard', () => {
  assert.equal(classifyFacilityIndex(0.85), 'Mudah'); // P > 0.70
  assert.equal(classifyFacilityIndex(0.50), 'Sedang'); // 0.30 <= P <= 0.70
  assert.equal(classifyFacilityIndex(0.30), 'Sedang');
  assert.equal(classifyFacilityIndex(0.20), 'Sukar'); // P < 0.30
});

test('calculateDiscriminationIndex computes correct D value bounded -1..1', () => {
  // Upper group (10 students): 9 correct. Lower group (10 students): 3 correct. Group size = 10.
  // D = (9 - 3) / 10 = 0.60
  assert.equal(calculateDiscriminationIndex(9, 3, 10), 0.6);

  // Negative D (Lower group scored more than upper group): D = (2 - 6) / 10 = -0.40
  assert.equal(calculateDiscriminationIndex(2, 6, 10), -0.4);

  // Edge case: groupSize = 0
  assert.equal(calculateDiscriminationIndex(5, 2, 0), 0);
});

test('classifyDiscriminationIndex maps D values according to Arikunto standard', () => {
  assert.equal(classifyDiscriminationIndex(0.45), 'Sangat Baik'); // D >= 0.40
  assert.equal(classifyDiscriminationIndex(0.35), 'Baik'); // 0.30 <= D < 0.40
  assert.equal(classifyDiscriminationIndex(0.25), 'Cukup'); // 0.20 <= D < 0.30
  assert.equal(classifyDiscriminationIndex(0.15), 'Jelek'); // 0.00 <= D < 0.20
  assert.equal(classifyDiscriminationIndex(-0.1), 'Sangat Jelek (Negatif)'); // D < 0
});

test('getItemRecommendation provides accurate pedagogical action for P and D combinations', () => {
  // Ideal item: Sedang + Baik
  const recIdeal = getItemRecommendation(0.5, 0.42);
  assert.equal(recIdeal.recommendation, 'Diterima');
  assert.ok(recIdeal.badgeClass.includes('emerald'));

  // Fair item: Cukup (needs distractor revision)
  const recFair = getItemRecommendation(0.5, 0.25);
  assert.equal(recFair.recommendation, 'Revisi Pengecoh');
  assert.ok(recFair.badgeClass.includes('amber'));

  // Negative D: Misleading item
  const recNegative = getItemRecommendation(0.5, -0.15);
  assert.equal(recNegative.recommendation, 'Kaji Ulang / Dibuang');
  assert.ok(recNegative.badgeClass.includes('rose'));
});

test('analyzePackageItems evaluates a full package and custom student scores accurately', () => {
  const samplePkg: QuestionPackage = {
    id: 'pkg_test_analysis',
    title: 'Asesmen Fikih Kelas 4',
    schoolName: 'MIN 1',
    teacherName: 'Guru',
    academicYear: '2024/2025',
    semester: 'Ganjil',
    assessmentType: 'SAS',
    subject: 'Fikih',
    grade: 4,
    phase: 'Fase B',
    topic: 'Shalat Berjamaah',
    learningObjectives: 'Menganalisis ketentuan shalat',
    durationMinutes: 90,
    multipleChoiceCount: 3,
    shortAnswerCount: 0,
    essayCount: 0,
    difficulty: 'Campuran',
    language: 'Indonesia',
    sourceMaterial: '',
    additionalNotes: '',
    status: 'completed',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    questions: [
      { id: '1', number: 1, type: 'multiple_choice', questionText: 'Soal 1', cognitiveLevel: 'L1 (Mengingat/Memahami)', score: 1 },
      { id: '2', number: 2, type: 'multiple_choice', questionText: 'Soal 2', cognitiveLevel: 'L2 (Menerapkan)', score: 1 },
      { id: '3', number: 3, type: 'multiple_choice', questionText: 'Soal 3', cognitiveLevel: 'L3 (Penalaran/HOTS)', score: 1 },
    ],
  };

  // 1. Without custom data (estimates)
  const estReport = analyzePackageItems(samplePkg);
  assert.equal(estReport.totalQuestions, 3);
  assert.ok(estReport.averageFacilityIndex > 0);
  assert.ok(estReport.averageDiscriminationIndex > 0);
  assert.equal(estReport.items.length, 3);

  // 2. With real student evaluation inputs
  const customData = {
    1: { totalCorrect: 26, totalStudents: 30, upperCorrect: 10, lowerCorrect: 7, groupSize: 10 }, // P = 0.87 (Mudah), D = 0.30 (Baik)
    2: { totalCorrect: 16, totalStudents: 30, upperCorrect: 8, lowerCorrect: 3, groupSize: 10 }, // P = 0.53 (Sedang), D = 0.50 (Sangat Baik)
    3: { totalCorrect: 6, totalStudents: 30, upperCorrect: 5, lowerCorrect: 1, groupSize: 10 }, // P = 0.20 (Sukar), D = 0.40 (Sangat Baik)
  };

  const realReport = analyzePackageItems(samplePkg, customData);
  assert.equal(realReport.items[0].facilityIndex, 0.87);
  assert.equal(realReport.items[0].difficultyCategory, 'Mudah');
  assert.equal(realReport.items[0].discriminationIndex, 0.3);

  assert.equal(realReport.items[1].facilityIndex, 0.53);
  assert.equal(realReport.items[1].difficultyCategory, 'Sedang');
  assert.equal(realReport.items[1].discriminationIndex, 0.5);

  assert.equal(realReport.items[2].facilityIndex, 0.2);
  assert.equal(realReport.items[2].difficultyCategory, 'Sukar');
  assert.equal(realReport.items[2].discriminationIndex, 0.4);

  // Quality assessment should be high
  assert.ok(realReport.averageDiscriminationIndex >= 0.35);
  assert.equal(realReport.overallQualityAssessment.grade, 'A (Sangat Berkualitas)');
});

test('exportItemAnalysisToExcel generates valid Excel Blob', () => {
  const samplePkg: QuestionPackage = {
    id: 'pkg_test_excel',
    title: 'Asesmen Fikih',
    schoolName: 'MIN 1',
    teacherName: 'Guru',
    academicYear: '2024/2025',
    semester: 'Ganjil',
    assessmentType: 'SAS',
    subject: 'Fikih',
    grade: 4,
    phase: 'Fase B',
    topic: 'Shalat',
    learningObjectives: 'Tujuan',
    durationMinutes: 90,
    multipleChoiceCount: 1,
    shortAnswerCount: 0,
    essayCount: 0,
    difficulty: 'Campuran',
    language: 'Indonesia',
    sourceMaterial: '',
    additionalNotes: '',
    status: 'completed',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    questions: [
      { id: '1', number: 1, type: 'multiple_choice', questionText: 'Soal 1', cognitiveLevel: 'L1 (Mengingat/Memahami)', score: 1 },
    ],
  };

  const report = analyzePackageItems(samplePkg);
  const blob = exportItemAnalysisToExcel(samplePkg, report, null);
  assert.ok(blob);
  assert.ok(blob.size > 1000);
  assert.equal(blob.type, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
});
