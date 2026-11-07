import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateGeneratorInput,
  validateGeminiResponseJson,
  sanitizeErrorMessage,
  handleGenerateQuestionsApi,
  normalizeGeminiModelName,
} from './generateQuestionsHandler.ts';
import type { GenerateQuestionsRequest } from '../types/index.ts';

test('validateGeneratorInput accepts valid request data', () => {
  const validRequest = {
    subject: 'Akidah Akhlak',
    grade: 5,
    topic: 'Kalimat Thayyibah Subhanallah dan Asmaul Husna',
    multipleChoiceCount: 5,
    shortAnswerCount: 2,
    essayCount: 1,
    assessmentType: 'SAS (Sumatif Akhir Semester)',
    difficulty: 'Sedang',
    language: 'id',
    schoolName: 'MI Al-Ikhlas',
    teacherName: 'Ustadz Ahmad',
    academicYear: '2024/2025',
    semester: '1 (Ganjil)',
  };

  const result = validateGeneratorInput(validRequest);
  assert.equal(result.isValid, true);
  assert.equal(result.error, undefined);
  assert.ok(result.data);
  assert.equal(result.data.subject, 'Akidah Akhlak');
  assert.equal(result.data.grade, 5);
});

test('validateGeneratorInput rejects missing required fields and invalid counts', () => {
  const missingTopic = {
    subject: 'Fiqih',
    grade: 5,
    topic: '',
    multipleChoiceCount: 5,
    shortAnswerCount: 2,
    essayCount: 1,
  };
  const val1 = validateGeneratorInput(missingTopic);
  assert.equal(val1.isValid, false);
  assert.match(val1.error || '', /Materi pokok wajib diisi/);

  const zeroQuestions = {
    subject: 'Fiqih',
    grade: 5,
    topic: 'Shalat Berjamaah',
    multipleChoiceCount: 0,
    shortAnswerCount: 0,
    essayCount: 0,
  };
  const val2 = validateGeneratorInput(zeroQuestions);
  assert.equal(val2.isValid, false);
  assert.match(val2.error || '', /Minimal harus meminta 1 butir soal/);

  const tooManyQuestions = {
    subject: 'Fiqih',
    grade: 5,
    topic: 'Shalat Berjamaah',
    multipleChoiceCount: 40,
    shortAnswerCount: 10,
    essayCount: 5, // 55 > 50
  };
  const val3 = validateGeneratorInput(tooManyQuestions);
  assert.equal(val3.isValid, false);
  assert.match(val3.error || '', /Maksimal jumlah soal per permintaan adalah 50 butir/);
});

test('validateGeminiResponseJson accepts strictly valid response and preserves exact counts', () => {
  const reqData: GenerateQuestionsRequest = {
    subject: 'Fiqih',
    grade: 4,
    topic: 'Ketentuan Shalat Berjamaah',
    multipleChoiceCount: 1,
    shortAnswerCount: 1,
    essayCount: 1,
    assessmentType: 'SAS',
  };

  const rawModelResponse = {
    packageTitle: 'Naskah SAS Fiqih Kelas 4',
    questions: [
      {
        number: 1,
        type: 'multiple_choice',
        questionText: 'Hukum shalat berjamaah bagi laki-laki menurut sebagian besar ulama adalah...',
        options: [
          { key: 'A', text: 'Sunnah Muakkad' },
          { key: 'B', text: 'Fardhu Kifayah' },
          { key: 'C', text: 'Mubah' },
          { key: 'D', text: 'Makruh' },
        ],
        answerKey: 'A',
        explanation: 'Shalat fardhu berjamaah di masjid berhukum sunnah muakkad.',
        cognitiveLevel: 'L1',
        score: 1,
        indicator: 'Siswa dapat menentukan hukum shalat berjamaah dengan tepat',
      },
      {
        number: 2,
        type: 'short_answer',
        questionText: 'Makmum yang terlambat mengikuti gerakan imam pada rakaat pertama disebut makmum...',
        answerKey: 'Masbuq',
        acceptedAnswers: ['Masbuk', 'Makmum Masbuq'],
        explanation: 'Makmum yang datang terlambat setelah imam ruku disebut makmum masbuq.',
        cognitiveLevel: 'L2',
        score: 2,
        indicator: 'Siswa dapat menyebutkan istilah makmum yang terlambat',
      },
      {
        number: 3,
        type: 'essay',
        questionText: 'Sebutkan 3 syarat menjadi imam shalat berjamaah!',
        answerKey: '1. Mengetahui syarat dan rukun shalat, 2. Fasih membaca Al-Quran, 3. Paling mengerti fiqih shalat.',
        explanation: 'Imam memimpin jalannya shalat sehingga bacaan dan pengetahuannya harus memadai.',
        cognitiveLevel: 'L3',
        score: 5,
        indicator: 'Siswa dapat menganalisis syarat-syarat imam shalat berjamaah',
        rubric: [
          { criteria: 'Menyebutkan 3 syarat dengan tepat dan jelas', score: 5 },
          { criteria: 'Menyebutkan 2 syarat dengan tepat', score: 3 },
          { criteria: 'Menyebutkan 1 syarat dengan tepat', score: 1 },
        ],
      },
    ],
  };

  const normalized = validateGeminiResponseJson(rawModelResponse, reqData);
  assert.equal(normalized.length, 3);

  // Check Multiple Choice
  const q1 = normalized[0];
  assert.equal(q1.number, 1);
  assert.equal(q1.type, 'multiple_choice');
  assert.equal(q1.options?.length, 4);
  assert.equal(q1.score, 1);
  assert.equal(q1.answerKey, 'A');
  assert.ok(q1.id.startsWith('q_'));

  // Check Short Answer
  const q2 = normalized[1];
  assert.equal(q2.number, 2);
  assert.equal(q2.type, 'short_answer');
  assert.equal(q2.score, 2);
  assert.equal(q2.answerKey, 'Masbuq');
  assert.deepEqual(q2.acceptedAnswers, ['Masbuk', 'Makmum Masbuq']);

  // Check Essay
  const q3 = normalized[2];
  assert.equal(q3.number, 3);
  assert.equal(q3.type, 'essay');
  assert.equal(q3.score, 5);
  assert.equal(q3.rubric?.length, 3);
  assert.equal(q3.rubric?.[0].criteria, 'Menyebutkan 3 syarat dengan tepat dan jelas');
});

test('validateGeminiResponseJson rejects count mismatches', () => {
  const reqData: GenerateQuestionsRequest = {
    subject: 'Bahasa Arab',
    grade: 3,
    topic: 'Adawatul Kitabiyyah',
    multipleChoiceCount: 2,
    shortAnswerCount: 1,
    essayCount: 0,
    assessmentType: 'Harian',
  };

  // Only 2 returned instead of 3
  const mismatchCount = {
    questions: [
      {
        type: 'multiple_choice',
        questionText: 'Arti qolamun adalah...',
        options: [{ key: 'A', text: 'Pena' }, { key: 'B', text: 'Buku' }, { key: 'C', text: 'Meja' }, { key: 'D', text: 'Kursi' }],
        answerKey: 'A',
      },
      {
        type: 'multiple_choice',
        questionText: 'Arti kitaabun adalah...',
        options: [{ key: 'A', text: 'Buku' }, { key: 'B', text: 'Pena' }, { key: 'C', text: 'Meja' }, { key: 'D', text: 'Kursi' }],
        answerKey: 'A',
      },
    ],
  };

  assert.throws(
    () => validateGeminiResponseJson(mismatchCount, reqData),
    /Jumlah butir soal tidak sesuai permintaan/
  );

  // 3 returned but wrong composition (3 MC, 0 Short Answer instead of 2 MC, 1 Short Answer)
  const wrongComposition = {
    questions: [
      {
        type: 'multiple_choice',
        questionText: 'Q1',
        options: [{ key: 'A', text: '1' }, { key: 'B', text: '2' }, { key: 'C', text: '3' }, { key: 'D', text: '4' }],
        answerKey: 'A',
      },
      {
        type: 'multiple_choice',
        questionText: 'Q2',
        options: [{ key: 'A', text: '1' }, { key: 'B', text: '2' }, { key: 'C', text: '3' }, { key: 'D', text: '4' }],
        answerKey: 'A',
      },
      {
        type: 'multiple_choice',
        questionText: 'Q3',
        options: [{ key: 'A', text: '1' }, { key: 'B', text: '2' }, { key: 'C', text: '3' }, { key: 'D', text: '4' }],
        answerKey: 'A',
      },
    ],
  };

  assert.throws(
    () => validateGeminiResponseJson(wrongComposition, reqData),
    /Komposisi Pilihan Ganda tidak sesuai/
  );
});

test('validateGeminiResponseJson rejects invalid MC options and bad answer keys', () => {
  const reqData: GenerateQuestionsRequest = {
    subject: 'IPA',
    grade: 4,
    topic: 'Bagian Tubuh Tumbuhan',
    multipleChoiceCount: 1,
    shortAnswerCount: 0,
    essayCount: 0,
    assessmentType: 'Harian',
  };

  // Only 3 options
  const only3Options = {
    questions: [
      {
        type: 'multiple_choice',
        questionText: 'Bagian tumbuhan yang menyerap air adalah...',
        options: [
          { key: 'A', text: 'Akar' },
          { key: 'B', text: 'Batang' },
          { key: 'C', text: 'Daun' },
        ],
        answerKey: 'A',
      },
    ],
  };

  assert.throws(
    () => validateGeminiResponseJson(only3Options, reqData),
    /harus memiliki tepat 4 opsi pilihan/
  );

  // Blank option text
  const blankOption = {
    questions: [
      {
        type: 'multiple_choice',
        questionText: 'Bagian tumbuhan yang menyerap air adalah...',
        options: [
          { key: 'A', text: 'Akar' },
          { key: 'B', text: '   ' },
          { key: 'C', text: 'Daun' },
          { key: 'D', text: 'Bunga' },
        ],
        answerKey: 'A',
      },
    ],
  };

  assert.throws(
    () => validateGeminiResponseJson(blankOption, reqData),
    /Teks pilihan B pada butir soal PG nomor 1 tidak boleh kosong/
  );

  // Invalid answerKey ('E')
  const invalidKey = {
    questions: [
      {
        type: 'multiple_choice',
        questionText: 'Bagian tumbuhan yang menyerap air adalah...',
        options: [
          { key: 'A', text: 'Akar' },
          { key: 'B', text: 'Batang' },
          { key: 'C', text: 'Daun' },
          { key: 'D', text: 'Bunga' },
        ],
        answerKey: 'E',
      },
    ],
  };

  assert.throws(
    () => validateGeminiResponseJson(invalidKey, reqData),
    /Kunci jawaban butir soal PG nomor 1 .* tidak valid/
  );
});

test('validateGeminiResponseJson rejects empty short answer key and invalid essay rubric', () => {
  const reqDataShort: GenerateQuestionsRequest = {
    subject: 'SKI',
    grade: 3,
    topic: 'Kelahiran Nabi Muhammad SAW',
    multipleChoiceCount: 0,
    shortAnswerCount: 1,
    essayCount: 0,
    assessmentType: 'Harian',
  };

  const emptyShortKey = {
    questions: [
      {
        type: 'short_answer',
        questionText: 'Nabi Muhammad SAW lahir di kota...',
        answerKey: '',
      },
    ],
  };

  assert.throws(
    () => validateGeminiResponseJson(emptyShortKey, reqDataShort),
    /Kunci jawaban butir soal isian singkat nomor 1 tidak boleh kosong/
  );

  const reqDataEssay: GenerateQuestionsRequest = {
    subject: 'SKI',
    grade: 3,
    topic: 'Kelahiran Nabi Muhammad SAW',
    multipleChoiceCount: 0,
    shortAnswerCount: 0,
    essayCount: 1,
    assessmentType: 'Harian',
  };

  const emptyRubric = {
    questions: [
      {
        type: 'essay',
        questionText: 'Ceritakan peristiwa menjelang kelahiran Nabi Muhammad SAW!',
        answerKey: 'Terjadi penyerbuan pasukan gajah...',
        rubric: [],
      },
    ],
  };

  assert.throws(
    () => validateGeminiResponseJson(emptyRubric, reqDataEssay),
    /Rubrik penskoran butir soal uraian nomor 1 wajib disertakan/
  );

  const invalidRubricScore = {
    questions: [
      {
        type: 'essay',
        questionText: 'Ceritakan peristiwa menjelang kelahiran Nabi Muhammad SAW!',
        answerKey: 'Terjadi penyerbuan pasukan gajah...',
        rubric: [{ criteria: 'Penjelasan lengkap', score: 0 }],
      },
    ],
  };

  assert.throws(
    () => validateGeminiResponseJson(invalidRubricScore, reqDataEssay),
    /Skor kriteria rubrik .* harus berupa angka lebih dari 0/
  );
});

test('sanitizeErrorMessage strips API keys and sensitive path details', () => {
  process.env.GEMINI_API_KEY = 'AIzaSyA_mockKey1234567890abcdefghijklm';
  
  const rawLeak = 'Error: API call failed with key AIzaSyA_mockKey1234567890abcdefghijklm at /app/applet/src/server/generateQuestionsHandler.ts:120';
  const sanitized = sanitizeErrorMessage(rawLeak);

  assert.ok(!sanitized.includes('AIzaSyA_mockKey1234567890abcdefghijklm'));
  assert.ok(sanitized.includes('[REDACTED_API_KEY]'));
  assert.ok(!sanitized.includes('/app/applet/src/server'));
});

test('handleGenerateQuestionsApi rejects non-POST and invalid payloads', async () => {
  // Test GET method
  let statusCode = 0;
  let responseData: any = null;

  const mockGetReq = { method: 'GET' };
  const mockRes = {
    status(code: number) {
      statusCode = code;
      return {
        json(data: any) {
          responseData = data;
        },
      };
    },
  };

  await handleGenerateQuestionsApi(mockGetReq, mockRes);
  assert.equal(statusCode, 405);
  assert.equal(responseData?.success, false);
  assert.match(responseData?.error, /Metode HTTP tidak diizinkan/);

  // Test invalid POST payload
  const mockPostReq = {
    method: 'POST',
    body: { subject: '', grade: 4, topic: '' },
  };

  await handleGenerateQuestionsApi(mockPostReq, mockRes);
  assert.equal(statusCode, 400);
  assert.equal(responseData?.success, false);
  assert.match(responseData?.error, /Mata pelajaran wajib diisi/);
});

test('sanitizeErrorMessage handles nested objects and stringified JSON without returning [object Object]', () => {
  // Test with Vercel error object
  const vercelTimeout = { code: 'FUNCTION_INVOCATION_TIMEOUT' };
  const sanitized1 = sanitizeErrorMessage(vercelTimeout);
  assert.notEqual(sanitized1, '[object Object]');
  assert.match(sanitized1, /Waktu pemrosesan di server Vercel habis/);

  // Test with GoogleGenAI JSON string
  const rawGoogleErr = JSON.stringify({
    error: {
      code: 429,
      status: 'RESOURCE_EXHAUSTED',
      message: 'Quota exceeded for resource',
    },
  });
  const sanitized2 = sanitizeErrorMessage(rawGoogleErr);
  assert.notEqual(sanitized2, '[object Object]');
  assert.match(sanitized2, /Batas kuota/);

  // Test with null/undefined
  assert.notEqual(sanitizeErrorMessage(null), '[object Object]');
  assert.notEqual(sanitizeErrorMessage(undefined), '[object Object]');
});

test('handleGenerateQuestionsApi handles missing API key securely and includes requestId', async () => {
  const originalKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;

  let statusCode = 0;
  let responseData: any = null;

  const mockPostReq = {
    method: 'POST',
    body: {
      subject: 'Pendidikan Pancasila',
      grade: 3,
      topic: 'Aku Anak Indonesia',
      multipleChoiceCount: 20,
      shortAnswerCount: 10,
      essayCount: 5,
    },
  };

  const mockRes = {
    status(code: number) {
      statusCode = code;
      return {
        json(data: any) {
          responseData = data;
        },
      };
    },
  };

  try {
    await handleGenerateQuestionsApi(mockPostReq, mockRes);
    assert.equal(statusCode, 500);
    assert.equal(responseData?.success, false);
    assert.ok(responseData?.requestId, 'Harus menyertakan requestId untuk pelacakan aman');
    assert.match(responseData?.error, /GEMINI_API_KEY belum dikonfigurasi/);
    assert.notEqual(responseData?.error, '[object Object]');
  } finally {
    if (originalKey) {
      process.env.GEMINI_API_KEY = originalKey;
    }
  }
});

test('normalizeGeminiModelName sanitizes quotes, models/ prefix, and invalid names', () => {
  // Test double and single quotes
  assert.equal(normalizeGeminiModelName('"gemini-2.5-flash"'), 'gemini-2.5-flash');
  assert.equal(normalizeGeminiModelName("'gemini-2.5-flash'"), 'gemini-2.5-flash');

  // Test models/ prefix
  assert.equal(normalizeGeminiModelName('models/gemini-2.5-flash'), 'gemini-2.5-flash');
  assert.equal(normalizeGeminiModelName(' models/gemini-2.5-flash '), 'gemini-2.5-flash');

  // Test deprecated models mapping
  assert.equal(normalizeGeminiModelName('gemini-1.5-flash'), 'gemini-2.5-flash');
  assert.equal(normalizeGeminiModelName('gemini-2.0-flash'), 'gemini-2.5-flash');

  // Test empty/undefined/invalid characters
  assert.equal(normalizeGeminiModelName(undefined), 'gemini-2.5-flash');
  assert.equal(normalizeGeminiModelName(''), 'gemini-2.5-flash');
  assert.equal(normalizeGeminiModelName('invalid model name!@#'), 'gemini-2.5-flash');
});

test('validateGeneratorInput accurately preserves all 3 imageMode choices', () => {
  const baseReq = {
    subject: 'IPA',
    grade: 4,
    topic: 'Metamorfosis Hewan',
    multipleChoiceCount: 5,
    shortAnswerCount: 2,
    essayCount: 1,
  };

  const resNone = validateGeneratorInput({ ...baseReq, imageMode: 'none' });
  assert.equal(resNone.data?.imageMode, 'none');

  const resManual = validateGeneratorInput({ ...baseReq, imageMode: 'manual' });
  assert.equal(resManual.data?.imageMode, 'manual');

  const resAi = validateGeneratorInput({ ...baseReq, imageMode: 'ai' });
  assert.equal(resAi.data?.imageMode, 'ai');

  // Invalid imageMode falls back to 'none' safely
  const resInvalid = validateGeneratorInput({ ...baseReq, imageMode: 'invalid_mode' });
  assert.equal(resInvalid.data?.imageMode, 'none');
});

test('generateQuestionImageAi handles missing API key and does not return fake images', async () => {
  const { generateQuestionImageAi } = await import('./generateQuestionsHandler.ts');

  // 1. Missing API key returns unavailable status safely
  const resMissing = await generateQuestionImageAi('Bagan rantai makanan', '');
  assert.equal(resMissing.success, false);
  assert.equal(resMissing.status, 'unavailable');
  assert.equal(resMissing.imageUrl, undefined, 'Must not return fake placeholder image');
  assert.match(resMissing.message, /GEMINI_API_KEY belum dikonfigurasi/);
});

test('validateGeneratorInput accurately preserves mcOptionCount 3 and 4', () => {
  const baseReq = {
    subject: 'Matematika',
    grade: 1,
    topic: 'Penjumlahan Bilangan 1-10',
    multipleChoiceCount: 5,
    shortAnswerCount: 2,
    essayCount: 1,
  };

  const res3 = validateGeneratorInput({ ...baseReq, mcOptionCount: 3 });
  assert.equal(res3.isValid, true);
  assert.equal(res3.data?.mcOptionCount, 3);

  const res4 = validateGeneratorInput({ ...baseReq, mcOptionCount: 4 });
  assert.equal(res4.isValid, true);
  assert.equal(res4.data?.mcOptionCount, 4);

  // Default to 4 if unspecified or invalid
  const resDefault = validateGeneratorInput(baseReq);
  assert.equal(resDefault.isValid, true);
  assert.equal(resDefault.data?.mcOptionCount, 4);
});

test('validateGeminiResponseJson validates 3 options (A, B, C) accurately for Fase A', () => {
  const reqData3: GenerateQuestionsRequest = {
    subject: 'Bahasa Indonesia',
    grade: 1,
    topic: 'Huruf Vokal dan Konsonan',
    multipleChoiceCount: 1,
    shortAnswerCount: 0,
    essayCount: 0,
    assessmentType: 'Formatif',
    mcOptionCount: 3,
  };

  const valid3OptionResponse = {
    packageTitle: 'Naskah Kelas 1',
    questions: [
      {
        number: 1,
        type: 'multiple_choice',
        questionText: 'Huruf pertama pada kata "Ayam" adalah...',
        options: [
          { key: 'A', text: 'A' },
          { key: 'B', text: 'B' },
          { key: 'C', text: 'C' },
        ],
        answerKey: 'A',
        explanation: 'Huruf pertama dari kata ayam adalah huruf A.',
        cognitiveLevel: 'L1',
        score: 1,
        indicator: 'Siswa dapat menentukan huruf awal kata',
      },
    ],
  };

  const result = validateGeminiResponseJson(valid3OptionResponse, reqData3);
  assert.equal(result.length, 1);
  assert.equal(result[0].options?.length, 3);
  assert.equal(result[0].answerKey, 'A');

  // Should reject if 4 options given when 3 were requested
  const invalid4OptionResponse = {
    packageTitle: 'Naskah Kelas 1',
    questions: [
      {
        number: 1,
        type: 'multiple_choice',
        questionText: 'Huruf pertama pada kata "Ayam" adalah...',
        options: [
          { key: 'A', text: 'A' },
          { key: 'B', text: 'B' },
          { key: 'C', text: 'C' },
          { key: 'D', text: 'D' },
        ],
        answerKey: 'A',
        explanation: 'Huruf awal kata ayam adalah A.',
        cognitiveLevel: 'L1',
        score: 1,
        indicator: 'Indikator',
      },
    ],
  };

  assert.throws(() => {
    validateGeminiResponseJson(invalid4OptionResponse, reqData3);
  }, /harus memiliki tepat 3 opsi pilihan/);

  // Should reject if key is 'D' when only 3 options (A, B, C) exist
  const invalidKeyResponse = {
    packageTitle: 'Naskah Kelas 1',
    questions: [
      {
        number: 1,
        type: 'multiple_choice',
        questionText: 'Huruf pertama pada kata "Ayam" adalah...',
        options: [
          { key: 'A', text: 'A' },
          { key: 'B', text: 'B' },
          { key: 'C', text: 'C' },
        ],
        answerKey: 'D', // Key D invalid for 3 options
        explanation: 'Huruf awal kata ayam adalah A.',
        cognitiveLevel: 'L1',
        score: 1,
        indicator: 'Indikator',
      },
    ],
  };

  assert.throws(() => {
    validateGeminiResponseJson(invalidKeyResponse, reqData3);
  }, /Kunci jawaban butir soal PG nomor 1 .* tidak valid/);
});

test('validateGeneratorInput accepts complexMultipleChoiceCount', () => {
  const reqWithCMC = {
    subject: 'Fiqih',
    grade: 5,
    topic: 'Zakat Fitrah',
    multipleChoiceCount: 3,
    complexMultipleChoiceCount: 2,
    shortAnswerCount: 2,
    essayCount: 1,
    assessmentType: 'SAS',
  };

  const result = validateGeneratorInput(reqWithCMC);
  assert.equal(result.isValid, true);
  assert.equal(result.data?.complexMultipleChoiceCount, 2);
  assert.equal(result.data?.multipleChoiceCount, 3);
});

test('validateGeminiResponseJson validates complex_multiple_choice with exactly 2 or 3 keys', () => {
  const reqData: GenerateQuestionsRequest = {
    subject: 'Ilmu Pengetahuan Alam',
    grade: 5,
    topic: 'Organ Pencernaan Manusia',
    multipleChoiceCount: 0,
    complexMultipleChoiceCount: 2,
    shortAnswerCount: 0,
    essayCount: 0,
    assessmentType: 'Formatif',
    mcOptionCount: 4,
  };

  // Valid response: Question 1 has 2 correct keys ('A, C'), Question 2 has 3 correct keys ('B, C, D')
  const validCMCResponse = {
    packageTitle: 'Asesmen IPA Kelas 5',
    questions: [
      {
        number: 1,
        type: 'complex_multiple_choice',
        questionText: 'Manakah 2 organ yang menghasilkan enzim untuk membantu pencernaan makanan? (Pilihlah 2 jawaban yang benar!)',
        options: [
          { key: 'A', text: 'Lambung' },
          { key: 'B', text: 'Kerongkongan' },
          { key: 'C', text: 'Pankreas' },
          { key: 'D', text: 'Usus Besar' },
        ],
        answerKey: 'A, C',
        explanation: 'Lambung menghasilkan pepsin & asam klorida, pankreas menghasilkan amilase & lipase.',
        cognitiveLevel: 'L2',
        score: 2,
        indicator: 'Mengidentifikasi organ penghasil enzim',
      },
      {
        number: 2,
        type: 'complex_multiple_choice',
        questionText: 'Pilihlah 3 kebiasaan hidup sehat untuk menjaga kesehatan organ lambung dan usus!',
        options: [
          { key: 'A', text: 'Makan larut malam lalu langsung tidur' },
          { key: 'B', text: 'Makan makanan kaya serat seperti sayur dan buah' },
          { key: 'C', text: 'Minum air putih yang cukup setiap hari' },
          { key: 'D', text: 'Mencuci tangan dengan sabun sebelum makan' },
        ],
        answerKey: 'B, C, D',
        explanation: 'Serat, hidrasi yang cukup, dan kebersihan tangan menjaga pencernaan tetap sehat.',
        cognitiveLevel: 'L2',
        score: 2,
        indicator: 'Menganalisis pola hidup sehat bagi pencernaan',
      },
    ],
  };

  const validated = validateGeminiResponseJson(validCMCResponse, reqData);
  assert.equal(validated.length, 2);
  assert.equal(validated[0].type, 'complex_multiple_choice');
  assert.equal(validated[0].answerKey, 'A, C');
  assert.equal(validated[1].type, 'complex_multiple_choice');
  assert.equal(validated[1].answerKey, 'B, C, D');

  // Test rejecting PG Kompleks with only 1 correct key
  const invalid1Key = {
    packageTitle: 'Asesmen IPA',
    questions: [
      {
        number: 1,
        type: 'complex_multiple_choice',
        questionText: 'Pilihlah organ tubuh!',
        options: [
          { key: 'A', text: 'Lambung' },
          { key: 'B', text: 'Batu' },
          { key: 'C', text: 'Air' },
          { key: 'D', text: 'Kayu' },
        ],
        answerKey: 'A', // Only 1 key!
        explanation: 'Penjelasan',
        score: 2,
      },
      {
        number: 2,
        type: 'complex_multiple_choice',
        questionText: 'Pilihlah organ tubuh!',
        options: [
          { key: 'A', text: 'Lambung' },
          { key: 'B', text: 'Hati' },
          { key: 'C', text: 'Usus' },
          { key: 'D', text: 'Kayu' },
        ],
        answerKey: 'A, B',
        explanation: 'Penjelasan',
        score: 2,
      },
    ],
  };

  assert.throws(() => {
    validateGeminiResponseJson(invalid1Key, reqData);
  }, /WAJIB memiliki 2 atau 3 opsi jawaban benar/);

  // Test rejecting PG Kompleks with 4 correct keys (when only 2 or 3 allowed)
  const invalid4Keys = {
    packageTitle: 'Asesmen IPA',
    questions: [
      {
        number: 1,
        type: 'complex_multiple_choice',
        questionText: 'Pilihlah organ tubuh!',
        options: [
          { key: 'A', text: 'Lambung' },
          { key: 'B', text: 'Hati' },
          { key: 'C', text: 'Usus' },
          { key: 'D', text: 'Mulut' },
        ],
        answerKey: 'A, B, C, D', // 4 keys not allowed
        explanation: 'Penjelasan',
        score: 2,
      },
      {
        number: 2,
        type: 'complex_multiple_choice',
        questionText: 'Pilihlah organ tubuh!',
        options: [
          { key: 'A', text: 'Lambung' },
          { key: 'B', text: 'Hati' },
          { key: 'C', text: 'Usus' },
          { key: 'D', text: 'Mulut' },
        ],
        answerKey: 'A, B',
        explanation: 'Penjelasan',
        score: 2,
      },
    ],
  };

  assert.throws(() => {
    validateGeminiResponseJson(invalid4Keys, reqData);
  }, /WAJIB memiliki 2 atau 3 opsi jawaban benar/);

  // Test rejecting PG Kompleks with key outside available options (e.g. 3 options A,B,C but answerKey includes 'D')
  const reqData3Opts: GenerateQuestionsRequest = {
    subject: 'IPA',
    grade: 2,
    topic: 'Hewan',
    multipleChoiceCount: 0,
    complexMultipleChoiceCount: 1,
    shortAnswerCount: 0,
    essayCount: 0,
    assessmentType: 'Formatif',
    mcOptionCount: 3,
  };

  const invalidKey3Opts = {
    packageTitle: 'Asesmen',
    questions: [
      {
        number: 1,
        type: 'complex_multiple_choice',
        questionText: 'Pilihlah hewan darat!',
        options: [
          { key: 'A', text: 'Kucing' },
          { key: 'B', text: 'Kambing' },
          { key: 'C', text: 'Ikan' },
        ],
        answerKey: 'A, D', // 'D' is invalid for 3 options
        explanation: 'Penjelasan',
        score: 2,
      },
    ],
  };

  assert.throws(() => {
    validateGeminiResponseJson(invalidKey3Opts, reqData3Opts);
  }, /Soal PG Kompleks WAJIB memiliki 2 atau 3 opsi jawaban benar/);
});


