import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractVisualSubjectFromText,
  translateKeywordsToEnglish,
  buildManualImagePrompt,
  buildAllPackageImagePrompts,
  AI_IMAGE_PLATFORMS,
} from './imagePromptBuilder.ts';
import { QuestionItem, QuestionPackage } from '../types/index.ts';

test('extractVisualSubjectFromText membersihkan frasa pembuka soal', () => {
  const q1 = 'Perhatikan gambar berikut! Manakah yang merupakan tumbuhan monokotil?';
  const res1 = extractVisualSubjectFromText(q1);
  assert.equal(res1, 'tumbuhan monokotil');

  const q2 = 'Berdasarkan gambar di samping, berapakah jumlah sudut siku-siku pada bangun layang-layang?';
  const res2 = extractVisualSubjectFromText(q2);
  assert.equal(res2, 'jumlah sudut siku-siku pada bangun layang-layang');

  const q3 = '';
  assert.equal(extractVisualSubjectFromText(q3), 'Ilustrasi materi pembelajaran edukatif');
});

test('translateKeywordsToEnglish menerjemahkan kata kunci materi madrasah ke bahasa Inggris', () => {
  assert.match(translateKeywordsToEnglish('tata cara wudhu yang benar'), /ablution/i);
  assert.match(translateKeywordsToEnglish('diagram rantai makanan sawah'), /food chain/i);
  assert.match(translateKeywordsToEnglish('bagian tumbuhan bunga'), /plant parts/i);
  assert.match(translateKeywordsToEnglish('jam dinding'), /clock/i);
});

test('buildManualImagePrompt menghasilkan prompt Indonesia dan Inggris yang lengkap', () => {
  const question: QuestionItem = {
    id: 'q_test_1',
    number: 3,
    type: 'multiple_choice',
    questionText: 'Perhatikan gambar berikut! Organ tubuh yang berfungsi memompa darah adalah...',
    imageAlt: 'Diagram organ jantung manusia dengan pembuluh darah utama',
  };

  const result = buildManualImagePrompt(question, {
    subject: 'IPAS',
    grade: 'Kelas 4',
    phase: 'Fase B',
  });

  assert.equal(result.questionNumber, 3);
  assert.equal(result.coreStimulus, 'Diagram organ jantung manusia dengan pembuluh darah utama');
  assert.match(result.indonesianPrompt, /Madrasah Ibtidaiyah/);
  assert.match(result.indonesianPrompt, /2D vektor/);
  assert.match(result.indonesianPrompt, /TANPA teks acak/);
  assert.match(result.englishPrompt, /Educational 2D vector/);
  assert.match(result.englishPrompt, /NO random text/);
  assert.equal(result.hasExistingImage, false);
});

test('buildAllPackageImagePrompts memproses seluruh soal dalam paket', () => {
  const pkg: QuestionPackage = {
    id: 'pkg_test_1',
    title: 'Asesmen Harian Fikih',
    schoolName: 'MIN 1 Kota',
    teacherName: 'Ustadzah Aminah',
    academicYear: '2024/2025',
    semester: 'Ganjil',
    assessmentType: 'Asesmen Harian',
    subject: 'Fikih',
    grade: 2,
    phase: 'Fase A',
    topic: 'Ketentuan Shalat',
    learningObjectives: 'Siswa dapat memahami gerakan shalat',
    durationMinutes: 60,
    multipleChoiceCount: 1,
    complexMultipleChoiceCount: 0,
    shortAnswerCount: 1,
    essayCount: 0,
    difficulty: 'Mudah',
    language: 'Bahasa Indonesia',
    sourceMaterial: '',
    additionalNotes: '',
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    questions: [
      {
        id: 'q1',
        number: 1,
        type: 'multiple_choice',
        questionText: 'Gerakan ruku yang benar ditunjukkan oleh gambar...',
        imageAlt: 'Anak laki-laki berpakaian muslim sedang melakukan gerakan ruku dengan punggung lurus',
      },
      {
        id: 'q2',
        number: 2,
        type: 'short_answer',
        questionText: 'Sebutkan bacaan sujud dalam shalat!',
      },
    ],
  };

  const results = buildAllPackageImagePrompts(pkg);
  assert.equal(results.length, 2);
  assert.equal(results[0].questionNumber, 1);
  assert.equal(results[1].questionNumber, 2);
  assert.ok(AI_IMAGE_PLATFORMS.length >= 4);
});
