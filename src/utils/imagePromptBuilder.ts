/**
 * Image Prompt Builder & Generator Utility
 * MADRASAH SMART SOAL
 *
 * Membangun prompt AI teks-ke-gambar terstruktur dan berkualitas tinggi
 * yang disesuaikan dengan stimulus soal Kurikulum Merdeka Madrasah Ibtidaiyah.
 * Guru dan penyusun soal dapat menyalin prompt ini ke platform AI gratis
 * (Gemini, Bing Image Creator, Canva, ChatGPT/DALL-E) lalu mengunggah hasilnya secara manual.
 */

import { QuestionItem, QuestionPackage } from '../types';

export interface ImagePromptResult {
  questionId: string;
  questionNumber: number;
  questionType: string;
  hasExistingImage: boolean;
  needsImage: boolean;
  subjectTitle: string;
  coreStimulus: string;
  indonesianPrompt: string;
  englishPrompt: string;
  suggestedAspect: '1:1' | '4:3' | '16:9';
  visualStyle: string;
  quickKeywords: string[];
}

export interface AiGeneratorPlatform {
  name: string;
  url: string;
  badge: string;
  description: string;
  freeTier: boolean;
}

export const AI_IMAGE_PLATFORMS: AiGeneratorPlatform[] = [
  {
    name: 'Google Gemini',
    url: 'https://gemini.google.com/app',
    badge: 'Gratis & Cepat',
    description: 'Langsung paste prompt bahasa Indonesia/Inggris untuk membuat gambar edukatif gratis.',
    freeTier: true,
  },
  {
    name: 'Bing Image Creator (Designer)',
    url: 'https://www.bing.com/images/create',
    badge: 'DALL-E 3 Gratis',
    description: 'Ditenagai OpenAI DALL-E 3 dengan akun Microsoft gratis.',
    freeTier: true,
  },
  {
    name: 'Canva Magic Media',
    url: 'https://www.canva.com',
    badge: 'Mudah Diedit',
    description: 'Buat gambar langsung di kanvas lembar kerja atau media ajar Anda.',
    freeTier: true,
  },
  {
    name: 'ChatGPT (OpenAI)',
    url: 'https://chatgpt.com',
    badge: 'Kualitas Tinggi',
    description: 'Buat gambar diagram dan ilustrasi edukatif interaktif.',
    freeTier: true,
  },
  {
    name: 'Ideogram AI',
    url: 'https://ideogram.ai',
    badge: 'Grafis & Tipografi',
    description: 'Sangat rapi dalam merender gambar vektor dan ikon edukasi.',
    freeTier: true,
  },
];

/**
 * Membersihkan kalimat soal dari frasa instruksi peramban/pembuka
 * agar fokus mengekstrak objek visual stimulus yang hendak digambar
 */
export function extractVisualSubjectFromText(text: string): string {
  if (!text || typeof text !== 'string') return 'Ilustrasi materi pembelajaran edukatif';

  let cleaned = text.trim();

  // Bersihkan instruksi pembuka soal
  cleaned = cleaned
    .replace(/^perhatikan\s+gambar\s+(di\s+bawah|di\s+samping|berikut)\s*(ini)?\s*[:!.,]?\s*/gi, '')
    .replace(/^berdasarkan\s+gambar\s+(di\s+bawah|di\s+samping|berikut)\s*(ini)?\s*[:!.,]?\s*/gi, '')
    .replace(/^amati\s+gambar\s+(di\s+bawah|di\s+samping|berikut)\s*(ini)?\s*[:!.,]?\s*/gi, '')
    .replace(/^pada\s+gambar\s+(di\s+bawah|di\s+samping|berikut)\s*(ini)?\s*[:!.,]?\s*/gi, '')
    .trim();

  // Bersihkan kata tanya pembuka
  cleaned = cleaned
    .replace(/^(manakah|apakah|bagaimanakah|mengapa|siapakah|berapakah)\s+(yang\s+merupakan\s+|dari\s+)?/gi, '')
    .replace(/\?+$/g, '')
    .trim();

  // Jika setelah dibersihkan terlalu pendek atau kosong, kembalikan teks asli yang diringkas
  if (cleaned.length < 5) {
    cleaned = text.replace(/\?+$/g, '').trim();
  }

  // Batasi panjang wajar untuk objek visual
  if (cleaned.length > 200) {
    cleaned = cleaned.slice(0, 197) + '...';
  }

  return cleaned;
}

/**
 * Menerjemahkan istilah umum materi madrasah ke bahasa Inggris sederhana untuk prompt Midjourney/DALL-E
 */
export function translateKeywordsToEnglish(text: string, subject?: string): string {
  const dictionary: Record<string, string> = {
    'shalat': 'Muslim prayer (Salah/Salat)',
    'sholat': 'Muslim prayer (Salah/Salat)',
    'wudhu': 'Islamic ablution (Wudu) steps',
    'masjid': 'clean Islamic mosque architecture',
    'zakat': 'Islamic charity and donation',
    'puasa': 'Ramadan fasting and iftar meal',
    'haji': 'Hajj pilgrimage and Kaaba in Mecca',
    'al-qur\'an': 'Holy Quran on a wooden stand (rehal)',
    'alquran': 'Holy Quran on a wooden stand (rehal)',
    'hijaiyah': 'Arabic alphabet letters for children',
    'bahasa arab': 'Arabic learning objects for elementary students',
    'rantai makanan': 'diagram of a terrestrial ecosystem food chain with plants, herbivores, and predators',
    'ekosistem': 'nature ecosystem with animals and plants',
    'tata surya': 'solar system with the sun and orbiting planets',
    'fotosintesis': 'plant photosynthesis diagram with sunlight, leaves, water and oxygen',
    'siklus air': 'water cycle diagram with evaporation, clouds, rain and river',
    'bagian tumbuhan': 'botany diagram of a flower and plant parts (roots, stem, leaf, blossom)',
    'pancasila': 'Garuda Pancasila national emblem of Indonesia',
    'gotong royong': 'Indonesian elementary students cooperating and cleaning the classroom happily',
    'jam': 'analog clock face showing clock hands clearly',
    'sudut': 'geometric angle diagram (acute, right, obtuse)',
    'bangun datar': '2D geometric shapes (circle, square, triangle, rectangle) in bright colors',
    'bangun ruang': '3D geometric shapes (cube, cylinder, cone, sphere)',
    'pecahan': 'fraction visual representation using pie chart and pizza slices',
    'penjumlahan': 'math addition illustration with colorful counting apples or counters',
    'pengurangan': 'math subtraction illustration with counting objects',
    'peta': 'simplified educational map of Indonesian archipelago',
    'lingkungan': 'clean and green school environment with trees and trash bins',
  };

  const lower = text.toLowerCase();
  for (const [key, value] of Object.entries(dictionary)) {
    if (lower.includes(key)) {
      return value;
    }
  }

  // Fallback berdasarkan mata pelajaran jika spesifik
  if (subject) {
    const sLower = subject.toLowerCase();
    if (sLower.includes('fikih') || sLower.includes('fiqih')) {
      return 'Islamic religious education illustration for elementary students';
    }
    if (sLower.includes('qur\'an') || sLower.includes('hadis')) {
      return 'Islamic Quranic study education illustration for children';
    }
    if (sLower.includes('ski') || sLower.includes('sejarah kebudayaan')) {
      return 'Islamic history and cultural heritage illustration for young students';
    }
    if (sLower.includes('arab')) {
      return 'Arabic vocabulary illustrated flashcard for primary school kids';
    }
    if (sLower.includes('matematika')) {
      return 'elementary math educational diagram with numbers and visual objects';
    }
    if (sLower.includes('ipas') || sLower.includes('ipa')) {
      return 'elementary science nature and biology educational diagram';
    }
    if (sLower.includes('pancasila')) {
      return 'Indonesian civic education classroom illustration for primary school';
    }
  }

  return `educational textbook illustration depicting: ${text}`;
}

/**
 * Membangun paket prompt AI gambar lengkap untuk satu butir soal
 */
export function buildManualImagePrompt(
  question: QuestionItem,
  packageContext?: {
    subject?: string;
    grade?: string | number;
    phase?: string;
    topic?: string;
  }
): ImagePromptResult {
  const subject = packageContext?.subject || 'Pelajaran Madrasah Ibtidaiyah';
  const gradeVal = packageContext?.grade;
  const grade = gradeVal !== undefined ? (typeof gradeVal === 'number' ? `Kelas ${gradeVal}` : String(gradeVal)) : 'SD/MI';
  const phase = packageContext?.phase || 'Fase Pembelajaran';

  // Tentukan stimulus inti: gunakan imageAlt jika sudah ada, atau ekstrak dari questionText
  const hasCustomAlt = Boolean(question.imageAlt && question.imageAlt.trim().length > 3);
  const coreStimulus = hasCustomAlt
    ? question.imageAlt!.trim()
    : extractVisualSubjectFromText(question.questionText);

  // Buat prompt Bahasa Indonesia yang siap pakai
  const indonesianPrompt = [
    `Ilustrasi edukatif buku pelajaran ${subject} untuk siswa Madrasah Ibtidaiyah (${grade}, ${phase}).`,
    `Objek stimulus visual: ${coreStimulus}.`,
    `Gaya visual: 2D vektor bersih dan modern (flat vector educational style), garis tepi tegas (crisp outlines), warna cerah, kontras tinggi, dan ramah anak.`,
    `Ketentuan penting: Latar belakang putih bersih polos (isolated on white background), TANPA teks acak, TANPA huruf atau angka tidak bermakna, TANPA watermark, fokus jelas pada objek pembelajaran agar mudah dijadikan stimulus naskah soal asesmen siswa.`,
  ].join(' ');

  // Buat prompt Bahasa Inggris yang optimal untuk Midjourney / Ideogram / DALL-E 3
  const coreEnglish = translateKeywordsToEnglish(coreStimulus, subject);
  const englishPrompt = [
    `Educational 2D vector textbook illustration for elementary school children (${subject}, grade ${grade}).`,
    `Subject scene: ${coreEnglish}.`,
    `Visual style: Clean vector art, vibrant kid-friendly color palette, bold outlines, simple and clear composition.`,
    `Guidelines: Isolated on pure white background, absolutely NO random text, NO gibberish letters, NO watermarks, high contrast, perfect for primary school test exam stimulus.`,
  ].join(' ');

  // Tentukan rasio aspek yang disarankan
  let suggestedAspect: '1:1' | '4:3' | '16:9' = '4:3';
  if (coreStimulus.toLowerCase().includes('rantai makanan') || coreStimulus.toLowerCase().includes('siklus') || coreStimulus.toLowerCase().includes('tata surya')) {
    suggestedAspect = '16:9';
  } else if (coreStimulus.toLowerCase().includes('jam') || coreStimulus.toLowerCase().includes('bangun datar') || coreStimulus.toLowerCase().includes('lambang')) {
    suggestedAspect = '1:1';
  }

  // Keywords cepat
  const quickKeywords = [
    '2D Vektor Edukatif',
    'Latar Putih Polos',
    'Tanpa Teks / No Text',
    'Ramah Anak Madrasah',
    'Warna Cerah Kontras',
  ];

  return {
    questionId: question.id,
    questionNumber: question.number,
    questionType: question.type,
    hasExistingImage: Boolean(question.imageUrl),
    needsImage: !question.imageUrl && (Boolean(question.imageAlt) || question.imageAiStatus?.status === 'unavailable' || question.imageAiStatus?.status === 'quota_exceeded'),
    subjectTitle: subject,
    coreStimulus,
    indonesianPrompt,
    englishPrompt,
    suggestedAspect,
    visualStyle: 'Ilustrasi Vektor Edukatif 2D Ramah Anak',
    quickKeywords,
  };
}

/**
 * Mengumpulkan seluruh prompt gambar untuk semua butir soal dalam satu paket
 */
export function buildAllPackageImagePrompts(
  pkg: QuestionPackage
): ImagePromptResult[] {
  if (!pkg || !Array.isArray(pkg.questions)) return [];

  return pkg.questions.map((q) =>
    buildManualImagePrompt(q, {
      subject: pkg.subject,
      grade: pkg.grade,
      phase: pkg.phase,
      topic: q.topic || pkg.topic,
    })
  );
}
