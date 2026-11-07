import test from 'node:test';
import assert from 'node:assert/strict';
import {
  exportToWordDocument,
  exportToExcelWorkbook,
  exportToPdfDocument,
  exportToCsvFile,
  exportKisiKisiToWordDocument,
  exportKisiKisiToPdfDocument,
  exportKunciJawabanToWordDocument,
  exportKunciJawabanToPdfDocument,
  exportKunciJawabanToExcelWorkbook,
  createMadrasahKopElements,
  createSignatureBlock,
} from './exportService.ts';
import { QuestionPackage, SchoolProfile } from '../types';

const samplePackage: QuestionPackage = {
  id: 'pkg_test_export',
  title: 'Asesmen Sumatif Akhir Semester Akidah Akhlak Kelas 4',
  schoolName: 'Madrasah Ibtidaiyah Negeri 1',
  teacherName: 'Ust. Nurul Huda, S.Pd.I',
  academicYear: '2024/2025',
  semester: 'Ganjil',
  assessmentType: 'SAS (Sumatif Akhir Semester)',
  subject: 'Akidah Akhlak',
  grade: 4,
  phase: 'Fase B',
  topic: 'Asmaul Husna Al-Malik, Al-Quddus, dan As-Salam',
  learningObjectives: 'Memahami arti dan hikmah Asmaul Husna',
  durationMinutes: 90,
  multipleChoiceCount: 1,
  shortAnswerCount: 1,
  essayCount: 1,
  difficulty: 'Sedang',
  language: 'Bahasa Indonesia',
  sourceMaterial: '',
  additionalNotes: '',
  status: 'completed',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  questions: [
    {
      id: 'q_1',
      number: 1,
      type: 'multiple_choice',
      questionText: 'Asmaul Husna Al-Quddus memiliki arti bahwa Allah Maha...',
      options: [
        { key: 'A', text: 'Maha Suci' },
        { key: 'B', text: 'Maha Merajai' },
        { key: 'C', text: 'Maha Pengasih' },
        { key: 'D', text: 'Maha Mengetahui' },
      ],
      answerKey: 'A',
      explanation: 'Al-Quddus artinya Maha Suci dari segala aib dan kekurangan.',
      score: 1,
      indicator: 'Siswa dapat menentukan arti Asmaul Husna Al-Quddus',
      cognitiveLevel: 'L1 (Mengingat/Memahami)',
    },
    {
      id: 'q_2',
      number: 2,
      type: 'short_answer',
      questionText: 'Arti dari nama Allah As-Salam adalah Yang Maha Memberi...',
      answerKey: 'Keselamatan',
      acceptedAnswers: ['Keselamatan', 'kesejahteraan'],
      explanation: 'As-Salam berarti Allah adalah sumber ketentraman dan pemberi keselamatan.',
      score: 2,
      indicator: 'Siswa dapat menyebutkan makna As-Salam',
      cognitiveLevel: 'L1 (Mengingat/Memahami)',
    },
    {
      id: 'q_3',
      number: 3,
      type: 'essay',
      questionText: 'Jelaskan bagaimana cara meneladani sifat Allah Al-Malik dalam kehidupan di madrasah!',
      answerKey: 'Menjadi pemimpin diri sendiri yang disiplin, tidak sombong, dan menjaga ketertiban.',
      explanation: 'Al-Malik mengajarkan kepemimpinan dan amanah.',
      score: 4,
      indicator: 'Siswa dapat menerapkan hikmah Asmaul Husna Al-Malik',
      cognitiveLevel: 'L3 (Penalaran/HOTS)',
      rubric: [
        { criteria: 'Menyebutkan 2 contoh penerapan konkret dengan tepat', score: 4 },
        { criteria: 'Menyebutkan 1 contoh dengan tepat', score: 2 },
      ],
    },
  ],
};

const sampleProfile: SchoolProfile = {
  schoolName: 'MIN 1 Kota',
  npsnOrNsm: '111234567890',
  address: 'Jl. Pemuda No. 10',
  village: 'Pusat',
  subdistrict: 'Kecamatan',
  city: 'Kota',
  province: 'Provinsi',
  principalName: 'H. Ahmad Muzakki, M.Pd',
  teacherName: 'Ust. Nurul Huda, S.Pd.I',
  updatedAt: new Date().toISOString(),
};

test('exportToWordDocument generates valid .docx Blob for teacher mode', async () => {
  const blob = await exportToWordDocument(samplePackage, sampleProfile, { includeAnswers: true });
  assert.ok(blob);
  assert.ok(blob.size > 2000, `Ukuran blob DOCX (${blob.size}) harus lebih dari 2000 byte`);
  assert.equal(blob.type, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
});

test('exportToWordDocument generates valid .docx Blob for student mode', async () => {
  const blob = await exportToWordDocument(samplePackage, sampleProfile, { includeAnswers: false });
  assert.ok(blob);
  assert.ok(blob.size > 2000, `Ukuran blob DOCX (${blob.size}) harus lebih dari 2000 byte`);
  assert.equal(blob.type, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
});

test('exportToExcelWorkbook generates valid .xlsx Blob for teacher mode', async () => {
  const blob = await exportToExcelWorkbook(samplePackage, sampleProfile, { includeAnswers: true });
  assert.ok(blob);
  assert.ok(blob.size > 1000, `Ukuran blob XLSX (${blob.size}) harus lebih dari 1000 byte`);
  assert.equal(blob.type, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
});

test('exportToExcelWorkbook generates valid .xlsx Blob for student mode', async () => {
  const blob = await exportToExcelWorkbook(samplePackage, sampleProfile, { includeAnswers: false });
  assert.ok(blob);
  assert.ok(blob.size > 1000, `Ukuran blob XLSX (${blob.size}) harus lebih dari 1000 byte`);
  assert.equal(blob.type, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
});

test('exportToWordDocument handles questions with images seamlessly', async () => {
  const packageWithImage: QuestionPackage = {
    ...samplePackage,
    id: 'pkg_with_image',
    imageMode: 'manual',
    questions: [
      {
        ...samplePackage.questions![0],
        imageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        imageAlt: 'Ilustrasi Simbol',
        imageCaption: 'Gambar 1. Contoh Simbol Grafis',
      },
    ],
  };

  const wordBlob = await exportToWordDocument(packageWithImage, sampleProfile, { includeAnswers: true });
  assert.ok(wordBlob);
  assert.ok(wordBlob.size > 2000);

  const excelBlob = exportToExcelWorkbook(packageWithImage, sampleProfile, { includeAnswers: true });
  assert.ok(excelBlob);
  assert.ok(excelBlob.size > 1000);

  const pdfBlob = await exportToPdfDocument(packageWithImage, sampleProfile, { includeAnswers: true });
  assert.ok(pdfBlob);
  assert.ok(pdfBlob.size > 2000, `Ukuran blob PDF (${pdfBlob.size}) harus lebih dari 2000 byte`);
  assert.equal(pdfBlob.type, 'application/pdf');
});

test('exportToPdfDocument generates valid .pdf Blob for teacher mode', async () => {
  const blob = await exportToPdfDocument(samplePackage, sampleProfile, { includeAnswers: true });
  assert.ok(blob);
  assert.ok(blob.size > 2000, `Ukuran blob PDF Guru (${blob.size}) harus lebih dari 2000 byte`);
  assert.equal(blob.type, 'application/pdf');
});

test('exportToPdfDocument generates valid .pdf Blob for student mode', async () => {
  const blob = await exportToPdfDocument(samplePackage, sampleProfile, { includeAnswers: false });
  assert.ok(blob);
  assert.ok(blob.size > 2000, `Ukuran blob PDF Siswa (${blob.size}) harus lebih dari 2000 byte`);
  assert.equal(blob.type, 'application/pdf');
});

test('exportToPdfDocument supports complex multiple choice questions correctly', async () => {
  const pkgWithCmc: QuestionPackage = {
    ...samplePackage,
    id: 'pkg_cmc_pdf',
    complexMultipleChoiceCount: 1,
    questions: [
      {
        id: 'q_cmc_1',
        number: 1,
        type: 'complex_multiple_choice',
        questionText: 'Pilihlah 2 nama surah yang termasuk juz 30 dalam Al-Qur\'an!',
        options: [
          { key: 'A', text: 'Surah An-Naba' },
          { key: 'B', text: 'Surah Al-Baqarah' },
          { key: 'C', text: 'Surah An-Nas' },
          { key: 'D', text: 'Surah Ali \'Imran' },
        ],
        answerKey: 'A, C',
        explanation: 'Surah An-Naba dan An-Nas terletak di Juz 30.',
        score: 2,
        indicator: 'Siswa dapat menentukan surah Juz 30',
        cognitiveLevel: 'L2 (Menerapkan)',
      },
    ],
  };

  const studentPdf = await exportToPdfDocument(pkgWithCmc, sampleProfile, { includeAnswers: false });
  assert.ok(studentPdf);
  assert.ok(studentPdf.size > 2000);
  assert.equal(studentPdf.type, 'application/pdf');

  const teacherPdf = await exportToPdfDocument(pkgWithCmc, sampleProfile, { includeAnswers: true });
  assert.ok(teacherPdf);
  assert.ok(teacherPdf.size > 2000);
  assert.equal(teacherPdf.type, 'application/pdf');
});

test('exportToWordDocument and exportToPdfDocument support above_question and below_question positioning', async () => {
  const pkgWithPositions: QuestionPackage = {
    ...samplePackage,
    id: 'pkg_pos_test',
    defaultImagePosition: 'below_question',
    questions: [
      {
        ...samplePackage.questions![0],
        id: 'q_pos_above',
        number: 1,
        imagePosition: 'above_question',
        imageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        imageCaption: 'Stimulus Di Atas Kalimat Soal',
      },
      {
        ...samplePackage.questions![1],
        id: 'q_pos_below',
        number: 2,
        imagePosition: 'below_question',
        imageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        imageCaption: 'Stimulus Di Bawah Kalimat Soal',
      },
    ],
  };

  const wordBlob = await exportToWordDocument(pkgWithPositions, sampleProfile, { includeAnswers: true });
  assert.ok(wordBlob);
  assert.ok(wordBlob.size > 2000);
  assert.equal(wordBlob.type, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

  const pdfBlob = await exportToPdfDocument(pkgWithPositions, sampleProfile, { includeAnswers: true });
  assert.ok(pdfBlob);
  assert.ok(pdfBlob.size > 2000);
  assert.equal(pdfBlob.type, 'application/pdf');
});

test('exportToCsvFile generates valid CSV Blob with UTF-8 BOM and correct fields for teacher mode', async () => {
  const csvBlob = exportToCsvFile(samplePackage, sampleProfile, { includeAnswers: true });
  assert.ok(csvBlob);
  assert.equal(csvBlob.type, 'text/csv;charset=utf-8;');
  assert.ok(csvBlob.size > 100);

  // Validasi UTF-8 BOM 3-byte signature (0xEF, 0xBB, 0xBF)
  const buffer = await csvBlob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  assert.equal(bytes[0], 0xef, 'Byte 0 harus 0xEF');
  assert.equal(bytes[1], 0xbb, 'Byte 1 harus 0xBB');
  assert.equal(bytes[2], 0xbf, 'Byte 2 harus 0xBF');

  const text = await csvBlob.text();
  // Validasi Header baris pertama
  assert.ok(text.includes('No Soal'));
  assert.ok(text.includes('Bentuk Soal'));
  assert.ok(text.includes('Teks Pertanyaan'));
  assert.ok(text.includes('Kunci Jawaban'));
  assert.ok(text.includes('Pembahasan Guru'));

  // Validasi Butir soal terdata
  assert.ok(text.includes('Asmaul Husna Al-Quddus'));
  assert.ok(text.includes('Maha Suci'));
  assert.ok(text.includes('As-Salam'));
  assert.ok(text.includes('Al-Malik'));
});

test('exportToCsvFile generates student mode CSV hiding answer keys and explanations', async () => {
  const csvBlob = exportToCsvFile(samplePackage, sampleProfile, { includeAnswers: false });
  assert.ok(csvBlob);

  const buffer = await csvBlob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  assert.equal(bytes[0], 0xef);
  assert.equal(bytes[1], 0xbb);
  assert.equal(bytes[2], 0xbf);

  const text = await csvBlob.text();
  // Header should not have Kunci Jawaban
  const lines = text.split('\r\n');
  assert.ok(lines.length >= 4);
  assert.ok(!lines[0].includes('Kunci Jawaban'));
  assert.ok(!lines[0].includes('Pembahasan Guru'));

  // Soal tetap muncul
  assert.ok(text.includes('Asmaul Husna Al-Quddus'));
});

test('exports automatically normalize and auto-number questions with holes or reordered items', async () => {
  const packageWithHoles: QuestionPackage = {
    ...samplePackage,
    id: 'pkg_holes',
    questions: [
      { ...samplePackage.questions![0], number: 99 }, // PG originally 99
      { ...samplePackage.questions![1], number: 4 },  // Isian originally 4
      { ...samplePackage.questions![2], number: 12 }, // Essay originally 12
    ],
  };

  // CSV export should auto-number consecutively 1, 2, 3
  const csvBlob = exportToCsvFile(packageWithHoles, sampleProfile, { includeAnswers: true });
  const text = await csvBlob.text();
  assert.ok(text.includes('"1","Pilihan Ganda"'));
  assert.ok(text.includes('"2","Isian Singkat"'));
  assert.ok(text.includes('"3","Uraian"'));
  assert.ok(!text.includes('"99"'));
  assert.ok(!text.includes('"12"'));

  // PDF export should succeed with normalized continuous numbers
  const pdfBlob = await exportToPdfDocument(packageWithHoles, sampleProfile, { includeAnswers: true });
  assert.ok(pdfBlob.size > 2000);

  // Word export should succeed with normalized continuous numbers
  const wordBlob = await exportToWordDocument(packageWithHoles, sampleProfile, { includeAnswers: true });
  assert.ok(wordBlob.size > 2000);
});

test('exportKisiKisiToWordDocument generates valid landscape .docx Blob with signatures', async () => {
  const blob = await exportKisiKisiToWordDocument(samplePackage, sampleProfile);
  assert.ok(blob);
  assert.ok(blob.size > 2000, `Ukuran blob Word Kisi-kisi (${blob.size}) harus lebih dari 2000 byte`);
  assert.equal(blob.type, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
});

test('exportKisiKisiToPdfDocument generates valid landscape .pdf Blob with signatures', async () => {
  const blob = await exportKisiKisiToPdfDocument(samplePackage, sampleProfile);
  assert.ok(blob);
  assert.ok(blob.size > 2000, `Ukuran blob PDF Kisi-kisi (${blob.size}) harus lebih dari 2000 byte`);
  assert.equal(blob.type, 'application/pdf');
});

test('exportKunciJawabanToWordDocument generates valid .docx Blob with and without explanations', async () => {
  // Mode lengkap dengan pembahasan
  const blobWithExp = await exportKunciJawabanToWordDocument(samplePackage, sampleProfile, {
    showExplanations: true,
  });
  assert.ok(blobWithExp);
  assert.ok(blobWithExp.size > 2000, `Ukuran Word Kunci (${blobWithExp.size}) harus > 2000 bytes`);
  assert.equal(blobWithExp.type, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

  // Mode ringkas tanpa pembahasan
  const blobWithoutExp = await exportKunciJawabanToWordDocument(samplePackage, sampleProfile, {
    showExplanations: false,
  });
  assert.ok(blobWithoutExp);
  assert.ok(blobWithoutExp.size > 2000);
});

test('exportKunciJawabanToPdfDocument generates valid .pdf Blob with and without explanations', async () => {
  const blobWithExp = await exportKunciJawabanToPdfDocument(samplePackage, sampleProfile, {
    showExplanations: true,
  });
  assert.ok(blobWithExp);
  assert.ok(blobWithExp.size > 2000, `Ukuran PDF Kunci (${blobWithExp.size}) harus > 2000 bytes`);
  assert.equal(blobWithExp.type, 'application/pdf');

  const blobWithoutExp = await exportKunciJawabanToPdfDocument(samplePackage, sampleProfile, {
    showExplanations: false,
  });
  assert.ok(blobWithoutExp);
  assert.ok(blobWithoutExp.size > 2000);
});

test('exportKunciJawabanToExcelWorkbook generates valid .xlsx Blob with scoring guides and keys', () => {
  const blobWithExp = exportKunciJawabanToExcelWorkbook(samplePackage, sampleProfile, {
    showExplanations: true,
  });
  assert.ok(blobWithExp);
  assert.ok(blobWithExp.size > 1000);
  assert.equal(blobWithExp.type, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

  const blobWithoutExp = exportKunciJawabanToExcelWorkbook(samplePackage, sampleProfile, {
    showExplanations: false,
  });
  assert.ok(blobWithoutExp);
  assert.ok(blobWithoutExp.size > 1000);
});

test('createMadrasahKopElements generates paragraphs and table with logo if provided', () => {
  const profileWithLogo: SchoolProfile = {
    ...sampleProfile,
    logoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    village: 'Desa Sejahtera',
    subdistrict: 'Kecamatan Cerdas',
    province: 'Jawa Timur',
  };

  const elementsWithLogo = createMadrasahKopElements(profileWithLogo);
  assert.ok(elementsWithLogo.length >= 2, 'Harus menghasilkan minimal 2 elemen (tabel kop & garis ganda)');

  const elementsWithoutLogo = createMadrasahKopElements(sampleProfile);
  assert.ok(elementsWithoutLogo.length >= 3, 'Harus menghasilkan teks kop & garis ganda');
});

test('createSignatureBlock generates valid two-column signature table', () => {
  const sigElements = createSignatureBlock(sampleProfile, {
    teacherName: 'Ust. Nurul Huda, S.Pd.I',
    teacherRoleTitle: 'Guru Pengampu Akidah Akhlak',
  });
  assert.ok(sigElements.length >= 2);
});

test('exportToWordDocument generates complete bundle with logo and full answer key', async () => {
  const profileWithLogo: SchoolProfile = {
    ...sampleProfile,
    logoUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  };

  // Full package (Soal Siswa + PageBreak + Kunci Jawaban Lengkap)
  const fullBlob = await exportToWordDocument(samplePackage, profileWithLogo, { includeAnswers: true });
  assert.ok(fullBlob);
  assert.ok(fullBlob.size > 3000, `Ukuran paket lengkap Word (${fullBlob.size}) harus lebih dari 3000 bytes`);
  assert.equal(fullBlob.type, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

  // Fallback ketika profile null
  const fallbackBlob = await exportToWordDocument(samplePackage, null, { includeAnswers: false });
  assert.ok(fallbackBlob);
  assert.ok(fallbackBlob.size > 2000);
});






