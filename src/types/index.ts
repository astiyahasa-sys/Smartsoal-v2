/**
 * Model Data dan Tipe TypeScript untuk MADRASAH SMART SOAL
 * Versi 1.0 — Fondasi Aplikasi
 */

export type Semester = 'Ganjil' | 'Genap';

export type Grade = 1 | 2 | 3 | 4 | 5 | 6;

export type Phase = 'Fase A' | 'Fase B' | 'Fase C';

export type AssessmentType =
  | 'Asesmen Harian'
  | 'Asesmen Sumatif Tengah Semester (ASTS)'
  | 'Asesmen Sumatif Akhir Semester (ASAS)'
  | 'Asesmen Sumatif Akhir Tahun (ASAT)'
  | 'Asesmen Madrasah (AM)'
  | 'Asesmen Sumatif Lingkup Materi'
  | 'Formatif'
  | 'Sumatif Lingkup Materi'
  | 'Sumatif Akhir Semester (SAS)'
  | 'Penilaian Harian'
  | 'Penilaian Tengah Semester'
  | 'Lainnya';

export type DifficultyLevel = 'Mudah' | 'Sedang' | 'Sulit' | 'Campuran';

export type PackageStatus = 'draft' | 'completed';

export type QuestionType = 'multiple_choice' | 'complex_multiple_choice' | 'short_answer' | 'essay';

export type CognitiveLevel =
  | 'L1 (Mengingat/Memahami)'
  | 'L2 (Menerapkan)'
  | 'L3 (Penalaran/HOTS)';

export interface AnswerOption {
  key: string; // 'A' | 'B' | 'C' | 'D'
  text: string;
}

export interface RubricItem {
  criteria: string;
  score: number;
}

export type MultipleChoiceOptionCount = 3 | 4;

export type ImageMode = 'none' | 'manual' | 'ai' | 'both';

export type ImagePosition = 'above_question' | 'below_question';

export interface QuestionImageAiStatus {
  status: 'success' | 'quota_exceeded' | 'unavailable' | 'error';
  message?: string;
}

export interface TopicItem {
  id: string;
  topic: string; // Materi Pokok / Bab
  learningObjectives?: string; // Tujuan Pembelajaran (TP) / Indikator Asesmen spesifik untuk bab ini
}

export interface QuestionItem {
  id: string;
  number: number;
  type: QuestionType;
  questionText: string;
  options?: AnswerOption[];
  answerKey?: string;
  acceptedAnswers?: string[];
  explanation?: string;
  score?: number;
  indicator?: string;
  cognitiveLevel?: CognitiveLevel;
  topic?: string; // Materi Pokok butir soal jika paket memiliki multi-bab
  topicId?: string; // ID bab acuan
  rubric?: RubricItem[];
  imageUrl?: string; // Data URL Base64 atau URL gambar valid
  imageAlt?: string; // Teks alternatif atau deskripsi prompt gambar
  imageCaption?: string; // Keterangan gambar (misal: "Gambar 1. Siklus Air")
  imagePosition?: ImagePosition; // 'above_question' (di atas soal) | 'below_question' (di bawah soal / antara kalimat dan pilihan jawaban)
  imageAiStatus?: QuestionImageAiStatus;
}

export interface QuestionPackage {
  id: string;
  title: string;
  schoolName: string;
  teacherName: string;
  academicYear: string;
  semester: Semester;
  assessmentType: string;
  subject: string;
  grade: Grade;
  phase: Phase;
  topic: string;
  learningObjectives: string;
  topics?: TopicItem[]; // Daftar materi pokok / bab dan TP terpisah jika lebih dari 1
  durationMinutes: number;
  multipleChoiceCount: number;
  complexMultipleChoiceCount?: number; // PG Kompleks (2 atau 3 kunci jawaban benar)
  shortAnswerCount: number;
  essayCount: number;
  difficulty: DifficultyLevel;
  language: string;
  sourceMaterial: string;
  additionalNotes: string;
  imageMode?: ImageMode; // 'none' (default) | 'manual' | 'ai' | 'both'
  defaultImagePosition?: ImagePosition; // 'above_question' | 'below_question'
  mcOptionCount?: MultipleChoiceOptionCount; // 3 (A, B, C) atau 4 (A, B, C, D)
  status: PackageStatus;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  questions?: QuestionItem[];
}

export interface SchoolProfile {
  schoolName: string;
  npsnOrNsm: string;
  address: string;
  village: string;
  subdistrict: string;
  city: string;
  province: string;
  principalName: string;
  principalNip?: string;
  teacherName: string;
  teacherNip?: string;
  logoUrl?: string; // Data URL Base64
  updatedAt: string;
}

export interface AppSettings {
  defaultAcademicYear: string;
  defaultDurationMinutes: number;
  defaultDifficulty: DifficultyLevel;
  autoFillSchoolProfile: boolean;
  confirmBeforeDelete: boolean;
}

export type ActiveView =
  | 'dashboard'
  | 'create-package'
  | 'edit-package'
  | 'review-questions'
  | 'preview-package'
  | 'bank-soal'
  | 'kisi-kisi'
  | 'kunci-jawaban'
  | 'identitas-madrasah'
  | 'pengaturan'
  | 'panduan';

export interface GenerateQuestionsRequest {
  packageId?: string;
  schoolName?: string;
  teacherName?: string;
  academicYear?: string;
  semester?: Semester;
  assessmentType: string;
  subject: string;
  grade: Grade;
  phase?: Phase;
  topic: string;
  learningObjectives?: string;
  topics?: TopicItem[];
  durationMinutes?: number;
  multipleChoiceCount: number;
  complexMultipleChoiceCount?: number;
  shortAnswerCount: number;
  essayCount: number;
  difficulty?: DifficultyLevel;
  language?: string;
  sourceMaterial?: string;
  additionalNotes?: string;
  imageMode?: ImageMode;
  mcOptionCount?: MultipleChoiceOptionCount;
}

export interface GenerateQuestionsResponse {
  success: boolean;
  packageTitle?: string;
  questions?: QuestionItem[];
  error?: string;
}

export interface StorageResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

export type AiHealthStatus =
  | 'loading'
  | 'ready'
  | 'api_key_missing'
  | 'api_key_invalid'
  | 'quota_exceeded'
  | 'service_issue';

export interface AiStatusResponse {
  success: boolean;
  status: AiHealthStatus;
  connected: boolean;
  liveVerified?: boolean;
  model: string;
  message: string;
  tips?: string;
  timestamp: string;
  latencyMs?: number;
}
