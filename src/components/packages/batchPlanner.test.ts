import assert from 'node:assert/strict';
import test from 'node:test';
import {
  planQuestionBatches,
  formatBatchDescription,
  QuestionBatchSpec,
} from './PackageFormView.tsx';
import type { QuestionItem } from '../../types/index.ts';
import { autoNumberQuestions } from '../../utils/curriculum.ts';

test('Sequential Batching — Test 1: 10 butir soal (<= 15) menggunakan 1 batch tunggal', () => {
  const plan = planQuestionBatches(10, 0, 0, 0, 15);
  assert.equal(plan.length, 1, 'Harus 1 batch tunggal untuk 10 soal');
  assert.equal(plan[0].totalQuestions, 10);
  assert.equal(plan[0].multipleChoiceCount, 10);
  assert.equal(plan[0].complexMultipleChoiceCount, 0);
  assert.equal(plan[0].shortAnswerCount, 0);
  assert.equal(plan[0].essayCount, 0);
  assert.equal(plan[0].batchNumber, 1);
  assert.equal(plan[0].totalBatches, 1);
  assert.equal(plan[0].description, '10 Pilihan Ganda');
});

test('Sequential Batching — Test 2: 15 butir soal (<= 15 batas atas) tetap menggunakan 1 batch tunggal', () => {
  // 10 PG + 5 Isian = 15
  const plan = planQuestionBatches(10, 0, 5, 0, 15);
  assert.equal(plan.length, 1, 'Harus 1 batch tunggal untuk tepat 15 soal');
  assert.equal(plan[0].totalQuestions, 15);
  assert.equal(plan[0].multipleChoiceCount, 10);
  assert.equal(plan[0].shortAnswerCount, 5);
  assert.equal(plan[0].description, '10 Pilihan Ganda, 5 Isian');
});

test('Sequential Batching — Test 3: 30 butir soal (15 PG, 5 PGK, 5 Isian, 5 Uraian) terbagi menjadi tepat 2 batch', () => {
  const plan = planQuestionBatches(15, 5, 5, 5, 15);
  
  assert.equal(plan.length, 2, 'Harus terbagi menjadi tepat 2 batch untuk 30 soal');

  // Batch 1: 15 Pilihan Ganda
  assert.equal(plan[0].batchNumber, 1);
  assert.equal(plan[0].totalQuestions, 15);
  assert.equal(plan[0].multipleChoiceCount, 15);
  assert.equal(plan[0].complexMultipleChoiceCount, 0);
  assert.equal(plan[0].shortAnswerCount, 0);
  assert.equal(plan[0].essayCount, 0);
  assert.equal(plan[0].description, '15 Pilihan Ganda');

  // Batch 2: 5 PG Kompleks + 5 Isian + 5 Uraian
  assert.equal(plan[1].batchNumber, 2);
  assert.equal(plan[1].totalQuestions, 15);
  assert.equal(plan[1].multipleChoiceCount, 0);
  assert.equal(plan[1].complexMultipleChoiceCount, 5);
  assert.equal(plan[1].shortAnswerCount, 5);
  assert.equal(plan[1].essayCount, 5);
  assert.equal(plan[1].description, '5 PG Kompleks, 5 Isian, 5 Uraian');

  // Verifikasi total akumulasi
  const sumTotal = plan.reduce((acc, b) => acc + b.totalQuestions, 0);
  assert.equal(sumTotal, 30);
  const sumMC = plan.reduce((acc, b) => acc + b.multipleChoiceCount, 0);
  assert.equal(sumMC, 15);
  const sumCMC = plan.reduce((acc, b) => acc + b.complexMultipleChoiceCount, 0);
  assert.equal(sumCMC, 5);
  const sumSA = plan.reduce((acc, b) => acc + b.shortAnswerCount, 0);
  assert.equal(sumSA, 5);
  const sumES = plan.reduce((acc, b) => acc + b.essayCount, 0);
  assert.equal(sumES, 5);
});

test('Sequential Batching — Test 4: 50 butir soal (35 PG, 5 PGK, 5 Isian, 5 Uraian) terbagi dengan batas max 15 per batch', () => {
  const plan = planQuestionBatches(35, 5, 5, 5, 15);
  
  assert.equal(plan.length, 4, 'Harus terbagi menjadi 4 batch untuk 50 soal');

  // Tiap batch wajib <= 15
  plan.forEach((b) => {
    assert.ok(b.totalQuestions <= 15, `Batch ${b.batchNumber} melebihi 15 butir: ${b.totalQuestions}`);
    assert.ok(b.totalQuestions > 0, `Batch ${b.batchNumber} tidak boleh 0`);
  });

  // Batch 1: 15 PG
  assert.equal(plan[0].multipleChoiceCount, 15);
  assert.equal(plan[0].totalQuestions, 15);

  // Batch 2: 15 PG
  assert.equal(plan[1].multipleChoiceCount, 15);
  assert.equal(plan[1].totalQuestions, 15);

  // Batch 3: 5 PG + 5 PGK + 5 Isian = 15
  assert.equal(plan[2].multipleChoiceCount, 5);
  assert.equal(plan[2].complexMultipleChoiceCount, 5);
  assert.equal(plan[2].shortAnswerCount, 5);
  assert.equal(plan[2].essayCount, 0);
  assert.equal(plan[2].totalQuestions, 15);

  // Batch 4: 5 Uraian
  assert.equal(plan[3].multipleChoiceCount, 0);
  assert.equal(plan[3].complexMultipleChoiceCount, 0);
  assert.equal(plan[3].shortAnswerCount, 0);
  assert.equal(plan[3].essayCount, 5);
  assert.equal(plan[3].totalQuestions, 5);

  // Verifikasi total
  const sumTotal = plan.reduce((acc, b) => acc + b.totalQuestions, 0);
  assert.equal(sumTotal, 50);
});

test('Sequential Batching — Penggabungan Hasil dan Penomoran Kontinu 1..N', () => {
  // Simulasi respons Batch 1 (15 PG)
  const batch1Items: QuestionItem[] = Array.from({ length: 15 }, (_, i) => ({
    id: `b1_q_${i + 1}`,
    number: i + 1,
    type: 'multiple_choice' as const,
    questionText: `Pertanyaan PG ${i + 1}`,
    options: [
      { key: 'A', text: 'Pilihan A' },
      { key: 'B', text: 'Pilihan B' },
      { key: 'C', text: 'Pilihan C' },
      { key: 'D', text: 'Pilihan D' },
    ],
    answerKey: 'A',
    explanation: 'Pembahasan guru',
    score: 1,
    indicator: 'Indikator PG',
    cognitiveLevel: 'L1 (Mengingat/Memahami)' as const,
  }));

  // Simulasi respons Batch 2 (5 PGK, 5 Isian, 5 Uraian)
  const batch2Items: QuestionItem[] = [
    // 5 PGK (nomor lokal dari AI biasanya 1..5)
    ...Array.from({ length: 5 }, (_, i) => ({
      id: `b2_cmc_${i + 1}`,
      number: i + 1,
      type: 'complex_multiple_choice' as const,
      questionText: `Pertanyaan PGK ${i + 1}`,
      options: [
        { key: 'A', text: 'Pilihan A' },
        { key: 'B', text: 'Pilihan B' },
        { key: 'C', text: 'Pilihan C' },
        { key: 'D', text: 'Pilihan D' },
      ],
      answerKey: 'A, C',
      explanation: 'Pembahasan PGK',
      score: 2,
      indicator: 'Indikator PGK',
      cognitiveLevel: 'L2 (Menerapkan)' as const,
    })),
    // 5 Isian
    ...Array.from({ length: 5 }, (_, i) => ({
      id: `b2_sa_${i + 1}`,
      number: i + 6,
      type: 'short_answer' as const,
      questionText: `Pertanyaan Isian ${i + 1}`,
      answerKey: 'Kunci Isian',
      explanation: 'Pembahasan Isian',
      score: 2,
      indicator: 'Indikator Isian',
      cognitiveLevel: 'L1 (Mengingat/Memahami)' as const,
    })),
    // 5 Uraian
    ...Array.from({ length: 5 }, (_, i) => ({
      id: `b2_es_${i + 1}`,
      number: i + 11,
      type: 'essay' as const,
      questionText: `Pertanyaan Uraian ${i + 1}`,
      answerKey: 'Pedoman Uraian',
      rubric: [{ criteria: 'Kriteria lengkap', score: 4 }],
      explanation: 'Pembahasan Uraian',
      score: 4,
      indicator: 'Indikator Uraian',
      cognitiveLevel: 'L3 (Penalaran/HOTS)' as const,
    })),
  ];

  // Gabungkan kedua batch
  const combined = [...batch1Items, ...batch2Items];
  assert.equal(combined.length, 30, 'Total gabungan harus tepat 30 butir');

  // Jalankan penomoran otomatis
  const finalized = autoNumberQuestions(combined);
  assert.equal(finalized.length, 30);

  // Verifikasi nomor urut 1 sampai 30 kontinu tanpa celah
  for (let i = 0; i < finalized.length; i++) {
    assert.equal(finalized[i].number, i + 1, `Nomor soal ke-${i} harus ${i + 1}`);
  }

  // Verifikasi komposisi soal tidak berubah
  const mcCount = finalized.filter((q) => q.type === 'multiple_choice').length;
  const cmcCount = finalized.filter((q) => q.type === 'complex_multiple_choice').length;
  const saCount = finalized.filter((q) => q.type === 'short_answer').length;
  const esCount = finalized.filter((q) => q.type === 'essay').length;

  assert.equal(mcCount, 15, 'PG harus tepat 15');
  assert.equal(cmcCount, 5, 'PGK harus tepat 5');
  assert.equal(saCount, 5, 'Isian harus tepat 5');
  assert.equal(esCount, 5, 'Uraian harus tepat 5');

  // Verifikasi seluruh properti soal (kunci jawaban, pembahasan, rubrik) tetap utuh
  const lastEssay = finalized[29];
  assert.equal(lastEssay.type, 'essay');
  assert.equal(lastEssay.answerKey, 'Pedoman Uraian');
  assert.ok(Array.isArray(lastEssay.rubric) && lastEssay.rubric.length === 1);
  assert.equal(lastEssay.rubric[0].score, 4);
});
