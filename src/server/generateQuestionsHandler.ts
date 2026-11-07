/**
 * Handler Backend untuk Pembangkitan Soal Berbantuan Gemini AI
 * MADRASAH SMART SOAL — Tahap 2 & Final Audit Vercel
 * 
 * Kompatibel dengan Express (server.ts) dan Vercel Serverless Function (api/generate-questions.ts).
 */

import { GoogleGenAI, Type } from '@google/genai';
import type { GenerateQuestionsRequest, QuestionItem, AnswerOption, RubricItem, CognitiveLevel } from '../types/index.ts';
import { extractErrorMessage, parseErrorDetails } from '../utils/errorParser.ts';

// Redam warning [DEP0169] url.parse() yang dipicu oleh dependensi internal (Express 4/Vite/parseurl) di Node.js 22+
if (typeof process !== 'undefined' && typeof process.on === 'function') {
  process.on('warning', (warning: any) => {
    if (warning?.name === 'DeprecationWarning' && (warning?.code === 'DEP0169' || warning?.message?.includes('url.parse'))) {
      return;
    }
  });
}

/**
 * Sanitasi pesan error untuk mencegah kebocoran API Key atau path internal server
 * serta menjamin tidak pernah menghasilkan "[object Object]".
 */
export function sanitizeErrorMessage(raw: any): string {
  if (raw === null || raw === undefined) {
    return 'Terjadi kesalahan sistem internal.';
  }

  let message = extractErrorMessage(raw);

  // Redact specific API Key jika ada di process.env
  if (process.env.GEMINI_API_KEY) {
    message = message.split(process.env.GEMINI_API_KEY).join('[REDACTED_API_KEY]');
  }

  // Redact generic Google API Key regex (AIza...)
  message = message.replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_API_KEY]');

  // Redact internal absolute file paths (Linux /var/task, /app/applet, dsb)
  message = message.replace(/(?:\/[a-zA-Z0-9._-]+){3,}/g, (match: string) => {
    if (match.startsWith('/api/')) return match;
    return '[INTERNAL_PATH]';
  });

  return message;
}

/**
 * Validasi input permintaan sebelum memanggil Gemini API
 */
export function validateGeneratorInput(body: any): { isValid: boolean; error?: string; data?: GenerateQuestionsRequest } {
  if (!body || typeof body !== 'object') {
    return { isValid: false, error: 'Data permintaan tidak valid.' };
  }

  const {
    subject,
    grade,
    topic,
    multipleChoiceCount,
    shortAnswerCount,
    essayCount,
    assessmentType,
    difficulty,
    language,
    schoolName,
    teacherName,
    academicYear,
    semester,
    phase,
    learningObjectives,
    sourceMaterial,
    additionalNotes,
    imageMode,
    mcOptionCount,
    complexMultipleChoiceCount,
  } = body;

  if (!subject || typeof subject !== 'string' || subject.trim().length === 0) {
    return { isValid: false, error: 'Mata pelajaran wajib diisi.' };
  }

  const parsedGrade = Number(grade);
  if (!Number.isInteger(parsedGrade) || parsedGrade < 1 || parsedGrade > 6) {
    return { isValid: false, error: 'Tingkat kelas harus antara 1 sampai 6.' };
  }

  if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
    return { isValid: false, error: 'Materi pokok wajib diisi.' };
  }

  const mc = Math.max(0, Math.floor(Number(multipleChoiceCount) || 0));
  const cmc = Math.max(0, Math.floor(Number(complexMultipleChoiceCount) || 0));
  const sa = Math.max(0, Math.floor(Number(shortAnswerCount) || 0));
  const es = Math.max(0, Math.floor(Number(essayCount) || 0));
  const total = mc + cmc + sa + es;

  if (total <= 0) {
    return { isValid: false, error: 'Minimal harus meminta 1 butir soal (PG, PG Kompleks, Isian, atau Uraian).' };
  }

  if (total > 50) {
    return { isValid: false, error: 'Maksimal jumlah soal per permintaan adalah 50 butir demi stabilitas dan kualitas soal.' };
  }

  const validImageModes = ['none', 'manual', 'ai', 'both'];
  const normalizedImageMode = validImageModes.includes(imageMode) ? imageMode : 'none';
  const normalizedOptionCount: 3 | 4 = Number(mcOptionCount) === 3 ? 3 : 4;

  const rawTopics = Array.isArray(body.topics) ? body.topics : [];
  const cleanTopics = rawTopics
    .map((t: any) => ({
      id: String(t?.id || ''),
      topic: String(t?.topic || '').trim(),
      learningObjectives: String(t?.learningObjectives || '').trim(),
    }))
    .filter((t: any) => t.topic.length > 0);

  return {
    isValid: true,
    data: {
      subject: subject.trim(),
      grade: parsedGrade as any,
      phase: phase || (parsedGrade <= 2 ? 'Fase A' : parsedGrade <= 4 ? 'Fase B' : 'Fase C'),
      topic: topic.trim(),
      learningObjectives: (learningObjectives || '').trim(),
      topics: cleanTopics.length > 0 ? cleanTopics : undefined,
      durationMinutes: Math.max(1, Number(body.durationMinutes) || 90),
      multipleChoiceCount: mc,
      complexMultipleChoiceCount: cmc,
      shortAnswerCount: sa,
      essayCount: es,
      mcOptionCount: normalizedOptionCount,
      difficulty: difficulty || 'Campuran',
      language: language || 'Bahasa Indonesia',
      assessmentType: assessmentType || 'Asesmen Harian',
      schoolName: (schoolName || 'Madrasah Ibtidaiyah').trim(),
      teacherName: (teacherName || 'Guru Madrasah').trim(),
      academicYear: (academicYear || '2024/2025').trim(),
      semester: semester || 'Ganjil',
      sourceMaterial: (sourceMaterial || '').trim(),
      additionalNotes: (additionalNotes || '').trim(),
      imageMode: normalizedImageMode as any,
    },
  };
}

/**
 * Validasi dan normalisasi butir soal hasil dari Gemini AI.
 * Menegakkan standar ketat:
 * - Tidak mentolerir fallback opsi palsu atau default key 'A'
 * - Memeriksa kesesuaian jumlah exact PG, Isian, dan Uraian
 * - Memeriksa 4 opsi A, B, C, D tidak kosong dan kunci valid
 * - Memeriksa isian singkat dan rubrik penskoran uraian
 */
export function validateGeminiResponseJson(parsed: any, reqData: GenerateQuestionsRequest): QuestionItem[] {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Respons model bukan objek JSON yang valid.');
  }

  if (!Array.isArray(parsed.questions)) {
    throw new Error('Respons model tidak memiliki daftar butir pertanyaan (array questions).');
  }

  const expectedMC = reqData.multipleChoiceCount;
  const expectedComplexMC = reqData.complexMultipleChoiceCount || 0;
  const expectedShort = reqData.shortAnswerCount;
  const expectedEssay = reqData.essayCount;
  const expectedTotal = expectedMC + expectedComplexMC + expectedShort + expectedEssay;

  const rawQuestions = parsed.questions;

  // 1. Periksa total butir soal
  if (rawQuestions.length !== expectedTotal) {
    throw new Error(
      `Jumlah butir soal tidak sesuai permintaan. Diharapkan total ${expectedTotal} butir, namun model menghasilkan ${rawQuestions.length} butir.`
    );
  }

  // 2. Hitung dan verifikasi komposisi per jenis soal
  let countMC = 0;
  let countComplexMC = 0;
  let countShort = 0;
  let countEssay = 0;

  for (let i = 0; i < rawQuestions.length; i++) {
    const raw = rawQuestions[i];
    const rawType = String(raw?.type || '').toLowerCase();
    if (rawType.includes('kompleks') || rawType.includes('complex') || rawType === 'pg_kompleks' || rawType === 'complex_multiple_choice') {
      countComplexMC++;
    } else if (rawType.includes('choice') || rawType === 'pg' || rawType === 'pilihan_ganda' || rawType === 'multiple_choice') {
      countMC++;
    } else if (rawType.includes('short') || rawType.includes('isian') || rawType === 'short_answer') {
      countShort++;
    } else if (rawType.includes('essay') || rawType.includes('uraian')) {
      countEssay++;
    } else {
      throw new Error(`Butir soal nomor ${i + 1} memiliki jenis soal yang tidak dikenal: "${raw?.type}".`);
    }
  }

  if (countMC !== expectedMC) {
    throw new Error(
      `Komposisi Pilihan Ganda tidak sesuai. Diharapkan ${expectedMC} butir, tetapi model menghasilkan ${countMC} butir.`
    );
  }

  if (countComplexMC !== expectedComplexMC) {
    throw new Error(
      `Komposisi Pilihan Ganda Kompleks tidak sesuai. Diharapkan ${expectedComplexMC} butir, tetapi model menghasilkan ${countComplexMC} butir.`
    );
  }

  if (countShort !== expectedShort) {
    throw new Error(
      `Komposisi Isian Singkat tidak sesuai. Diharapkan ${expectedShort} butir, tetapi model menghasilkan ${countShort} butir.`
    );
  }

  if (countEssay !== expectedEssay) {
    throw new Error(
      `Komposisi Uraian tidak sesuai. Diharapkan ${expectedEssay} butir, tetapi model menghasilkan ${countEssay} butir.`
    );
  }

  // 3. Validasi butir demi butir secara berurutan
  const normalizedQuestions: QuestionItem[] = [];

  for (let i = 0; i < rawQuestions.length; i++) {
    const raw = rawQuestions[i];
    const itemNumber = i + 1;
    const rawType = String(raw?.type || '').toLowerCase();

    let questionType: 'multiple_choice' | 'complex_multiple_choice' | 'short_answer' | 'essay' = 'multiple_choice';
    if (rawType.includes('kompleks') || rawType.includes('complex') || rawType === 'pg_kompleks' || rawType === 'complex_multiple_choice') {
      questionType = 'complex_multiple_choice';
    } else if (rawType.includes('short') || rawType.includes('isian') || rawType === 'short_answer') {
      questionType = 'short_answer';
    } else if (rawType.includes('essay') || rawType.includes('uraian')) {
      questionType = 'essay';
    }

    const questionText = (raw?.questionText || raw?.question || '').trim();
    if (!questionText) {
      throw new Error(`Butir soal nomor ${itemNumber} tidak memiliki teks pertanyaan.`);
    }

    // Level kognitif
    let cognitiveLevel: CognitiveLevel = 'L1 (Mengingat/Memahami)';
    const cogStr = String(raw?.cognitiveLevel || '').toUpperCase();
    if (cogStr.includes('L3') || cogStr.includes('HOTS') || cogStr.includes('PENALARAN')) {
      cognitiveLevel = 'L3 (Penalaran/HOTS)';
    } else if (cogStr.includes('L2') || cogStr.includes('MENERAPKAN')) {
      cognitiveLevel = 'L2 (Menerapkan)';
    }

    const imageAlt = typeof raw?.imagePrompt === 'string' && raw.imagePrompt.trim()
      ? raw.imagePrompt.trim()
      : typeof raw?.imageAlt === 'string' && raw.imageAlt.trim()
      ? raw.imageAlt.trim()
      : undefined;

    const imageCaption = typeof raw?.imageCaption === 'string' && raw.imageCaption.trim()
      ? raw.imageCaption.trim()
      : undefined;

    // Tentukan materi pokok / bab asal soal (dari raw.topic jika ada, atau pencocokan, atau default)
    let itemTopic: string | undefined = undefined;
    if (typeof raw?.topic === 'string' && raw.topic.trim()) {
      itemTopic = raw.topic.trim();
    } else if (reqData.topics && reqData.topics.length > 0) {
      // Distribusikan secara seimbang ke daftar bab jika model tidak menyertakan
      const topicIndex = (itemNumber - 1) % reqData.topics.length;
      itemTopic = reqData.topics[topicIndex].topic;
    }

    const indicator = (raw?.indicator || `Disajikan stimulus terkait ${itemTopic || reqData.topic}, peserta didik dapat menjawab pertanyaan.`).trim();
    const explanation = (raw?.explanation || `Pembahasan: Mengacu pada pemahaman konsep materi ${itemTopic || reqData.topic}.`).trim();

    // Validasi Pilihan Ganda Biasa
    if (questionType === 'multiple_choice') {
      const expectedOptionCount = reqData.mcOptionCount === 3 ? 3 : 4;
      const expectedKeys = expectedOptionCount === 3 ? ['A', 'B', 'C'] : ['A', 'B', 'C', 'D'];
      const allowedKeyRegex = expectedOptionCount === 3 ? /[^ABC]/g : /[^ABCD]/g;
      const optionLettersDesc = expectedOptionCount === 3 ? 'A, B, atau C' : 'A, B, C, atau D';

      if (!Array.isArray(raw?.options) || raw.options.length !== expectedOptionCount) {
        throw new Error(
          `Butir soal PG nomor ${itemNumber} harus memiliki tepat ${expectedOptionCount} opsi pilihan (${expectedKeys.join(', ')}). Ditemukan ${Array.isArray(raw?.options) ? raw.options.length : 0} opsi.`
        );
      }

      const validOptions: AnswerOption[] = [];

      for (let j = 0; j < expectedOptionCount; j++) {
        const opt = raw.options[j];
        const key = expectedKeys[j];
        const optText = (
          typeof opt === 'object' && opt !== null
            ? (opt.text || opt.label || '')
            : typeof opt === 'string'
            ? opt
            : ''
        ).trim();

        if (!optText) {
          throw new Error(`Teks pilihan ${key} pada butir soal PG nomor ${itemNumber} tidak boleh kosong.`);
        }

        validOptions.push({ key, text: optText });
      }

      const rawKey = String(raw?.answerKey || raw?.correctAnswer || '').trim().toUpperCase();
      const cleanKey = rawKey.replace(allowedKeyRegex, '').slice(0, 1);

      if (!cleanKey || !expectedKeys.includes(cleanKey)) {
        throw new Error(
          `Kunci jawaban butir soal PG nomor ${itemNumber} ("${raw?.answerKey}") tidak valid. Harus menunjuk pada opsi ${optionLettersDesc}.`
        );
      }

      const score = Number(raw?.score) > 0 ? Number(raw.score) : 1;

      normalizedQuestions.push({
        id: `q_${Date.now()}_${itemNumber}_${Math.random().toString(36).substring(2, 6)}`,
        number: itemNumber,
        type: 'multiple_choice',
        questionText,
        options: validOptions,
        answerKey: cleanKey,
        explanation,
        score,
        indicator,
        cognitiveLevel,
        topic: itemTopic,
        imageAlt,
        imageCaption,
      });
    }

    // Validasi Pilihan Ganda Kompleks (2 atau 3 Kunci Benar)
    else if (questionType === 'complex_multiple_choice') {
      const expectedOptionCount = reqData.mcOptionCount === 3 ? 3 : 4;
      const expectedKeys = expectedOptionCount === 3 ? ['A', 'B', 'C'] : ['A', 'B', 'C', 'D'];

      if (!Array.isArray(raw?.options) || raw.options.length !== expectedOptionCount) {
        throw new Error(
          `Butir soal PG Kompleks nomor ${itemNumber} harus memiliki tepat ${expectedOptionCount} opsi pilihan (${expectedKeys.join(', ')}). Ditemukan ${Array.isArray(raw?.options) ? raw.options.length : 0} opsi.`
        );
      }

      const validOptions: AnswerOption[] = [];

      for (let j = 0; j < expectedOptionCount; j++) {
        const opt = raw.options[j];
        const key = expectedKeys[j];
        const optText = (
          typeof opt === 'object' && opt !== null
            ? (opt.text || opt.label || '')
            : typeof opt === 'string'
            ? opt
            : ''
        ).trim();

        if (!optText) {
          throw new Error(`Teks pilihan ${key} pada butir soal PG Kompleks nomor ${itemNumber} tidak boleh kosong.`);
        }

        validOptions.push({ key, text: optText });
      }

      // Kunci jawaban PG Kompleks: HARUS memiliki 2 atau 3 kunci jawaban yang benar
      const rawKeyInput = Array.isArray(raw?.answerKey)
        ? raw.answerKey.join(',')
        : Array.isArray(raw?.correctAnswers)
        ? raw.correctAnswers.join(',')
        : String(raw?.answerKey || raw?.correctAnswer || '').trim();

      const matches: string[] = rawKeyInput.toUpperCase().match(/[A-D]/g) || [];
      const extractedKeys: string[] = Array.from(new Set(matches))
        .filter((k) => expectedKeys.includes(k))
        .sort();

      if (extractedKeys.length < 2 || extractedKeys.length > 3) {
        throw new Error(
          `Kunci jawaban butir soal PG Kompleks nomor ${itemNumber} ("${rawKeyInput}") tidak valid. Soal PG Kompleks WAJIB memiliki 2 atau 3 opsi jawaban benar dari pilihan (${expectedKeys.join(', ')}). Ditemukan: ${extractedKeys.length} kunci (${extractedKeys.join(', ')}).`
        );
      }

      const cleanAnswerKey = extractedKeys.join(', ');
      const score = Number(raw?.score) > 0 ? Number(raw.score) : 2;

      normalizedQuestions.push({
        id: `q_${Date.now()}_${itemNumber}_${Math.random().toString(36).substring(2, 6)}`,
        number: itemNumber,
        type: 'complex_multiple_choice',
        questionText,
        options: validOptions,
        answerKey: cleanAnswerKey,
        explanation,
        score,
        indicator,
        cognitiveLevel,
        topic: itemTopic,
        imageAlt,
        imageCaption,
      });
    }

    // Validasi Isian Singkat
    else if (questionType === 'short_answer') {
      const rawAnswer = String(raw?.answerKey || raw?.correctAnswer || '').trim();
      if (!rawAnswer) {
        throw new Error(`Kunci jawaban butir soal isian singkat nomor ${itemNumber} tidak boleh kosong.`);
      }

      let acceptedAnswers: string[] = [];
      if (Array.isArray(raw?.acceptedAnswers)) {
        acceptedAnswers = raw.acceptedAnswers.map((a: any) => String(a).trim()).filter(Boolean);
      }
      if (acceptedAnswers.length === 0) {
        acceptedAnswers = [rawAnswer];
      }

      const score = Number(raw?.score) > 0 ? Number(raw.score) : 2;

      normalizedQuestions.push({
        id: `q_${Date.now()}_${itemNumber}_${Math.random().toString(36).substring(2, 6)}`,
        number: itemNumber,
        type: 'short_answer',
        questionText,
        answerKey: rawAnswer,
        acceptedAnswers,
        explanation,
        score,
        indicator,
        cognitiveLevel,
        topic: itemTopic,
        imageAlt,
        imageCaption,
      });
    }

    // Validasi Uraian / Essay
    else if (questionType === 'essay') {
      const rawAnswer = String(raw?.answerKey || raw?.pedomanJawaban || raw?.correctAnswer || '').trim();
      if (!rawAnswer) {
        throw new Error(`Pedoman jawaban butir soal uraian nomor ${itemNumber} tidak boleh kosong.`);
      }

      if (!Array.isArray(raw?.rubric) || raw.rubric.length === 0) {
        throw new Error(`Rubrik penskoran butir soal uraian nomor ${itemNumber} wajib disertakan.`);
      }

      const rubric: RubricItem[] = [];
      for (let rIdx = 0; rIdx < raw.rubric.length; rIdx++) {
        const rItem = raw.rubric[rIdx];
        const criteria = String(rItem?.criteria || '').trim();
        const rScore = Number(rItem?.score);

        if (!criteria) {
          throw new Error(`Kriteria rubrik penskoran ke-${rIdx + 1} pada soal uraian nomor ${itemNumber} tidak boleh kosong.`);
        }
        if (isNaN(rScore) || rScore <= 0) {
          throw new Error(`Skor kriteria rubrik ke-${rIdx + 1} pada soal uraian nomor ${itemNumber} harus berupa angka lebih dari 0.`);
        }

        rubric.push({ criteria, score: rScore });
      }

      const score = Number(raw?.score) > 0 ? Number(raw.score) : (rubric[0]?.score || 5);

      normalizedQuestions.push({
        id: `q_${Date.now()}_${itemNumber}_${Math.random().toString(36).substring(2, 6)}`,
        number: itemNumber,
        type: 'essay',
        questionText,
        answerKey: rawAnswer,
        rubric,
        explanation,
        score,
        indicator,
        cognitiveLevel,
        topic: itemTopic,
        imageAlt,
        imageCaption,
      });
    }
  }

  return normalizedQuestions;
}

/**
 * Helper untuk mengirim respons JSON yang kompatibel dengan Express, Vercel Serverless Function, dan Node http.ServerResponse
 */
export function sendJsonResponse(res: any, statusCode: number, payload: any) {
  if (!res || res.headersSent || res.writableEnded) {
    return;
  }

  try {
    if (typeof res.setHeader === 'function') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
  } catch {
    // Ignore jika header telah dikirim
  }

  // 1. Vercel Serverless / Express status chaining: res.status(code).json(payload)
  if (typeof res.status === 'function') {
    const chained = res.status(statusCode);
    if (chained && typeof chained.json === 'function') {
      return chained.json(payload);
    }
  }

  // 2. Direct res.json
  if (typeof res.json === 'function') {
    res.statusCode = statusCode;
    return res.json(payload);
  }

  // 3. Raw Node.js http.ServerResponse fallback
  res.statusCode = statusCode;
  res.end(JSON.stringify(payload));
}

/**
 * Helper untuk membaca body request secara aman, baik dari Express (req.body),
 * Vercel Serverless Function (req.body parsed/buffer), maupun stream Node IncomingMessage
 */
async function parseRequestBody(req: any): Promise<any> {
  // 1. Jika body sudah ada dan terisi (Vercel Serverless / Express middleware)
  if (req.body !== undefined && req.body !== null) {
    if (Buffer.isBuffer(req.body)) {
      const str = req.body.toString('utf8').trim();
      if (!str) return {};
      try {
        return JSON.parse(str);
      } catch {
        throw new Error('Format body permintaan harus berupa JSON yang valid.');
      }
    }

    if (typeof req.body === 'string') {
      const trimmed = req.body.trim();
      if (!trimmed) return {};
      try {
        return JSON.parse(trimmed);
      } catch {
        throw new Error('Format body permintaan harus berupa JSON yang valid.');
      }
    }
    return req.body;
  }

  // 2. Jika stream sudah ended atau tidak ada event on
  if (req.readableEnded || (req._readableState && req._readableState.ended)) {
    return {};
  }

  // 3. Jika stream masih terbuka (misalnya Connect / Vite dev middleware atau Node serverless)
  if (typeof req.on === 'function') {
    return new Promise((resolve, reject) => {
      let raw = '';
      const timer = setTimeout(() => {
        if (!raw.trim()) {
          resolve({});
        } else {
          try {
            resolve(JSON.parse(raw));
          } catch {
            reject(new Error('Format body permintaan harus berupa JSON yang valid.'));
          }
        }
      }, 5000); // 5 detik timeout agar tidak hang

      req.on('data', (chunk: any) => {
        raw += chunk;
        if (raw.length > 2 * 1024 * 1024) { // Batas 2MB
          clearTimeout(timer);
          reject(new Error('Ukuran payload permintaan melebihi batas 2MB.'));
        }
      });

      req.on('end', () => {
        clearTimeout(timer);
        const trimmed = raw.trim();
        if (!trimmed) {
          return resolve({});
        }
        try {
          resolve(JSON.parse(trimmed));
        } catch {
          reject(new Error('Format body permintaan harus berupa JSON yang valid.'));
        }
      });

      req.on('error', (err: any) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  return {};
}

/**
 * Normalisasi dan sanitasi nama model Gemini untuk mencegah error:
 * "* GenerateContentRequest.model: unexpected model name format"
 * Menghapus tanda kutip (yang sering tersalin saat input di Vercel Dashboard), whitespace, dan prefix models/
 */
export function normalizeGeminiModelName(rawModel?: string): string {
  if (!rawModel || typeof rawModel !== 'string') {
    return 'gemini-2.5-flash';
  }

  // 1. Bersihkan tanda kutip ganda/tunggal dan spasi di awal/akhir
  let cleaned = rawModel.trim().replace(/^["']|["']$/g, '').trim();

  // 2. Hapus prefix 'models/' jika ada (SDK @google/genai menambahkan prefix ini secara otomatis)
  if (cleaned.startsWith('models/')) {
    cleaned = cleaned.substring('models/'.length).trim();
  }

  // 3. Konversi model lama / deprecated ke model resmi yang stabil
  if (
    cleaned === 'gemini-1.5-flash' ||
    cleaned === 'gemini-1.5-pro' ||
    cleaned === 'gemini-2.0-flash' ||
    cleaned === 'gemini-pro' ||
    cleaned === 'gemini'
  ) {
    return 'gemini-2.5-flash';
  }

  // 4. Validasi format karakter (hanya alfanumerik, titik, dan strip)
  if (!/^[a-zA-Z0-9.-]+$/.test(cleaned) || cleaned.length < 3) {
    return 'gemini-2.5-flash';
  }

  return cleaned;
}

/**
 * Fungsi inti pembangkitan butir soal menggunakan Gemini API.
 * Mendukung percobaan perbaikan (1x retry) jika model mengembalikan format yang tidak valid.
 */
export async function generateQuestionsCore(reqData: GenerateQuestionsRequest): Promise<{ packageTitle: string; questions: QuestionItem[] }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error('GEMINI_API_KEY belum dikonfigurasi pada server environment. Silakan tambahkan GEMINI_API_KEY di panel Secrets AI Studio atau Environment Variables proyek Vercel Anda.');
  }

  const primaryModel = process.env.GEMINI_MODEL ? normalizeGeminiModelName(process.env.GEMINI_MODEL) : 'gemini-3.8-flash';
  const candidateModels = [
    primaryModel,
    'gemini-3.8-flash',
    'gemini-2.5-flash',
    'gemini-flash-latest',
  ].filter((v, i, a) => a.indexOf(v) === i);

  const isImageRequested = reqData.imageMode === 'ai' || reqData.imageMode === 'both';
  const expectedOptionCount = reqData.mcOptionCount === 3 ? 3 : 4;
  const expectedComplexMC = reqData.complexMultipleChoiceCount || 0;
  const expectedTotal = reqData.multipleChoiceCount + expectedComplexMC + reqData.shortAnswerCount + reqData.essayCount;
  const optionLetters = expectedOptionCount === 3 ? 'A, B, C' : 'A, B, C, D';
  const optionKeysDesc = expectedOptionCount === 3 ? 'A, B, atau C' : 'A, B, C, atau D';

  const formattedTopicsDetail = reqData.topics && reqData.topics.length > 0
    ? reqData.topics
        .map((t, idx) => `  ${idx + 1}. Materi: "${t.topic}"\n     Tujuan Pembelajaran: ${t.learningObjectives || 'Memahami dan menguasai konsep ' + t.topic}`)
        .join('\n')
    : `- Materi Pokok: ${reqData.topic}\n- Tujuan Pembelajaran (TP): ${reqData.learningObjectives || 'Sesuai Capaian Pembelajaran Fase ' + reqData.phase}`;

  // Susun instruksi komposisi butir soal secara dinamis sesuai jenis soal yang ditentukan guru
  const compositionLines: string[] = [];
  let sectionIndex = 1;

  if (reqData.multipleChoiceCount > 0) {
    compositionLines.push(
      `${sectionIndex++}. Pilihan Ganda (PG) Biasa: TEPAT ${reqData.multipleChoiceCount} butir ("type": "multiple_choice"). Setiap butir PG WAJIB memiliki tepat ${expectedOptionCount} opsi pilihan (${optionLetters}) dengan teks bermakna dan tepat 1 kunci jawaban benar (${optionKeysDesc}).`
    );
  } else {
    compositionLines.push(`- Pilihan Ganda (PG) Biasa: 0 butir (TIDAK ADA SOAL PG BIASA, JANGAN BUAT).`);
  }

  if (expectedComplexMC > 0) {
    compositionLines.push(
      `${sectionIndex++}. Pilihan Ganda (PG) Kompleks: TEPAT ${expectedComplexMC} butir ("type": "complex_multiple_choice"). Setiap butir PG Kompleks WAJIB memiliki tepat ${expectedOptionCount} opsi pilihan (${optionLetters}) dan WAJIB memiliki TEPAT 2 ATAU 3 KUNCI JAWABAN BENAR (contoh "answerKey": "A, C" atau "B, C, D"). Di akhir teks pertanyaan, wajib sertakan petunjuk yang sesuai, contoh: "(Pilihlah 2 jawaban yang benar!)" atau "(Pilihlah 3 jawaban yang benar!)".`
    );
  } else {
    compositionLines.push(`- Pilihan Ganda (PG) Kompleks: 0 butir (TIDAK ADA SOAL PG KOMPLEKS, JANGAN BUAT).`);
  }

  if (reqData.shortAnswerCount > 0) {
    compositionLines.push(
      `${sectionIndex++}. Isian Singkat: TEPAT ${reqData.shortAnswerCount} butir ("type": "short_answer"). Pertanyaan lugas dengan kunci jawaban jelas dan variasi acceptedAnswers.`
    );
  } else {
    compositionLines.push(`- Isian Singkat: 0 butir (TIDAK ADA SOAL ISIAN SINGKAT, JANGAN BUAT).`);
  }

  if (reqData.essayCount > 0) {
    compositionLines.push(
      `${sectionIndex++}. Uraian / Essay: TEPAT ${reqData.essayCount} butir ("type": "essay"). Pertanyaan penalaran dengan pedoman jawaban lengkap serta rubrik penskoran bertingkat (criteria & score > 0).`
    );
  } else {
    compositionLines.push(`- Uraian / Essay: 0 butir (TIDAK ADA SOAL URAIAN, JANGAN BUAT).`);
  }

  const basePrompt = `Anda adalah Tim Ahli Kurikulum dan Penyusun Asesmen Madrasah Ibtidaiyah (MI) Kementerian Agama Republik Indonesia.
Tugas Anda adalah menyusun butir soal asesmen pembelajaran berkualitas tinggi, ramah anak usia MI, bebas bias, dan sesuai kaidah pedagogis Kurikulum Merdeka.

IDENTITAS ASESMEN:
- Madrasah: ${reqData.schoolName}
- Mata Pelajaran: ${reqData.subject}
- Kelas: ${reqData.grade} (${reqData.phase})
- Semester: ${reqData.semester} — TP: ${reqData.academicYear}
- Jenis Asesmen: ${reqData.assessmentType}
- Bahasa Pengantar: ${reqData.language}
- Tingkat Kesulitan: ${reqData.difficulty}

DAFTAR MATERI POKOK / BAB DAN TUJUAN PEMBELAJARAN (TP):
${formattedTopicsDetail}
${reqData.topics && reqData.topics.length > 1 ? `CATATAN PENTING DISTRIBUSI BAB: Soal asesmen harus didistribusikan secara proporsional dan merata ke seluruh materi pokok/bab di atas. Setiap butir soal WAJIB menyertakan nama bab asalnya pada atribut "topic".\n` : ''}
${reqData.sourceMaterial ? `- Sumber / Acuan Materi: ${reqData.sourceMaterial}` : '- Sumber Acuan: (Gunakan konsep pokok standar mapel MI, JANGAN mengarang nomor halaman buku, ayat, atau hadis palsu)'}
${reqData.additionalNotes ? `- Catatan Khusus Guru: ${reqData.additionalNotes}` : ''}
${isImageRequested ? `
KEBUTUHAN SOAL BERGAMBAR:
Guru mengaktifkan mode stimulus visual gambar untuk asesmen ini.
Pada butir-butir soal yang secara konsep memerlukan pengamatan visual (seperti diagram, bagan, daur hidup, rantai makanan, denah/peta, bangun datar/ruang, instrumen/alat, atau ilustrasi situasi):
- "imagePrompt": Berikan deskripsi visual gambar stimulus yang jelas, edukatif, dan ramah anak usia MI (contoh: "Ilustrasi bagan daur hidup kupu-kupu dengan 4 tahapan berurutan diberi label A, B, C, D").
- "imageCaption": Berikan judul keterangan gambar singkat (contoh: "Gambar 1. Daur Hidup Kupu-Kupu").
Untuk butir soal yang tidak memerlukan visual gambar, isi "imagePrompt" dan "imageCaption" dengan string kosong ("").
` : ''}

TARGET KOMPOSISI BUTIR SOAL (WAJIB TEPAT):
${compositionLines.join('\n')}
TOTAL KESELURUHAN: TEPAT ${expectedTotal} butir soal, diberi nomor urut 1 sampai ${expectedTotal}. JANGAN menghasilkan jenis soal yang bernilai 0.

KETENTUAN KHUSUS MADRASAH IBTIDAIYAH:
- Bahasa disesuaikan dengan tingkat usia Kelas ${reqData.grade} (${reqData.grade <= 2 ? 'kalimat pendek dan kata sederhana' : 'kontekstual dan edukatif'}).
- Untuk mapel keagamaan (Al-Qur'an Hadis, Akidah Akhlak, Fikih, SKI, Bahasa Arab), gunakan konteks santun dan nilai akhlak karimah.
- JANGAN mengarang ayat Al-Qur'an, hadis nabi, atau rujukan kitab secara palsu.
- Setiap butir soal WAJIB menyertakan:
  * "indicator": Indikator capaian soal
  * "cognitiveLevel": Level kognitif ("L1 (Mengingat/Memahami)", "L2 (Menerapkan)", atau "L3 (Penalaran/HOTS)")
  * "explanation": Pembahasan lengkap untuk guru
  * "score": Bobot skor (PG default 1, PG Kompleks default 2, Isian default 2, Uraian default 3-5).

PEDOMAN EFISIENSI & KECEPATAN (SANGAT PENTING):
- Untuk butir PG dan Isian: Tuliskan "explanation" dan "indicator" secara ringkas, padat, dan esensial (1-2 kalimat efektif).
- Untuk butir Uraian: Berikan pedoman jawaban yang jelas dan 2-3 kriteria rubrik penskoran yang proporsional.
- Jangan bertele-tele atau mengulang kalimat soal agar generasi selesai dalam waktu kilat (<15 detik).`;

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      packageTitle: {
        type: Type.STRING,
        description: 'Judul resmi paket naskah soal',
      },
      questions: {
        type: Type.ARRAY,
        description: 'Daftar butir soal lengkap',
        items: {
          type: Type.OBJECT,
          properties: {
            number: { type: Type.INTEGER, description: 'Nomor urut soal' },
            type: { type: Type.STRING, description: 'multiple_choice | complex_multiple_choice | short_answer | essay' },
            questionText: { type: Type.STRING, description: 'Teks butir pertanyaan' },
            options: {
              type: Type.ARRAY,
              description: `Tepat ${expectedOptionCount} opsi pilihan untuk PG (${optionLetters})`,
              items: {
                type: Type.OBJECT,
                properties: {
                  key: { type: Type.STRING, description: `Huruf opsi pilihan (${optionKeysDesc})` },
                  text: { type: Type.STRING, description: 'Teks opsi pilihan' },
                },
                required: ['key', 'text'],
              },
            },
            answerKey: { type: Type.STRING, description: 'Kunci jawaban benar (untuk PG Kompleks: tuliskan 2 atau 3 huruf kunci benar dipisahkan koma, contoh: "A, C" atau "A, B, D")' },
            acceptedAnswers: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Variasi jawaban benar untuk isian singkat',
            },
            explanation: { type: Type.STRING, description: 'Pembahasan ringkas untuk guru' },
            score: { type: Type.INTEGER, description: 'Bobot nilai skor butir soal' },
            indicator: { type: Type.STRING, description: 'Indikator ketercapaian soal' },
            cognitiveLevel: { type: Type.STRING, description: 'L1 (Mengingat/Memahami), L2 (Menerapkan), atau L3 (Penalaran/HOTS)' },
            imagePrompt: { type: Type.STRING, description: 'Deskripsi gambar stimulus jika soal memerlukan visual' },
            imageCaption: { type: Type.STRING, description: 'Keterangan judul gambar' },
            topic: { type: Type.STRING, description: 'Materi pokok / bab asal soal ini' },
            rubric: {
              type: Type.ARRAY,
              description: 'Kriteria rubrik penskoran uraian',
              items: {
                type: Type.OBJECT,
                properties: {
                  criteria: { type: Type.STRING, description: 'Deskripsi kriteria jawaban' },
                  score: { type: Type.INTEGER, description: 'Skor yang diperoleh' },
                },
                required: ['criteria', 'score'],
              },
            },
          },
          required: ['number', 'type', 'questionText', 'answerKey', 'explanation', 'score', 'indicator', 'cognitiveLevel'],
        },
      },
    },
    required: ['packageTitle', 'questions'],
  };

  let lastValidationErrorMessage = '';
  const startTime = Date.now();
  const MAX_SERVERLESS_SAFE_DURATION_MS = 48_000; // Batas aman 48 detik (sebelum hard limit 60s Vercel)

  // Mencoba model dengan mekanisme percobaan perbaikan jika validasi format gagal (maksimal 2 siklus)
  for (let attempt = 0; attempt < 2; attempt++) {
    const promptToSend = attempt === 0
      ? basePrompt
      : `${basePrompt}\n\nPERINGATAN PERBAIKAN SISTEM (Percobaan ke-2):\nHasil sebelumnya ditolak karena: ${lastValidationErrorMessage}.\nPastikan seluruh butir soal memenuhi validasi ketat di atas: Tepat ${reqData.multipleChoiceCount} PG Biasa, ${expectedComplexMC > 0 ? `${expectedComplexMC} PG Kompleks (tepat 2 atau 3 kunci benar), ` : ''}${reqData.shortAnswerCount} Isian, dan ${reqData.essayCount} Uraian dengan rubrik penskoran.`;

    for (let i = 0; i < candidateModels.length; i++) {
      const modelToTry = candidateModels[i];
      let rawText = '';

      // Periksa sisa waktu sebelum memanggil model baru
      const elapsedMs = Date.now() - startTime;
      if (elapsedMs > MAX_SERVERLESS_SAFE_DURATION_MS - 15_000) {
        throw new Error(
          `Waktu pemrosesan di server Vercel mendekati batas maksimal 60 detik (telah berjalan ${Math.round(elapsedMs / 1000)} detik). Disarankan membuat dalam jumlah 10-15 butir per sesi atau gunakan tombol "Susun Mandiri di Editor Soal".`
        );
      }

      try {
        const genConfig: any = {
          responseMimeType: 'application/json',
          responseSchema,
          temperature: 0.2,
        };

        // KUNCI UTAMA KECEPATAN: Matikan thinking tokens HANYA pada model Gemini 2.5
        // Model 2.5 Flash mengaktifkan mode thinking secara default yang memakan waktu 30-50 detik.
        // Dengan thinkingBudget: 0, model 2.5 langsung menghasilkan JSON tanpa delay.
        // Model lain seperti gemini-3.8-flash dan gemini-flash-latest tidak menggunakan thinkingConfig.
        if (modelToTry.includes('2.5')) {
          try {
            genConfig.thinkingConfig = { thinkingBudget: 0 };
          } catch {
            // Abaikan jika tidak didukung versi SDK tertentu
          }
        }

        const response = await ai.models.generateContent({
          model: modelToTry,
          contents: promptToSend,
          config: genConfig,
        });

        rawText = response.text || '';
        if (!rawText.trim()) {
          throw new Error('Gemini API mengembalikan respons teks kosong.');
        }

        let parsed: any;
        try {
          parsed = JSON.parse(rawText);
        } catch (parseErr: any) {
          throw new Error(`Gagal mengurai respons JSON model: ${parseErr?.message || 'Format tidak valid'}`);
        }

        // Jalankan validasi ketat
        const questions = validateGeminiResponseJson(parsed, reqData);
        const packageTitle = parsed.packageTitle || `${reqData.assessmentType} ${reqData.subject} Kelas ${reqData.grade} — ${reqData.topic}`;

        // Jika mode gambar AI dipilih, coba generate gambar secara aman tanpa melanggar batas waktu Vercel
        const shouldCallAiImageGenerator = reqData.imageMode === 'ai';
        if (shouldCallAiImageGenerator) {
          let aiServiceBlocked = false;
          let blockedMessage = '';

          for (let qIdx = 0; qIdx < questions.length; qIdx++) {
            const q = questions[qIdx];
            if (q.imageAlt && q.imageAlt.length > 5) {
              // Jika sisa waktu serverless kurang dari 18 detik, tangguhkan pembuatan gambar ke Editor Soal
              const remainingTime = MAX_SERVERLESS_SAFE_DURATION_MS - (Date.now() - startTime);
              if (remainingTime < 18_000) {
                q.imageAiStatus = {
                  status: 'unavailable',
                  message: 'Gambar AI dapat digenerate secara langsung pada kartu butir soal ini di Editor Soal (agar proses tidak terkena timeout 60 detik Vercel).',
                };
                if (!q.imageCaption) {
                  q.imageCaption = `Gambar Soal ${q.number}`;
                }
                continue;
              }

              if (aiServiceBlocked) {
                // Jangan membuat permintaan berulang ke API setelah akses ditolak!
                q.imageAiStatus = {
                  status: 'quota_exceeded',
                  message: blockedMessage || 'Layanan Image Generation Google AI memerlukan API Key dengan penagihan aktif (Pay-as-you-go). Silakan unggah gambar manual guru melalui Editor Soal atau aktifkan billing.',
                };
                if (!q.imageCaption) {
                  q.imageCaption = `Gambar Soal ${q.number}`;
                }
                continue;
              }

              try {
                const imgRes = await generateQuestionImageAi(q.imageAlt, apiKey);
                if (imgRes.success && imgRes.imageUrl) {
                  q.imageUrl = imgRes.imageUrl;
                  q.imageAiStatus = { status: 'success' };
                } else {
                  q.imageAiStatus = {
                    status: imgRes.status,
                    message: imgRes.message,
                  };
                  if (imgRes.status === 'quota_exceeded' || imgRes.status === 'unavailable') {
                    aiServiceBlocked = true;
                    blockedMessage = imgRes.message;
                    console.warn(`[API Image Diagnostic] Layanan Image AI ditolak (${imgRes.status}): ${imgRes.message}. Menghentikan permintaan berulang.`);
                  }
                }
              } catch (imageErr: any) {
                aiServiceBlocked = true;
                blockedMessage = 'Layanan Image Generation Google AI memerlukan API Key dengan penagihan aktif (Pay-as-you-go). Silakan unggah gambar manual guru melalui Editor Soal atau aktifkan billing.';
                q.imageAiStatus = {
                  status: 'quota_exceeded',
                  message: blockedMessage,
                };
              }

              if (!q.imageCaption) {
                q.imageCaption = `Gambar Soal ${q.number}`;
              }
            }
          }
        }

        return {
          packageTitle,
          questions,
        };
      } catch (err: any) {
        const errMsg = String(err?.message || err);

        // Jangan menyamarkan kesalahan autentikasi / permission / key tidak valid
        const isAuthError =
          errMsg.includes('API_KEY_INVALID') ||
          errMsg.includes('API key not valid') ||
          errMsg.includes('PERMISSION_DENIED') ||
          errMsg.includes('UNAUTHENTICATED') ||
          errMsg.includes('401') ||
          errMsg.includes('403');

        if (isAuthError) {
          throw new Error('Kunci API Gemini tidak valid atau tidak memiliki izin akses. Periksa konfigurasi GEMINI_API_KEY Anda.');
        }

        // Jika kesalahan adalah kegagalan validasi butir soal, simpan untuk siklus perbaikan
        const isValidationError = errMsg.startsWith('Jumlah butir soal tidak sesuai') ||
          errMsg.startsWith('Komposisi') ||
          errMsg.startsWith('Butir soal') ||
          errMsg.startsWith('Teks pilihan') ||
          errMsg.startsWith('Kunci jawaban butir soal') ||
          errMsg.startsWith('Pedoman jawaban') ||
          errMsg.startsWith('Rubrik penskoran') ||
          errMsg.includes('JSON');

        if (isValidationError) {
          lastValidationErrorMessage = errMsg;
          // Lanjutkan ke model berikutnya atau siklus perbaikan jika waktu masih mencukupi
          if (i < candidateModels.length - 1 && Date.now() - startTime < MAX_SERVERLESS_SAFE_DURATION_MS - 15_000) {
            continue;
          }
          break; // Keluar dari loop model untuk mencoba siklus perbaikan prompt
        }

        // Penanganan beban tinggi sementara atau pembatasan frekuensi kuota (503 / 429)
        const isQuotaOrRateLimit =
          errMsg.includes('429') ||
          errMsg.includes('QUOTA') ||
          errMsg.includes('RESOURCE_EXHAUSTED') ||
          errMsg.includes('quota metric') ||
          errMsg.includes('rate limit');

        const isTemporaryFailure =
          isQuotaOrRateLimit ||
          errMsg.includes('503') ||
          errMsg.includes('UNAVAILABLE') ||
          errMsg.includes('high demand');

        if (isTemporaryFailure) {
          if (i < candidateModels.length - 1) {
            const delayMs = isQuotaOrRateLimit ? 2000 : 1200;
            if (Date.now() - startTime + delayMs < MAX_SERVERLESS_SAFE_DURATION_MS - 12_000) {
              console.warn(`[Gemini Handler] Model ${modelToTry} mengalami ${isQuotaOrRateLimit ? 'limit frekuensi/kuota (429)' : 'beban tinggi sementara (503)'}. Menunggu jeda ${delayMs}ms sebelum mencoba model alternatif ${candidateModels[i + 1]}...`);
              await new Promise((resolve) => setTimeout(resolve, delayMs));
              continue;
            }
          } else if (attempt === 0 && Date.now() - startTime < MAX_SERVERLESS_SAFE_DURATION_MS - 15_000) {
            console.warn(`[Gemini Handler] Seluruh model mengalami beban tinggi (503). Menunggu jeda 1200ms sebelum mencoba siklus kedua...`);
            await new Promise((resolve) => setTimeout(resolve, 1200));
            break;
          }
        }

        // Penanganan nama model tidak valid, format salah, atau model sudah di-sunset (fallback otomatis)
        const isModelNameError =
          errMsg.includes('unexpected model name format') ||
          errMsg.includes('is not found') ||
          errMsg.includes('not supported') ||
          errMsg.includes('no longer available') ||
          errMsg.includes('is no longer available') ||
          errMsg.includes('404');

        if (isModelNameError && i < candidateModels.length - 1) {
          console.warn(`Model ${modelToTry} mengalami kendala ketersediaan (${errMsg}). Mencoba model alternatif ${candidateModels[i + 1]}...`);
          continue;
        }

        throw err;
      }
    }
  }

  // Jika setelah percobaan perbaikan tetap gagal
  throw new Error(
    lastValidationErrorMessage
      ? `Hasil dari model AI belum memenuhi kaidah validasi naskah asesmen: ${lastValidationErrorMessage}`
      : 'Gagal menghasilkan butir soal yang valid dari model AI.'
  );
}

/**
 * HTTP Handler umum untuk Express dan Vercel Serverless Function
 */
export async function handleGenerateQuestionsApi(req: any, res: any) {
  if (req.method !== 'POST') {
    return sendJsonResponse(res, 405, {
      success: false,
      error: 'Metode HTTP tidak diizinkan. Gunakan POST.',
    });
  }

  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const startTime = Date.now();
  let currentStage = 'PARSE_REQUEST';

  try {
    currentStage = 'PARSE_REQUEST';
    const body = await parseRequestBody(req);

    currentStage = 'VALIDATE_INPUT';
    const validation = validateGeneratorInput(body);
    if (!validation.isValid || !validation.data) {
      console.warn(`[API Diagnostic - ${requestId}] Validasi input gagal:`, {
        stage: currentStage,
        error: validation.error,
        durationMs: Date.now() - startTime,
      });
      return sendJsonResponse(res, 400, {
        success: false,
        error: validation.error || 'Data permintaan tidak valid.',
        requestId,
        category: 'VALIDATION_ERROR',
      });
    }

    currentStage = 'CALL_GEMINI_MODEL';
    const result = await generateQuestionsCore(validation.data);

    currentStage = 'COMPLETED';
    return sendJsonResponse(res, 200, {
      success: true,
      packageTitle: result.packageTitle,
      questions: result.questions,
      requestId,
    });
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    const sanitizedLogMessage = sanitizeErrorMessage(error);
    const parsed = parseErrorDetails(error);

    let statusCode = 500;
    let errorCategory = 'INTERNAL_SERVER_ERROR';

    const rawMessage = (typeof error === 'string' ? error : error?.message || '').toString();
    const upperRaw = (rawMessage + ' ' + (error?.code || '')).toUpperCase();

    const isApiKeyMissing = rawMessage.includes('GEMINI_API_KEY belum dikonfigurasi');
    const isAuthError =
      parsed.category === 'AUTH' ||
      upperRaw.includes('KUNCI API GEMINI TIDAK VALID') ||
      upperRaw.includes('API_KEY_INVALID') ||
      upperRaw.includes('API KEY NOT VALID') ||
      upperRaw.includes('PERMISSION_DENIED') ||
      upperRaw.includes('UNAUTHENTICATED') ||
      upperRaw.includes('401') ||
      upperRaw.includes('403');

    const isQuotaOrRateLimit =
      parsed.category === 'QUOTA' ||
      upperRaw.includes('RESOURCE_EXHAUSTED') ||
      upperRaw.includes('QUOTA') ||
      upperRaw.includes('RATE LIMIT') ||
      upperRaw.includes('429');

    const isTimeout =
      parsed.category === 'TIMEOUT' ||
      upperRaw.includes('TIMEOUT') ||
      upperRaw.includes('TIMED OUT') ||
      upperRaw.includes('DEADLINE_EXCEEDED') ||
      upperRaw.includes('504');

    const isHighDemandOrUnavailable =
      parsed.category === 'SERVICE' ||
      upperRaw.includes('503') ||
      upperRaw.includes('UNAVAILABLE') ||
      upperRaw.includes('HIGH DEMAND');

    const isValidationError =
      parsed.category === 'VALIDATION' ||
      upperRaw.includes('DATA PERMINTAAN TIDAK VALID') ||
      upperRaw.includes('UKURAN PAYLOAD PERMINTAAN MELEBIHI') ||
      upperRaw.includes('WAJIB DIISI') ||
      upperRaw.includes('FORMAT BODY PERMINTAAN HARUS BERUPA JSON');

    const isModelOutputError =
      upperRaw.includes('HASIL DARI MODEL AI BELUM MEMENUHI') ||
      upperRaw.includes('JUMLAH BUTIR SOAL TIDAK SESUAI') ||
      upperRaw.includes('RESPONS MODEL TIDAK MEMILIKI DAFTAR');

    if (isValidationError) {
      statusCode = 400;
      errorCategory = 'VALIDATION_ERROR';
    } else if (isAuthError) {
      statusCode = 401;
      errorCategory = 'AUTH_ERROR';
    } else if (isQuotaOrRateLimit) {
      statusCode = 429;
      errorCategory = 'QUOTA_EXCEEDED';
    } else if (isTimeout) {
      statusCode = 504;
      errorCategory = 'TIMEOUT';
    } else if (isHighDemandOrUnavailable) {
      statusCode = 503;
      errorCategory = 'SERVICE_UNAVAILABLE';
    } else if (isModelOutputError) {
      statusCode = 500;
      errorCategory = 'MODEL_OUTPUT_INVALID';
    } else if (isApiKeyMissing) {
      statusCode = 500;
      errorCategory = 'AUTH_CONFIG_ERROR';
    }

    // Log informasi diagnostik aman tanpa membocorkan kredensial atau payload sensitif
    console.error(`[API Diagnostic - ${requestId}]`, {
      stage: currentStage,
      category: errorCategory,
      statusCode,
      durationMs,
      message: sanitizedLogMessage,
    });

    return sendJsonResponse(res, statusCode, {
      success: false,
      error: sanitizedLogMessage,
      requestId,
      category: errorCategory,
      retryAfterSeconds: errorCategory === 'QUOTA_EXCEEDED' ? 60 : undefined,
    });
  }
}

/**
 * Pembangkitan gambar AI tunggal menggunakan model Gemini Image (gemini-3.1-flash-lite-image atau gemini-nano-banana-2.1)
 * Menangani kuota / penagihan secara terisolasi tanpa merusak naskah teks atau membuat gambar palsu.
 */
export async function generateQuestionImageAi(
  prompt: string,
  apiKey: string
): Promise<{ success: boolean; imageUrl?: string; status: 'success' | 'quota_exceeded' | 'unavailable' | 'error'; message: string }> {
  if (!apiKey || apiKey.trim().length === 0) {
    return {
      success: false,
      status: 'unavailable',
      message: 'GEMINI_API_KEY belum dikonfigurasi.',
    };
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  // 1. Coba generateImages dengan model resmi Imagen 3 (imagen-3.0-generate-002)
  try {
    const imgResponse = await ai.models.generateImages({
      model: 'imagen-3.0-generate-002',
      prompt: `Ilustrasi edukatif anak sekolah dasar / Madrasah Ibtidaiyah yang bersih, jelas, ramah anak: ${prompt}`,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: '4:3',
      },
    });

    const base64Data = imgResponse.generatedImages?.[0]?.image?.imageBytes;
    if (base64Data) {
      return {
        success: true,
        imageUrl: `data:image/jpeg;base64,${base64Data}`,
        status: 'success',
        message: 'Gambar berhasil dibuat oleh Google AI.',
      };
    }
  } catch (err: any) {
    const msg = String(err?.message || err);
    const upperMsg = msg.toUpperCase();

    const isQuotaOrPaidRequired =
      upperMsg.includes('429') ||
      upperMsg.includes('RESOURCE_EXHAUSTED') ||
      upperMsg.includes('LIMIT: 0') ||
      upperMsg.includes('BILLING') ||
      upperMsg.includes('QUOTA') ||
      upperMsg.includes('PERMISSION_DENIED') ||
      upperMsg.includes('NOT ENABLED');

    if (isQuotaOrPaidRequired) {
      return {
        success: false,
        status: 'quota_exceeded',
        message:
          'Layanan Image Generation Google AI memerlukan API Key dengan penagihan aktif (Pay-as-you-go). Silakan unggah gambar manual guru melalui Editor Soal atau aktifkan billing.',
      };
    }
  }

  // 2. Fallback jika model multimodal generateContent tersedia
  const imageModels = ['gemini-2.5-flash-image', 'gemini-3.1-flash-lite-image'];
  let lastErr = '';

  for (const model of imageModels) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: `Buatlah gambar ilustrasi edukatif anak sekolah dasar / Madrasah Ibtidaiyah yang bersih, jelas, tanpa teks berbelit yang terdistorsi: ${prompt}`,
      });

      const parts = response.candidates?.[0]?.content?.parts;
      if (parts && Array.isArray(parts)) {
        for (const part of parts) {
          if (part.inlineData?.data) {
            const mime = part.inlineData.mimeType || 'image/jpeg';
            const imageUrl = `data:${mime};base64,${part.inlineData.data}`;
            return {
              success: true,
              imageUrl,
              status: 'success',
              message: 'Gambar berhasil dibuat oleh Google AI.',
            };
          }
        }
      }
    } catch (err: any) {
      const msg = String(err?.message || err);
      lastErr = msg;

      const isQuotaOrPaidRequired =
        msg.includes('429') ||
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('limit: 0') ||
        msg.includes('billing') ||
        msg.includes('quota');

      if (isQuotaOrPaidRequired) {
        return {
          success: false,
          status: 'quota_exceeded',
          message:
            'Layanan Image Generation Google AI memerlukan API Key dengan penagihan aktif (Pay-as-you-go). Silakan unggah gambar manual guru melalui Editor Soal atau aktifkan billing.',
        };
      }
    }
  }

  return {
    success: false,
    status: 'unavailable',
    message: sanitizeErrorMessage(
      lastErr
        ? `Layanan gambar AI saat ini belum tersedia: ${lastErr}`
        : 'Model gambar AI memerlukan API Key dengan penagihan aktif (Pay-as-you-go). Silakan unggah gambar manual guru melalui Editor Soal.'
    ),
  };
}

/**
 * HTTP Handler untuk endpoint /api/generate-question-image
 * Digunakan oleh Editor Soal untuk regenerate atau membuat gambar AI per butir soal
 */
export async function handleGenerateQuestionImageApi(req: any, res: any) {
  if (req.method !== 'POST') {
    return sendJsonResponse(res, 405, {
      success: false,
      error: 'Metode HTTP tidak diizinkan. Gunakan POST.',
    });
  }

  try {
    const body = await parseRequestBody(req);
    const prompt = String(body?.prompt || '').trim();

    if (!prompt) {
      return sendJsonResponse(res, 400, {
        success: false,
        error: 'Deskripsi prompt gambar wajib diisi.',
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return sendJsonResponse(res, 500, {
        success: false,
        error: 'GEMINI_API_KEY belum dikonfigurasi pada server.',
      });
    }

    const result = await generateQuestionImageAi(prompt, apiKey);

    if (result.success && result.imageUrl) {
      return sendJsonResponse(res, 200, {
        success: true,
        imageUrl: result.imageUrl,
        message: result.message,
      });
    } else {
      return sendJsonResponse(res, result.status === 'quota_exceeded' ? 429 : 503, {
        success: false,
        status: result.status,
        error: result.message,
      });
    }
  } catch (err: any) {
    return sendJsonResponse(res, 500, {
      success: false,
      error: sanitizeErrorMessage(err || 'Gagal menghasilkan gambar AI.'),
    });
  }
}

/**
 * Handler diagnostik dan status koneksi API AI untuk Dashboard.
 * Memberikan transparansi apakah GEMINI_API_KEY terpasang dan layanan AI siap,
 * tanpa membocorkan isi API key atau kredensial rahasia.
 */
export async function handleStatusApi(req: any, res: any) {
  const method = req?.method || 'GET';

  // Tangani CORS preflight jika dipanggil lintas asal
  if (method === 'OPTIONS') {
    if (typeof res?.setHeader === 'function') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
    }
    return sendJsonResponse(res, 204, {});
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const configuredModel = normalizeGeminiModelName(process.env.GEMINI_MODEL);
  const isKeyConfigured = Boolean(apiKey && apiKey.trim().length > 0);

  if (!isKeyConfigured) {
    return sendJsonResponse(res, 200, {
      success: true,
      status: 'api_key_missing',
      connected: false,
      model: configuredModel,
      message: 'GEMINI_API_KEY belum dikonfigurasi pada environment server.',
      tips: 'Silakan pasang GEMINI_API_KEY di dashboard hosting Vercel atau file .env Anda. Pembuatan soal manual tetap berfungsi.',
      timestamp: new Date().toISOString(),
    });
  }

  // Jika diminta verifikasi koneksi live aktif
  const urlObj = req?.url ? new URL(req.url, 'http://localhost') : null;
  const checkLive =
    urlObj?.searchParams?.get('checkLive') === 'true' ||
    req?.query?.checkLive === 'true' ||
    req?.body?.checkLive === true;

  if (checkLive) {
    const startTime = Date.now();
    try {
      const ai = new GoogleGenAI({
        apiKey: apiKey!,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });

      // Panggilan minimal untuk memvalidasi kredensial tanpa membebani kuota
      await ai.models.generateContent({
        model: configuredModel,
        contents: 'test',
        config: { maxOutputTokens: 1 },
      });

      const latencyMs = Date.now() - startTime;
      return sendJsonResponse(res, 200, {
        success: true,
        status: 'ready',
        connected: true,
        liveVerified: true,
        latencyMs,
        model: configuredModel,
        message: 'Layanan Gemini AI aktif dan berhasil terverifikasi.',
        timestamp: new Date().toISOString(),
      });
    } catch (pingErr: any) {
      const latencyMs = Date.now() - startTime;
      const parsed = parseErrorDetails(pingErr);
      const isAuth = parsed.category === 'AUTH';
      const isQuota = parsed.category === 'QUOTA';

      return sendJsonResponse(res, 200, {
        success: true,
        status: isAuth ? 'api_key_invalid' : isQuota ? 'quota_exceeded' : 'service_issue',
        connected: false,
        liveVerified: false,
        latencyMs,
        model: configuredModel,
        message: isAuth
          ? 'Kunci API Gemini tidak valid atau tidak memiliki akses.'
          : isQuota
          ? 'Batas kuota Gemini API saat ini telah tercapai.'
          : 'Layanan Gemini AI sedang mengalami gangguan sementara.',
        timestamp: new Date().toISOString(),
      });
    }
  }

  return sendJsonResponse(res, 200, {
    success: true,
    status: 'ready',
    connected: true,
    liveVerified: false,
    model: configuredModel,
    message: 'Konfigurasi Gemini AI terpasang dan siap menerima permintaan.',
    timestamp: new Date().toISOString(),
  });
}

