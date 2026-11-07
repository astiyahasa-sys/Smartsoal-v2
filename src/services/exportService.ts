/**
 * Layanan Ekspor Dokumen Resmi
 * MADRASAH SMART SOAL — Tahap 2
 * 
 * Menghasilkan berkas biner asli:
 * - Microsoft Word (.docx) via pustaka 'docx'
 * - Microsoft Excel (.xlsx) via pustaka 'xlsx'
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  PageBreak,
  ImageRun,
  VerticalAlign,
} from 'docx';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { QuestionPackage, QuestionItem, SchoolProfile } from '../types';
import { formatIndonesianDate, normalizeQuestionNumbering } from '../utils/curriculum';
import { dataUrlToUint8Array } from '../utils/imageCompression';
import { getSchoolProfile } from './storage';

/**
 * Menyisipkan gambar soal ke dalam daftar paragraf dokumen Word
 */
function addQuestionImageToDoc(docChildren: any[], q: QuestionItem) {
  if (!q.imageUrl) return;
  const imageBytes = dataUrlToUint8Array(q.imageUrl);
  if (imageBytes && imageBytes.length > 0) {
    try {
      const imageType = q.imageUrl.startsWith('data:image/png') ? 'png' : 'jpg';
      docChildren.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 80, after: 40 },
          children: [
            new ImageRun({
              data: imageBytes,
              transformation: {
                width: 320,
                height: 220,
              },
              type: imageType,
            }),
          ],
        })
      );
      if (q.imageCaption) {
        docChildren.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: q.imageCaption,
                italics: true,
                size: 18,
                font: 'Times New Roman',
              }),
            ],
          })
        );
      }
    } catch (imgErr) {
      console.warn('Gagal menambahkan ImageRun ke Word document:', imgErr);
    }
  }
}

export interface ExportOptions {
  includeAnswers: boolean; // true = Paket Guru (lengkap kunci & pembahasan), false = Naskah Siswa
}

/**
 * Pemicu pengunduhan berkas Blob pada browser
 */
export function triggerBrowserDownload(blob: Blob, filename: string) {
  if (typeof window === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Membentuk elemen Kop Surat Resmi Madrasah untuk dokumen Word (.docx)
 * Menyematkan logo resmi madrasah (jika ada pada profil) dalam tata letak tabel tanpa garis
 * serta hierarki alamat lengkap (jalan, desa/kelurahan, kecamatan, kota/kabupaten, provinsi).
 */
export function createMadrasahKopElements(
  schoolProfile: SchoolProfile | null,
  overrideSchoolName?: string
): (Table | Paragraph)[] {
  const activeProfile = schoolProfile || getSchoolProfile();
  const schoolName = overrideSchoolName || activeProfile?.schoolName || 'MADRASAH IBTIDAIYAH';

  const addrParts = [
    activeProfile?.address,
    activeProfile?.village ? `Desa/Kel. ${activeProfile.village}` : '',
    activeProfile?.subdistrict ? `Kec. ${activeProfile.subdistrict}` : '',
    activeProfile?.city,
    activeProfile?.province,
  ].filter(Boolean);
  const addressText = addrParts.length > 0 ? addrParts.join(', ') : 'Kementerian Agama Republik Indonesia';

  const logoBytes = activeProfile?.logoUrl ? dataUrlToUint8Array(activeProfile.logoUrl) : null;
  const elements: (Table | Paragraph)[] = [];

  const textParagraphs = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 30 },
      children: [
        new TextRun({
          text: 'KEMENTERIAN AGAMA REPUBLIK INDONESIA',
          font: 'Times New Roman',
          size: 21,
          bold: true,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 30 },
      children: [
        new TextRun({
          text: schoolName.toUpperCase(),
          font: 'Times New Roman',
          size: 26,
          bold: true,
        }),
      ],
    }),
  ];

  if (activeProfile?.npsnOrNsm) {
    textParagraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 30 },
        children: [
          new TextRun({
            text: `NSM / NPSN: ${activeProfile.npsnOrNsm}`,
            font: 'Times New Roman',
            size: 17,
            bold: true,
          }),
        ],
      })
    );
  }

  textParagraphs.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: addressText,
          font: 'Times New Roman',
          size: 17,
          italics: true,
        }),
      ],
    })
  );

  if (logoBytes && logoBytes.length > 0) {
    try {
      const logoType = activeProfile?.logoUrl?.startsWith('data:image/png') ? 'png' : 'jpg';
      const kopTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
          bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
          left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
          right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
          insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'auto' },
          insideVertical: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 16, type: WidthType.PERCENTAGE },
                verticalAlign: VerticalAlign.CENTER,
                borders: {
                  top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                  bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                  left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                  right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new ImageRun({
                        data: logoBytes,
                        transformation: { width: 68, height: 68 },
                        type: logoType,
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                width: { size: 84, type: WidthType.PERCENTAGE },
                verticalAlign: VerticalAlign.CENTER,
                borders: {
                  top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                  bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                  left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                  right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
                },
                children: textParagraphs,
              }),
            ],
          }),
        ],
      });
      elements.push(kopTable);
    } catch (logoErr) {
      console.warn('Gagal menyisipkan logo ke Kop Word:', logoErr);
      elements.push(...textParagraphs);
    }
  } else {
    elements.push(...textParagraphs);
  }

  // Garis Pembatas Kop Ganda Resmi Kemenag
  elements.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 160 },
      border: {
        bottom: {
          style: BorderStyle.DOUBLE,
          size: 20,
          color: '000000',
        },
      },
      children: [],
    })
  );

  return elements;
}

/**
 * Membentuk blok tanda tangan resmi Kepala Madrasah dan Guru Pengampu
 */
export function createSignatureBlock(
  schoolProfile: SchoolProfile | null,
  options?: {
    teacherName?: string;
    city?: string;
    dateText?: string;
    teacherRoleTitle?: string;
  }
): (Table | Paragraph)[] {
  const activeProfile = schoolProfile || getSchoolProfile();
  const cityName = options?.city || activeProfile?.city || 'Madrasah';
  const dateText = options?.dateText || formatIndonesianDate(new Date().toISOString());
  const teacherRole = options?.teacherRoleTitle || 'Guru Mata Pelajaran';

  const principalName = activeProfile?.principalName || '( .............................................. )';
  const principalNip = activeProfile?.principalNip ? `NIP. ${activeProfile.principalNip}` : 'NIP. ........................................';
  const teacherName = options?.teacherName || activeProfile?.teacherName || '( .............................................. )';
  const teacherNip = activeProfile?.teacherNip ? `NIP. ${activeProfile.teacherNip}` : 'NIP. ........................................';

  const sigTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
      bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
      left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
      right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'auto' },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: 'auto' },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
              bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
              left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
              right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
            },
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Mengetahui,', font: 'Times New Roman', size: 19 })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Kepala Madrasah', bold: true, font: 'Times New Roman', size: 19 })] }),
              new Paragraph({ spacing: { before: 550 } }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: principalName, bold: true, underline: {}, font: 'Times New Roman', size: 19 })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: principalNip, font: 'Times New Roman', size: 17 })] }),
            ],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
              bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
              left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
              right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
            },
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${cityName}, ${dateText}`, font: 'Times New Roman', size: 19 })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: teacherRole, bold: true, font: 'Times New Roman', size: 19 })] }),
              new Paragraph({ spacing: { before: 550 } }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: teacherName, bold: true, underline: {}, font: 'Times New Roman', size: 19 })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: teacherNip, font: 'Times New Roman', size: 17 })] }),
            ],
          }),
        ],
      }),
    ],
  });

  return [
    new Paragraph({ spacing: { before: 240 } }),
    sigTable,
  ];
}

/**
 * Ekspor Dokumen Microsoft Word (.docx) Asli
 */
export async function exportToWordDocument(
  pkg: QuestionPackage,
  schoolProfile: SchoolProfile | null,
  options: ExportOptions
): Promise<Blob> {
  const activeProfile = schoolProfile || getSchoolProfile();
  const docChildren: any[] = [];

  // 1. KOP MADRASAH
  docChildren.push(...createMadrasahKopElements(activeProfile, pkg.schoolName));

  // 2. JUDUL NASKAH
  docChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 50 },
      children: [
        new TextRun({
          text: `NASKAH SOAL ${pkg.assessmentType.toUpperCase()}`,
          font: 'Times New Roman',
          size: 24,
          bold: true,
          underline: {},
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 150 },
      children: [
        new TextRun({
          text: `TAHUN PELAJARAN ${pkg.academicYear} — SEMESTER ${pkg.semester.toUpperCase()}`,
          font: 'Times New Roman',
          size: 20,
          bold: true,
        }),
      ],
    })
  );

  // 3. TABEL IDENTITAS ASESMEN & SISWA
  const infoTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: 'B0BEC5' },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: 'B0BEC5' },
      left: { style: BorderStyle.SINGLE, size: 4, color: 'B0BEC5' },
      right: { style: BorderStyle.SINGLE, size: 4, color: 'B0BEC5' },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'auto' },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'B0BEC5' },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 52, type: WidthType.PERCENTAGE },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [
              new Paragraph({
                spacing: { after: 30 },
                children: [
                  new TextRun({ text: 'Mata Pelajaran\t: ', bold: true, font: 'Times New Roman', size: 19 }),
                  new TextRun({ text: pkg.subject, bold: true, font: 'Times New Roman', size: 19 }),
                ],
              }),
              new Paragraph({
                spacing: { after: 30 },
                children: [
                  new TextRun({ text: 'Kelas / Fase\t: ', bold: true, font: 'Times New Roman', size: 19 }),
                  new TextRun({ text: `Kelas ${pkg.grade} (${pkg.phase})`, font: 'Times New Roman', size: 19 }),
                ],
              }),
              new Paragraph({
                spacing: { after: 30 },
                children: [
                  new TextRun({ text: 'Semester\t: ', bold: true, font: 'Times New Roman', size: 19 }),
                  new TextRun({ text: pkg.semester, font: 'Times New Roman', size: 19 }),
                ],
              }),
              new Paragraph({
                spacing: { after: 20 },
                children: [
                  new TextRun({ text: 'Alokasi Waktu\t: ', bold: true, font: 'Times New Roman', size: 19 }),
                  new TextRun({ text: `${pkg.durationMinutes} Menit`, font: 'Times New Roman', size: 19 }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 48, type: WidthType.PERCENTAGE },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [
              new Paragraph({
                spacing: { after: 30 },
                children: [
                  new TextRun({ text: 'Nama Siswa\t: ', bold: true, font: 'Times New Roman', size: 19 }),
                  new TextRun({ text: '............................................', font: 'Times New Roman', size: 19 }),
                ],
              }),
              new Paragraph({
                spacing: { after: 30 },
                children: [
                  new TextRun({ text: 'Nomor Absen\t: ', bold: true, font: 'Times New Roman', size: 19 }),
                  new TextRun({ text: '............................................', font: 'Times New Roman', size: 19 }),
                ],
              }),
              new Paragraph({
                spacing: { after: 30 },
                children: [
                  new TextRun({ text: 'Hari / Tanggal\t: ', bold: true, font: 'Times New Roman', size: 19 }),
                  new TextRun({ text: '............................................', font: 'Times New Roman', size: 19 }),
                ],
              }),
              new Paragraph({
                spacing: { after: 20 },
                children: [
                  new TextRun({ text: 'Nilai / Paraf\t: ', bold: true, font: 'Times New Roman', size: 19 }),
                  new TextRun({ text: '[                                        ]', font: 'Times New Roman', size: 19 }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
  docChildren.push(infoTable);

  // 4. PETUNJUK UMUM
  docChildren.push(
    new Paragraph({
      spacing: { before: 180, after: 60 },
      children: [new TextRun({ text: 'PETUNJUK UMUM:', bold: true, size: 20 })],
    }),
    new Paragraph({
      spacing: { after: 40 },
      children: [new TextRun({ text: '1. Berdoalah sebelum mulai mengerjakan soal.' })],
    }),
    new Paragraph({
      spacing: { after: 40 },
      children: [new TextRun({ text: '2. Tulislah nama dan nomor peserta pada lembar jawaban yang tersedia.' })],
    }),
    new Paragraph({
      spacing: { after: 40 },
      children: [new TextRun({ text: '3. Bacalah setiap butir soal dengan teliti sebelum menjawab.' })],
    }),
    new Paragraph({
      spacing: { after: 180 },
      children: [new TextRun({ text: '4. Periksa kembali jawaban Anda sebelum diserahkan kepada pengawas.' })],
    })
  );

  // 5. BUTIR-BUTIR SOAL
  const questions = normalizeQuestionNumbering(pkg.questions || []);

  if (questions.length === 0) {
    docChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 240, after: 240 },
        children: [
          new TextRun({
            text: '[Belum ada butir soal yang digenerate pada paket asesmen ini]',
            italics: true,
            color: '666666',
          }),
        ],
      })
    );
  } else {
    let sectionIdx = 1;
    const toRoman = (n: number) => ['I', 'II', 'III', 'IV'][n - 1] || `${n}`;

    // Bagian: Pilihan Ganda Biasa
    const mcQuestions = questions.filter((q) => q.type === 'multiple_choice');
    if (mcQuestions.length > 0) {
      docChildren.push(
        new Paragraph({
          spacing: { before: 180, after: 80 },
          children: [
            new TextRun({
              text: `${toRoman(sectionIdx++)}. PILIHAN GANDA`,
              bold: true,
              size: 22,
            }),
          ],
        }),
        new Paragraph({
          spacing: { after: 120 },
          children: [
            new TextRun({
              text: pkg.mcOptionCount === 3
                ? 'Berilah tanda silang (X) pada huruf A, B, atau C di depan jawaban yang paling tepat!'
                : 'Berilah tanda silang (X) pada huruf A, B, C, atau D di depan jawaban yang paling tepat!',
              italics: true,
            }),
          ],
        })
      );

      mcQuestions.forEach((q) => {
        const isImageAbove =
          q.imagePosition === 'above_question' ||
          (!q.imagePosition && pkg.defaultImagePosition === 'above_question');

        if (isImageAbove) {
          addQuestionImageToDoc(docChildren, q);
        }

        docChildren.push(
          new Paragraph({
            spacing: { before: 80, after: 40 },
            children: [
              new TextRun({ text: `${q.number}. `, bold: true }),
              new TextRun({ text: q.questionText }),
            ],
          })
        );

        if (!isImageAbove) {
          addQuestionImageToDoc(docChildren, q);
        }

        if (q.options && q.options.length > 0) {
          q.options.forEach((opt) => {
            docChildren.push(
              new Paragraph({
                indent: { left: 400 },
                spacing: { after: 20 },
                children: [
                  new TextRun({ text: `${opt.key}. `, bold: true }),
                  new TextRun({ text: opt.text }),
                ],
              })
            );
          });
        }
      });
    }

    // Bagian: Pilihan Ganda Kompleks
    const complexMcQuestions = questions.filter((q) => q.type === 'complex_multiple_choice');
    if (complexMcQuestions.length > 0) {
      docChildren.push(
        new Paragraph({
          spacing: { before: 200, after: 80 },
          children: [
            new TextRun({
              text: `${toRoman(sectionIdx++)}. PILIHAN GANDA KOMPLEKS`,
              bold: true,
              size: 22,
            }),
          ],
        }),
        new Paragraph({
          spacing: { after: 120 },
          children: [
            new TextRun({
              text: 'Berilah tanda centang (√) atau silang (X) pada lebih dari satu jawaban yang benar (2 atau 3 jawaban benar)!',
              italics: true,
            }),
          ],
        })
      );

      complexMcQuestions.forEach((q) => {
        const isImageAbove =
          q.imagePosition === 'above_question' ||
          (!q.imagePosition && pkg.defaultImagePosition === 'above_question');

        if (isImageAbove) {
          addQuestionImageToDoc(docChildren, q);
        }

        docChildren.push(
          new Paragraph({
            spacing: { before: 80, after: 40 },
            children: [
              new TextRun({ text: `${q.number}. `, bold: true }),
              new TextRun({ text: q.questionText }),
            ],
          })
        );

        if (!isImageAbove) {
          addQuestionImageToDoc(docChildren, q);
        }

        if (q.options && q.options.length > 0) {
          q.options.forEach((opt) => {
            docChildren.push(
              new Paragraph({
                indent: { left: 400 },
                spacing: { after: 20 },
                children: [
                  new TextRun({ text: `[   ]  ${opt.key}. `, bold: true }),
                  new TextRun({ text: opt.text }),
                ],
              })
            );
          });
        }
      });
    }

    // Bagian: Isian Singkat
    const saQuestions = questions.filter((q) => q.type === 'short_answer');
    if (saQuestions.length > 0) {
      docChildren.push(
        new Paragraph({
          spacing: { before: 200, after: 80 },
          children: [
            new TextRun({
              text: `${toRoman(sectionIdx++)}. ISIAN SINGKAT`,
              bold: true,
              size: 22,
            }),
          ],
        }),
        new Paragraph({
          spacing: { after: 120 },
          children: [
            new TextRun({
              text: 'Isilah titik-titik di bawah ini dengan jawaban yang tepat dan benar!',
              italics: true,
            }),
          ],
        })
      );

      saQuestions.forEach((q) => {
        const isImageAbove =
          q.imagePosition === 'above_question' ||
          (!q.imagePosition && pkg.defaultImagePosition === 'above_question');

        if (isImageAbove) {
          addQuestionImageToDoc(docChildren, q);
        }

        docChildren.push(
          new Paragraph({
            spacing: { before: 80, after: 60 },
            children: [
              new TextRun({ text: `${q.number}. `, bold: true }),
              new TextRun({ text: q.questionText }),
            ],
          })
        );

        if (!isImageAbove) {
          addQuestionImageToDoc(docChildren, q);
        }
      });
    }

    // Bagian: Uraian
    const essayQuestions = questions.filter((q) => q.type === 'essay');
    if (essayQuestions.length > 0) {
      docChildren.push(
        new Paragraph({
          spacing: { before: 200, after: 80 },
          children: [
            new TextRun({
              text: `${toRoman(sectionIdx++)}. URAIAN / ESSAY`,
              bold: true,
              size: 22,
            }),
          ],
        }),
        new Paragraph({
          spacing: { after: 120 },
          children: [
            new TextRun({
              text: 'Jawablah pertanyaan-pertanyaan berikut dengan penjelasan yang lengkap dan jelas!',
              italics: true,
            }),
          ],
        })
      );

      essayQuestions.forEach((q) => {
        const isImageAbove =
          q.imagePosition === 'above_question' ||
          (!q.imagePosition && pkg.defaultImagePosition === 'above_question');

        if (isImageAbove) {
          addQuestionImageToDoc(docChildren, q);
        }

        docChildren.push(
          new Paragraph({
            spacing: { before: 80, after: 60 },
            children: [
              new TextRun({ text: `${q.number}. `, bold: true }),
              new TextRun({ text: q.questionText }),
            ],
          })
        );

        if (!isImageAbove) {
          addQuestionImageToDoc(docChildren, q);
        }
      });
    }

    // Tanda Tangan Resmi pada Akhir Naskah Soal Siswa
    docChildren.push(
      ...createSignatureBlock(activeProfile, {
        teacherName: pkg.teacherName,
        teacherRoleTitle: 'Guru Pengampu / Penyusun',
      })
    );

    // KUNCI JAWABAN & PEDOMAN PENSKORAN RESMI UNTUK PAKET GURU
    if (options.includeAnswers) {
      docChildren.push(
        new Paragraph({
          children: [new PageBreak()],
        })
      );

      // Kop Madrasah untuk Dokumen Kunci Jawaban
      docChildren.push(...createMadrasahKopElements(activeProfile, pkg.schoolName));

      // Judul Dokumen Kunci Jawaban
      docChildren.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 60, after: 40 },
          children: [
            new TextRun({
              text: 'KUNCI JAWABAN DAN PEDOMAN PENSKORAN',
              font: 'Times New Roman',
              size: 24,
              bold: true,
              underline: {},
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 40 },
          children: [
            new TextRun({
              text: `${pkg.assessmentType.toUpperCase()} — TAHUN PELAJARAN ${pkg.academicYear}`,
              font: 'Times New Roman',
              size: 19,
              bold: true,
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 160 },
          children: [
            new TextRun({
              text: `[DOKUMEN RESMI GURU & PENILAIAN] ${pkg.title}`,
              font: 'Times New Roman',
              size: 17,
              italics: true,
              bold: true,
            }),
          ],
        })
      );

      // Tabel Rekap Identitas Penilaian
      const totalScore = questions.reduce((sum, q) => sum + (Number(q.score) || 1), 0);
      docChildren.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({ text: 'Mata Pelajaran\t: ', bold: true, font: 'Times New Roman', size: 18 }),
                        new TextRun({ text: pkg.subject, font: 'Times New Roman', size: 18 }),
                      ],
                    }),
                    new Paragraph({
                      children: [
                        new TextRun({ text: 'Kelas / Fase\t: ', bold: true, font: 'Times New Roman', size: 18 }),
                        new TextRun({ text: `Kelas ${pkg.grade} (${pkg.phase})`, font: 'Times New Roman', size: 18 }),
                      ],
                    }),
                    new Paragraph({
                      children: [
                        new TextRun({ text: 'Semester\t: ', bold: true, font: 'Times New Roman', size: 18 }),
                        new TextRun({ text: pkg.semester, font: 'Times New Roman', size: 18 }),
                      ],
                    }),
                  ],
                }),
                new TableCell({
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({ text: 'Alokasi Waktu\t: ', bold: true, font: 'Times New Roman', size: 18 }),
                        new TextRun({ text: `${pkg.durationMinutes} Menit`, font: 'Times New Roman', size: 18 }),
                      ],
                    }),
                    new Paragraph({
                      children: [
                        new TextRun({ text: 'Guru Pengampu\t: ', bold: true, font: 'Times New Roman', size: 18 }),
                        new TextRun({ text: pkg.teacherName || activeProfile?.teacherName || 'Guru Madrasah', font: 'Times New Roman', size: 18 }),
                      ],
                    }),
                    new Paragraph({
                      children: [
                        new TextRun({ text: 'Total Skor Maks.\t: ', bold: true, font: 'Times New Roman', size: 18 }),
                        new TextRun({ text: `${totalScore}`, bold: true, font: 'Times New Roman', size: 18 }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
        new Paragraph({ spacing: { after: 160 } })
      );

      // Tabel Rekap Kunci Jawaban Lengkap
      const answerTableRows: TableRow[] = [
        new TableRow({
          tableHeader: true,
          children: [
            new TableCell({
              width: { size: 7, type: WidthType.PERCENTAGE },
              shading: { fill: 'E2E8F0' },
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'No.', bold: true, font: 'Times New Roman', size: 18 })] })],
            }),
            new TableCell({
              width: { size: 16, type: WidthType.PERCENTAGE },
              shading: { fill: 'E2E8F0' },
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Bentuk', bold: true, font: 'Times New Roman', size: 18 })] })],
            }),
            new TableCell({
              width: { size: 28, type: WidthType.PERCENTAGE },
              shading: { fill: 'E2E8F0' },
              children: [new Paragraph({ children: [new TextRun({ text: 'Kunci Jawaban Benar', bold: true, font: 'Times New Roman', size: 18 })] })],
            }),
            new TableCell({
              width: { size: 8, type: WidthType.PERCENTAGE },
              shading: { fill: 'E2E8F0' },
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Skor', bold: true, font: 'Times New Roman', size: 18 })] })],
            }),
            new TableCell({
              width: { size: 18, type: WidthType.PERCENTAGE },
              shading: { fill: 'E2E8F0' },
              children: [new Paragraph({ children: [new TextRun({ text: 'Indikator Soal', bold: true, font: 'Times New Roman', size: 18 })] })],
            }),
            new TableCell({
              width: { size: 23, type: WidthType.PERCENTAGE },
              shading: { fill: 'E2E8F0' },
              children: [new Paragraph({ children: [new TextRun({ text: 'Pembahasan Singkat', bold: true, font: 'Times New Roman', size: 18 })] })],
            }),
          ],
        }),
      ];

      for (const q of questions) {
        const typeLabel =
          q.type === 'multiple_choice'
            ? 'PG Biasa'
            : q.type === 'complex_multiple_choice'
            ? 'PG Kompleks'
            : q.type === 'short_answer'
            ? 'Isian'
            : 'Uraian';

        let keyText = q.answerKey || '-';
        if (q.type === 'short_answer' && q.acceptedAnswers && q.acceptedAnswers.length > 0) {
          keyText += ` (Alternatif: ${q.acceptedAnswers.join(' / ')})`;
        }

        answerTableRows.push(
          new TableRow({
            children: [
              new TableCell({
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(q.number), bold: true, font: 'Times New Roman', size: 18 })] })],
              }),
              new TableCell({
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: typeLabel, font: 'Times New Roman', size: 18 })] })],
              }),
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: keyText, bold: q.type === 'multiple_choice', font: 'Times New Roman', size: 18 })] })],
              }),
              new TableCell({
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(q.score || 1), bold: true, font: 'Times New Roman', size: 18 })] })],
              }),
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: q.indicator || '-', font: 'Times New Roman', size: 16 })] })],
              }),
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: q.explanation || '-', font: 'Times New Roman', size: 16 })] })],
              }),
            ],
          })
        );
      }

      docChildren.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: answerTableRows,
        }),
        new Paragraph({ spacing: { after: 180 } })
      );

      // Rubrik Penskoran Detail untuk Soal Uraian jika ada
      const essayQuestions = questions.filter((q) => q.type === 'essay');
      if (essayQuestions.length > 0) {
        docChildren.push(
          new Paragraph({
            spacing: { before: 140, after: 80 },
            children: [
              new TextRun({
                text: 'PEDOMAN PENSKORAN & RUBRIK SOAL URAIAN',
                bold: true,
                font: 'Times New Roman',
                size: 20,
              }),
            ],
          })
        );

        for (const eq of essayQuestions) {
          docChildren.push(
            new Paragraph({
              spacing: { before: 80, after: 40 },
              children: [
                new TextRun({ text: `Nomor ${eq.number}. `, bold: true, font: 'Times New Roman', size: 18 }),
                new TextRun({ text: eq.questionText, font: 'Times New Roman', size: 18 }),
              ],
            }),
            new Paragraph({
              spacing: { after: 40 },
              children: [
                new TextRun({ text: 'Kunci / Jawaban Ideal: ', bold: true, font: 'Times New Roman', size: 18 }),
                new TextRun({ text: eq.answerKey || 'Uraian sesuai capaian materi.', font: 'Times New Roman', size: 18 }),
              ],
            })
          );

          if (eq.rubric && eq.rubric.length > 0) {
            const rubricRows: TableRow[] = [
              new TableRow({
                tableHeader: true,
                children: [
                  new TableCell({
                    width: { size: 80, type: WidthType.PERCENTAGE },
                    shading: { fill: 'F1F5F9' },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Kriteria Penilaian', bold: true, font: 'Times New Roman', size: 16 })] })],
                  }),
                  new TableCell({
                    width: { size: 20, type: WidthType.PERCENTAGE },
                    shading: { fill: 'F1F5F9' },
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Skor', bold: true, font: 'Times New Roman', size: 16 })] })],
                  }),
                ],
              }),
            ];

            for (const rub of eq.rubric) {
              rubricRows.push(
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: rub.criteria, font: 'Times New Roman', size: 16 })] })] }),
                    new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(rub.score), bold: true, font: 'Times New Roman', size: 16 })] })] }),
                  ],
                })
              );
            }

            docChildren.push(
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: rubricRows,
              }),
              new Paragraph({ spacing: { after: 80 } })
            );
          }
        }
      }

      // Tanda Tangan pada Dokumen Kunci Jawaban
      docChildren.push(
        ...createSignatureBlock(activeProfile, {
          teacherName: pkg.teacherName,
          teacherRoleTitle: 'Guru Mata Pelajaran / Penilai',
        })
      );
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: docChildren,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  return blob;
}

/**
 * Ekspor Dokumen Microsoft Excel (.xlsx) Asli
 */
export function exportToExcelWorkbook(
  pkg: QuestionPackage,
  schoolProfile: SchoolProfile | null,
  options: ExportOptions
): Blob {
  const wb = XLSX.utils.book_new();
  const questions = normalizeQuestionNumbering(pkg.questions || []);

  // SHEET 1: KISI-KISI ASESMEN
  const kisiKisiRows: any[] = [];
  kisiKisiRows.push(['MATRIKS KISI-KISI ASESMEN KURIKULUM MERDEKA MADRASAH IBTIDAIYAH']);
  kisiKisiRows.push([`Madrasah: ${pkg.schoolName || schoolProfile?.schoolName || 'MIN 1'}`]);
  kisiKisiRows.push([`Mata Pelajaran: ${pkg.subject}`, `Kelas / Fase: Kelas ${pkg.grade} (${pkg.phase})`]);
  kisiKisiRows.push([`Tahun Pelajaran: ${pkg.academicYear}`, `Semester: ${pkg.semester}`]);
  kisiKisiRows.push([]); // Baris kosong

  // Header Kisi-kisi
  const kisiHeaders = [
    'No Soal',
    'Mata Pelajaran',
    'Kelas/Fase',
    'Materi Pokok',
    'Indikator Soal',
    'Bentuk Soal',
    'Level Kognitif',
  ];
  if (options.includeAnswers) {
    kisiHeaders.push('Kunci Jawaban');
  }
  kisiHeaders.push('Skor Maks');

  kisiKisiRows.push(kisiHeaders);

  questions.forEach((q) => {
    const itemTopic = q.topic || pkg.topic;
    const row = [
      q.number,
      pkg.subject,
      `Kelas ${pkg.grade} (${pkg.phase})`,
      itemTopic,
      q.indicator || `Menjawab soal materi ${itemTopic}`,
      q.type === 'multiple_choice' ? 'Pilihan Ganda' : q.type === 'complex_multiple_choice' ? 'PG Kompleks' : q.type === 'short_answer' ? 'Isian Singkat' : 'Uraian',
      q.cognitiveLevel || 'L1',
    ];
    if (options.includeAnswers) {
      row.push(q.answerKey || '-');
    }
    row.push(q.score || 1);
    kisiKisiRows.push(row);
  });

  const wsKisi = XLSX.utils.aoa_to_sheet(kisiKisiRows);
  XLSX.utils.book_append_sheet(wb, wsKisi, 'Kisi-kisi Asesmen');

  // SHEET 2: REKAP BUTIR SOAL
  const soalRows: any[] = [];
  soalRows.push(['REKAPITULASI BUTIR SOAL DAN PILIHAN']);
  soalRows.push([`Judul Paket: ${pkg.title}`]);
  soalRows.push(['Catatan: Format tabel spreadsheet (.xlsx) difokuskan untuk rekap data teks, opsi, dan kunci asesmen. Gambar stimulus visual terlampir pada dokumen Word (.docx) atau Pratinjau Cetak / PDF.']);
  soalRows.push([]);

  const soalHeaders = [
    'No',
    'Tipe Soal',
    'Teks Pertanyaan',
    'Opsi A',
    'Opsi B',
    'Opsi C',
    'Opsi D',
  ];
  if (options.includeAnswers) {
    soalHeaders.push('Kunci Jawaban', 'Pembahasan Guru');
  }
  soalHeaders.push('Skor');

  soalRows.push(soalHeaders);

  questions.forEach((q) => {
    const optA = q.options?.find((o) => o.key === 'A')?.text || '';
    const optB = q.options?.find((o) => o.key === 'B')?.text || '';
    const optC = q.options?.find((o) => o.key === 'C')?.text || '';
    const optD = q.options?.find((o) => o.key === 'D')?.text || '';

    const questionDisplay = q.imageUrl
      ? `${q.questionText}\n[Memiliki Gambar: ${q.imageCaption || q.imageAlt || 'Terlampir'}]`
      : q.imageAlt
      ? `${q.questionText}\n[Saran Gambar: ${q.imageAlt}]`
      : q.questionText;

    const row = [
      q.number,
      q.type === 'multiple_choice' ? 'PG' : q.type === 'complex_multiple_choice' ? 'PG Kompleks' : q.type === 'short_answer' ? 'Isian' : 'Uraian',
      questionDisplay,
      optA,
      optB,
      optC,
      optD,
    ];
    if (options.includeAnswers) {
      row.push(q.answerKey || '-', q.explanation || '-');
    }
    row.push(q.score || 1);
    soalRows.push(row);
  });

  const wsSoal = XLSX.utils.aoa_to_sheet(soalRows);
  XLSX.utils.book_append_sheet(wb, wsSoal, 'Rekap Butir Soal');

  // SHEET 3: RUBRIK PENSKORAN URAIAN (Khusus Paket Guru)
  if (options.includeAnswers) {
    const rubricRows: any[] = [];
    rubricRows.push(['PEDOMAN PENSKORAN DAN RUBRIK URAIAN']);
    rubricRows.push([`Paket: ${pkg.title}`]);
    rubricRows.push([]);
    rubricRows.push(['No Soal', 'Tipe', 'Pertanyaan', 'Kriteria Rubrik', 'Skor']);

    questions
      .filter((q) => q.type === 'essay')
      .forEach((q) => {
        if (q.rubric && q.rubric.length > 0) {
          q.rubric.forEach((r, idx) => {
            rubricRows.push([
              idx === 0 ? q.number : '',
              idx === 0 ? 'Uraian' : '',
              idx === 0 ? q.questionText : '',
              r.criteria,
              r.score,
            ]);
          });
        } else {
          rubricRows.push([q.number, 'Uraian', q.questionText, 'Kesesuaian konsep jawaban', q.score || 3]);
        }
      });

    const wsRubric = XLSX.utils.aoa_to_sheet(rubricRows);
    XLSX.utils.book_append_sheet(wb, wsRubric, 'Rubrik Penskoran');
  }

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  return blob;
}

/**
 * Ekspor Daftar Butir Soal dalam format CSV (Comma-Separated Values)
 * Standar encoding UTF-8 dengan BOM agar terbaca sempurna di Microsoft Excel, Google Sheets, dan LibreOffice
 */
export function exportToCsvFile(
  pkg: QuestionPackage,
  schoolProfile: SchoolProfile | null,
  options: ExportOptions
): Blob {
  const questions = normalizeQuestionNumbering(pkg.questions || []);

  // Helper untuk escape cell CSV sesuai RFC 4180
  const escapeCsv = (val: any): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val);
    if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return `"${str}"`;
  };

  const rows: string[] = [];

  // Metadata header baris pertama
  rows.push([
    escapeCsv('No Soal'),
    escapeCsv('Bentuk Soal'),
    escapeCsv('Level Kognitif'),
    escapeCsv('Teks Pertanyaan'),
    escapeCsv('Stimulus Gambar'),
    escapeCsv('Opsi A'),
    escapeCsv('Opsi B'),
    escapeCsv('Opsi C'),
    escapeCsv('Opsi D'),
    ...(options.includeAnswers
      ? [escapeCsv('Kunci Jawaban'), escapeCsv('Pembahasan Guru'), escapeCsv('Indikator')]
      : []),
    escapeCsv('Bobot Skor'),
  ].join(','));

  questions.forEach((q) => {
    const optA = q.options?.find((o) => o.key === 'A')?.text || '';
    const optB = q.options?.find((o) => o.key === 'B')?.text || '';
    const optC = q.options?.find((o) => o.key === 'C')?.text || '';
    const optD = q.options?.find((o) => o.key === 'D')?.text || '';

    const bentukSoal =
      q.type === 'multiple_choice'
        ? 'Pilihan Ganda'
        : q.type === 'complex_multiple_choice'
        ? 'PG Kompleks'
        : q.type === 'short_answer'
        ? 'Isian Singkat'
        : 'Uraian';

    const imageInfo = q.imageUrl
      ? q.imageCaption || q.imageAlt || 'Ada Gambar Stimulus'
      : q.imageAlt
      ? `Saran: ${q.imageAlt}`
      : 'Tanpa Gambar';

    const rowData: string[] = [
      escapeCsv(q.number),
      escapeCsv(bentukSoal),
      escapeCsv(q.cognitiveLevel || 'L1'),
      escapeCsv(q.questionText),
      escapeCsv(imageInfo),
      escapeCsv(optA),
      escapeCsv(optB),
      escapeCsv(optC),
      escapeCsv(optD),
    ];

    if (options.includeAnswers) {
      rowData.push(
        escapeCsv(q.answerKey || '-'),
        escapeCsv(q.explanation || '-'),
        escapeCsv(q.indicator || '-')
      );
    }

    rowData.push(escapeCsv(q.score || 1));
    rows.push(rowData.join(','));
  });

  // UTF-8 BOM (\uFEFF) untuk kompatibilitas penuh Excel dalam membuka karakter Bahasa Indonesia / Arab
  const csvContent = '\uFEFF' + rows.join('\r\n');
  return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
}

/**
 * Helper fungsi untuk mengunduh paket berkas Word dengan pilihan fleksibel:
 * - 'full': Paket Lengkap (Soal Siswa + Kunci Jawaban & Rubrik Penskoran)
 * - 'questions_only': Naskah Soal Siswa Saja (Bersih untuk ujian)
 * - 'answers_only': Kunci Jawaban & Pedoman Penskoran Saja
 */
export async function downloadWordBundle(
  pkg: QuestionPackage,
  schoolProfile: SchoolProfile | null,
  mode: 'full' | 'questions_only' | 'answers_only' = 'full'
) {
  const activeProfile = schoolProfile || getSchoolProfile();
  const cleanTitle = (pkg.title || 'Paket_Soal').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);

  if (mode === 'answers_only') {
    const blob = await exportKunciJawabanToWordDocument(pkg, activeProfile, { showExplanations: true });
    triggerBrowserDownload(blob, `Kunci_Jawaban_dan_Rubrik_${cleanTitle}.docx`);
    return;
  }

  const includeAnswers = mode === 'full';
  const blob = await exportToWordDocument(pkg, activeProfile, { includeAnswers });
  const prefix = includeAnswers ? 'Paket_Lengkap_Soal_dan_Kunci' : 'Naskah_Soal_Siswa';
  triggerBrowserDownload(blob, `${prefix}_${cleanTitle}.docx`);
}

/**
 * Helper fungsi untuk mengunduh berkas Word
 */
export async function downloadWordPackage(
  pkg: QuestionPackage,
  schoolProfile: SchoolProfile | null,
  options: ExportOptions
) {
  const activeProfile = schoolProfile || getSchoolProfile();
  const blob = await exportToWordDocument(pkg, activeProfile, options);
  const prefix = options.includeAnswers ? 'Paket_Lengkap_Soal_dan_Kunci' : 'Naskah_Soal_Siswa';
  const cleanTitle = (pkg.title || 'Paket_Soal').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  triggerBrowserDownload(blob, `${prefix}_${cleanTitle}.docx`);
}

/**
 * Helper fungsi untuk mengunduh berkas Excel
 */
export function downloadExcelPackage(
  pkg: QuestionPackage,
  schoolProfile: SchoolProfile | null,
  options: ExportOptions
) {
  const blob = exportToExcelWorkbook(pkg, schoolProfile, options);
  const prefix = options.includeAnswers ? 'Kisi_Kisi_Guru' : 'Kisi_Kisi_Siswa';
  const cleanTitle = pkg.title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  triggerBrowserDownload(blob, `${prefix}_${cleanTitle}.xlsx`);
}

/**
 * Helper fungsi untuk mengunduh berkas CSV
 */
export function downloadCsvPackage(
  pkg: QuestionPackage,
  schoolProfile: SchoolProfile | null,
  options: ExportOptions
) {
  const blob = exportToCsvFile(pkg, schoolProfile, options);
  const prefix = options.includeAnswers ? 'Daftar_Soal_Guru' : 'Daftar_Soal_Siswa';
  const cleanTitle = pkg.title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  triggerBrowserDownload(blob, `${prefix}_${cleanTitle}.csv`);
}

/**
 * Ekspor Dokumen Resmi PDF (Portable Document Format) Siap Cetak A4
 * Didesain khusus standar asesmen Madrasah Ibtidaiyah Kementerian Agama RI
 */
export async function exportToPdfDocument(
  pkg: QuestionPackage,
  schoolProfile: SchoolProfile | null,
  options: ExportOptions
): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 18;
  const contentWidth = pageWidth - margin * 2; // 174mm
  const bottomThreshold = pageHeight - margin - 10; // ~269mm
  let y = margin;

  const schoolName = pkg.schoolName || schoolProfile?.schoolName || 'MADRASAH IBTIDAIYAH';
  const address = schoolProfile?.address
    ? `${schoolProfile.address}${schoolProfile.village ? ', ' + schoolProfile.village : ''}${schoolProfile.city ? ', ' + schoolProfile.city : ''}`
    : 'Kementerian Agama Republik Indonesia';

  const checkPageBreak = (neededSpace: number) => {
    if (y + neededSpace > bottomThreshold) {
      doc.addPage();
      y = margin;
    }
  };

  // 1. KOP MADRASAH
  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.text('KEMENTERIAN AGAMA REPUBLIK INDONESIA', pageWidth / 2, y, { align: 'center' });
  y += 5.5;

  doc.setFontSize(13);
  doc.text(schoolName.toUpperCase(), pageWidth / 2, y, { align: 'center' });
  y += 5;

  if (schoolProfile?.npsnOrNsm) {
    doc.setFont('times', 'normal');
    doc.setFontSize(8.5);
    doc.text(`NSM / NPSN: ${schoolProfile.npsnOrNsm}`, pageWidth / 2, y, { align: 'center' });
    y += 4;
  }

  doc.setFont('times', 'italic');
  doc.setFontSize(8.5);
  doc.text(address, pageWidth / 2, y, { align: 'center' });
  y += 4;

  // Garis Pembatas Kop Ganda Standar Kemenag
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageWidth - margin, y);
  doc.setLineWidth(0.25);
  doc.line(margin, y + 1.2, pageWidth - margin, y + 1.2);
  y += 6;

  // 2. JUDUL NASKAH
  doc.setFont('times', 'bold');
  doc.setFontSize(12);
  doc.text(`NASKAH SOAL ${pkg.assessmentType.toUpperCase()}`, pageWidth / 2, y, { align: 'center' });
  y += 5;

  doc.setFontSize(10);
  doc.text(`TAHUN PELAJARAN ${pkg.academicYear} — SEMESTER ${pkg.semester.toUpperCase()}`, pageWidth / 2, y, { align: 'center' });
  y += 5;

  if (options.includeAnswers) {
    doc.setFont('times', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(0, 102, 68);
    doc.text('[DOKUMEN KHUSUS GURU — KUNCI JAWABAN & PEMBAHASAN]', pageWidth / 2, y, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    y += 4.5;
  }

  // 3. TABEL IDENTITAS ASESMEN (Bingkai rapi 2 kolom)
  checkPageBreak(25);
  const tableX = margin;
  const tableY = y;
  const tableW = contentWidth;
  const tableH = 22;
  const colMid = tableX + tableW / 2;

  doc.setLineWidth(0.3);
  doc.setDrawColor(80, 80, 80);
  doc.rect(tableX, tableY, tableW, tableH);
  doc.line(colMid, tableY, colMid, tableY + tableH);

  doc.setFont('times', 'normal');
  doc.setFontSize(8.5);
  const leftX = tableX + 3;
  const rightX = colMid + 3;
  let rowY = tableY + 5;

  doc.setFont('times', 'bold');
  doc.text('Mata Pelajaran', leftX, rowY);
  doc.setFont('times', 'normal');
  doc.text(`: ${pkg.subject}`, leftX + 26, rowY);

  doc.setFont('times', 'bold');
  doc.text('Nama Siswa', rightX, rowY);
  doc.setFont('times', 'normal');
  doc.text(': ...................................................', rightX + 26, rowY);

  rowY += 5.5;
  doc.setFont('times', 'bold');
  doc.text('Kelas / Fase', leftX, rowY);
  doc.setFont('times', 'normal');
  doc.text(`: Kelas ${pkg.grade} (${pkg.phase})`, leftX + 26, rowY);

  doc.setFont('times', 'bold');
  doc.text('Nomor Absen', rightX, rowY);
  doc.setFont('times', 'normal');
  doc.text(': ...................................................', rightX + 26, rowY);

  rowY += 5.5;
  doc.setFont('times', 'bold');
  doc.text('Alokasi Waktu', leftX, rowY);
  doc.setFont('times', 'normal');
  doc.text(`: ${pkg.durationMinutes} Menit`, leftX + 26, rowY);

  doc.setFont('times', 'bold');
  doc.text('Hari / Tanggal', rightX, rowY);
  doc.setFont('times', 'normal');
  doc.text(': ...................................................', rightX + 26, rowY);

  y = tableY + tableH + 4.5;

  // 4. PETUNJUK UMUM
  checkPageBreak(24);
  doc.setFont('times', 'bold');
  doc.setFontSize(9);
  doc.text('PETUNJUK UMUM:', margin, y);
  y += 4;

  doc.setFont('times', 'normal');
  doc.setFontSize(8.5);
  const instructions = [
    '1. Berdoalah sebelum mulai mengerjakan butir soal asesmen.',
    '2. Tulislah nama lengkap dan nomor peserta pada lembar jawaban yang telah disediakan.',
    '3. Bacalah setiap butir soal dengan teliti dan cermat sebelum menentukan jawaban.',
    '4. Dahulukan mengerjakan soal-soal yang Anda anggap lebih mudah.',
    '5. Periksa kembali seluruh jawaban Anda sebelum diserahkan kepada pengawas ujian.',
  ];
  instructions.forEach((inst) => {
    doc.text(inst, margin + 2, y);
    y += 4;
  });
  y += 2;

  // 5. BUTIR SOAL
  const questions = normalizeQuestionNumbering(pkg.questions || []);
  if (questions.length === 0) {
    checkPageBreak(15);
    doc.setFont('times', 'italic');
    doc.setFontSize(9.5);
    doc.setTextColor(100, 100, 100);
    doc.text('[Belum ada butir soal yang digenerate pada paket asesmen ini]', pageWidth / 2, y + 8, { align: 'center' });
    y += 18;
    doc.setTextColor(0, 0, 0);
  } else {
    let sectionIdx = 1;
    const toRoman = (n: number) => ['I', 'II', 'III', 'IV'][n - 1] || `${n}`;

    // Helper render gambar soal di PDF
    const renderPdfQuestionImage = (q: QuestionItem) => {
      if (!q.imageUrl) return;
      try {
        const imageType = q.imageUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
        const imgWidth = 75;
        const imgHeight = 45;
        checkPageBreak(imgHeight + 8);
        const imgX = (pageWidth - imgWidth) / 2;
        doc.addImage(q.imageUrl, imageType, imgX, y, imgWidth, imgHeight);
        y += imgHeight + 2;
        if (q.imageCaption) {
          doc.setFont('times', 'italic');
          doc.setFontSize(8);
          doc.setTextColor(80, 80, 80);
          doc.text(q.imageCaption, pageWidth / 2, y, { align: 'center' });
          y += 4;
          doc.setTextColor(0, 0, 0);
        }
      } catch (e) {
        console.warn('Gagal menambahkan gambar pada PDF:', e);
      }
    };

    // A. PILIHAN GANDA BIASA
    const mcQuestions = questions.filter((q) => q.type === 'multiple_choice');
    if (mcQuestions.length > 0) {
      checkPageBreak(14);
      doc.setFont('times', 'bold');
      doc.setFontSize(10);
      doc.text(`${toRoman(sectionIdx++)}. PILIHAN GANDA`, margin, y);
      y += 4.5;

      doc.setFont('times', 'italic');
      doc.setFontSize(8.5);
      const mcGuide = pkg.mcOptionCount === 3
        ? 'Berilah tanda silang (X) pada huruf A, B, atau C di depan jawaban yang paling tepat!'
        : 'Berilah tanda silang (X) pada huruf A, B, C, atau D di depan jawaban yang paling tepat!';
      doc.text(mcGuide, margin, y);
      y += 5.5;

      mcQuestions.forEach((q) => {
        const isImageAbove =
          q.imagePosition === 'above_question' ||
          (!q.imagePosition && pkg.defaultImagePosition === 'above_question');

        if (isImageAbove) {
          renderPdfQuestionImage(q);
        }

        checkPageBreak(18);
        doc.setFont('times', 'bold');
        doc.setFontSize(9);
        doc.text(`${q.number}.`, margin, y);

        doc.setFont('times', 'normal');
        const qLines = doc.splitTextToSize(q.questionText, contentWidth - 8);
        doc.text(qLines, margin + 7, y);
        y += qLines.length * 4.2;

        if (!isImageAbove) {
          renderPdfQuestionImage(q);
        }

        if (q.options && q.options.length > 0) {
          q.options.forEach((opt) => {
            checkPageBreak(5);
            doc.setFont('times', 'bold');
            doc.text(`${opt.key}.`, margin + 8, y);
            doc.setFont('times', 'normal');
            const optLines = doc.splitTextToSize(opt.text, contentWidth - 18);
            doc.text(optLines, margin + 14, y);
            y += optLines.length * 4;
          });
        }

        if (options.includeAnswers) {
          checkPageBreak(10);
          y += 1;
          doc.setFont('times', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(0, 102, 68);
          doc.text(`[Kunci: ${q.answerKey} | Skor: ${q.score || 1} | Level: ${q.cognitiveLevel || 'L1'}]`, margin + 8, y);
          doc.setTextColor(0, 0, 0);
          y += 3.5;
        }

        y += 2.5;
      });
    }

    // B. PILIHAN GANDA KOMPLEKS
    const cmcQuestions = questions.filter((q) => q.type === 'complex_multiple_choice');
    if (cmcQuestions.length > 0) {
      checkPageBreak(14);
      doc.setFont('times', 'bold');
      doc.setFontSize(10);
      doc.text(`${toRoman(sectionIdx++)}. PILIHAN GANDA KOMPLEKS`, margin, y);
      y += 4.5;

      doc.setFont('times', 'italic');
      doc.setFontSize(8.5);
      doc.text('Berilah tanda centang (√) atau silang (X) pada lebih dari satu jawaban yang benar (2 atau 3 jawaban benar)!', margin, y);
      y += 5.5;

      cmcQuestions.forEach((q) => {
        const isImageAbove =
          q.imagePosition === 'above_question' ||
          (!q.imagePosition && pkg.defaultImagePosition === 'above_question');

        if (isImageAbove) {
          renderPdfQuestionImage(q);
        }

        checkPageBreak(18);
        doc.setFont('times', 'bold');
        doc.setFontSize(9);
        doc.text(`${q.number}.`, margin, y);

        doc.setFont('times', 'normal');
        const qLines = doc.splitTextToSize(q.questionText, contentWidth - 8);
        doc.text(qLines, margin + 7, y);
        y += qLines.length * 4.2;

        if (!isImageAbove) {
          renderPdfQuestionImage(q);
        }

        if (q.options && q.options.length > 0) {
          const answerKeys = (q.answerKey || '')
            .split(',')
            .map((k) => k.trim().toUpperCase())
            .filter(Boolean);

          q.options.forEach((opt) => {
            checkPageBreak(5.5);
            doc.setDrawColor(100, 100, 100);
            doc.setLineWidth(0.2);
            doc.rect(margin + 8, y - 2.8, 3.2, 3.2);

            if (options.includeAnswers && answerKeys.includes(opt.key.toUpperCase())) {
              doc.setFont('times', 'bold');
              doc.setFontSize(8);
              doc.setTextColor(0, 102, 68);
              doc.text('v', margin + 8.8, y - 0.5);
              doc.setTextColor(0, 0, 0);
            }

            doc.setFont('times', 'bold');
            doc.setFontSize(9);
            doc.text(`${opt.key}.`, margin + 14, y);
            doc.setFont('times', 'normal');
            const optLines = doc.splitTextToSize(opt.text, contentWidth - 24);
            doc.text(optLines, margin + 20, y);
            y += optLines.length * 4;
          });
        }

        if (options.includeAnswers) {
          checkPageBreak(10);
          y += 1;
          doc.setFont('times', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(60, 40, 140);
          doc.text(`[Kunci: ${q.answerKey} | Skor: ${q.score || 2} | Level: ${q.cognitiveLevel || 'L2'}]`, margin + 8, y);
          doc.setTextColor(0, 0, 0);
          y += 3.5;
        }

        y += 2.5;
      });
    }

    // C. ISIAN SINGKAT
    const saQuestions = questions.filter((q) => q.type === 'short_answer');
    if (saQuestions.length > 0) {
      checkPageBreak(14);
      doc.setFont('times', 'bold');
      doc.setFontSize(10);
      doc.text(`${toRoman(sectionIdx++)}. ISIAN SINGKAT`, margin, y);
      y += 4.5;

      doc.setFont('times', 'italic');
      doc.setFontSize(8.5);
      doc.text('Isilah titik-titik di bawah ini dengan jawaban yang tepat dan benar!', margin, y);
      y += 5.5;

      saQuestions.forEach((q) => {
        const isImageAbove =
          q.imagePosition === 'above_question' ||
          (!q.imagePosition && pkg.defaultImagePosition === 'above_question');

        if (isImageAbove) {
          renderPdfQuestionImage(q);
        }

        checkPageBreak(16);
        doc.setFont('times', 'bold');
        doc.setFontSize(9);
        doc.text(`${q.number}.`, margin, y);

        doc.setFont('times', 'normal');
        const qLines = doc.splitTextToSize(q.questionText, contentWidth - 8);
        doc.text(qLines, margin + 7, y);
        y += qLines.length * 4.2;

        if (!isImageAbove) {
          renderPdfQuestionImage(q);
        }

        if (options.includeAnswers) {
          checkPageBreak(10);
          y += 1;
          doc.setFont('times', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(0, 102, 68);
          doc.text(`[Kunci: ${q.answerKey} | Skor: ${q.score || 2}]`, margin + 8, y);
          doc.setTextColor(0, 0, 0);
          y += 3.5;
        }

        y += 2.5;
      });
    }

    // D. URAIAN / ESSAY
    const essayQuestions = questions.filter((q) => q.type === 'essay');
    if (essayQuestions.length > 0) {
      checkPageBreak(14);
      doc.setFont('times', 'bold');
      doc.setFontSize(10);
      doc.text(`${toRoman(sectionIdx++)}. URAIAN / ESSAY`, margin, y);
      y += 4.5;

      doc.setFont('times', 'italic');
      doc.setFontSize(8.5);
      doc.text('Jawablah pertanyaan-pertanyaan berikut dengan penjelasan yang lengkap dan jelas!', margin, y);
      y += 5.5;

      essayQuestions.forEach((q) => {
        const isImageAbove =
          q.imagePosition === 'above_question' ||
          (!q.imagePosition && pkg.defaultImagePosition === 'above_question');

        if (isImageAbove) {
          renderPdfQuestionImage(q);
        }

        checkPageBreak(16);
        doc.setFont('times', 'bold');
        doc.setFontSize(9);
        doc.text(`${q.number}.`, margin, y);

        doc.setFont('times', 'normal');
        const qLines = doc.splitTextToSize(q.questionText, contentWidth - 8);
        doc.text(qLines, margin + 7, y);
        y += qLines.length * 4.2;

        if (!isImageAbove) {
          renderPdfQuestionImage(q);
        }

        if (options.includeAnswers) {
          checkPageBreak(10);
          y += 1;
          doc.setFont('times', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(120, 20, 60);
          doc.text(`[Acuan Kunci: ${q.answerKey} | Skor Maks: ${q.score || 4}]`, margin + 8, y);
          doc.setTextColor(0, 0, 0);
          y += 3.5;
        }

        y += 2.5;
      });
    }
  }

  // 6. HALAMAN KHUSUS KUNCI JAWABAN & RUBRIK (Paket Guru)
  if (options.includeAnswers && questions.length > 0) {
    doc.addPage();
    y = margin;

    doc.setFont('times', 'bold');
    doc.setFontSize(12);
    doc.text('KUNCI JAWABAN, PEMBAHASAN, DAN RUBRIK PENSKORAN', pageWidth / 2, y, { align: 'center' });
    y += 5;

    doc.setFontSize(9);
    doc.setFont('times', 'italic');
    doc.text(`[DOKUMEN KHUSUS GURU] ${pkg.title}`, pageWidth / 2, y, { align: 'center' });
    y += 6;

    doc.setLineWidth(0.4);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    questions.forEach((q) => {
      checkPageBreak(25);
      const qTypeName = q.type === 'multiple_choice'
        ? 'PG'
        : q.type === 'complex_multiple_choice'
        ? 'PG Kompleks'
        : q.type === 'short_answer'
        ? 'Isian'
        : 'Uraian';

      doc.setFont('times', 'bold');
      doc.setFontSize(9);
      doc.text(`Nomor ${q.number} (${qTypeName}) — Kunci: ${q.answerKey || '-'}`, margin, y);
      doc.setFont('times', 'normal');
      doc.text(`[Skor: ${q.score || 1} | Level: ${q.cognitiveLevel || 'L1'}]`, margin + 90, y);
      y += 4;

      if (q.indicator) {
        doc.setFont('times', 'bold');
        doc.setFontSize(8);
        doc.text('Indikator: ', margin + 4, y);
        doc.setFont('times', 'normal');
        const indLines = doc.splitTextToSize(q.indicator, contentWidth - 22);
        doc.text(indLines, margin + 20, y);
        y += indLines.length * 3.8;
      }

      if (q.explanation) {
        doc.setFont('times', 'bold');
        doc.setFontSize(8);
        doc.text('Pembahasan: ', margin + 4, y);
        doc.setFont('times', 'normal');
        const expLines = doc.splitTextToSize(q.explanation, contentWidth - 24);
        doc.text(expLines, margin + 22, y);
        y += expLines.length * 3.8;
      }

      if (q.rubric && q.rubric.length > 0) {
        doc.setFont('times', 'bold');
        doc.setFontSize(8);
        doc.text('Rubrik Skor:', margin + 4, y);
        y += 3.8;
        q.rubric.forEach((r) => {
          checkPageBreak(5);
          doc.setFont('times', 'normal');
          doc.text(`• ${r.criteria} (Skor: ${r.score})`, margin + 8, y);
          y += 3.5;
        });
      }

      y += 2.5;
    });
  }

  // 8. NOMOR HALAMAN DAN FOOTER RESMI DI SEMUA HALAMAN
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('times', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `${schoolName} — ${pkg.subject} Kelas ${pkg.grade} | Halaman ${i} dari ${totalPages}`,
      margin,
      pageHeight - 10
    );
    doc.text('MADRASAH SMART SOAL', pageWidth - margin, pageHeight - 10, { align: 'right' });
  }

  return doc.output('blob');
}

/**
 * Helper fungsi untuk mengunduh berkas PDF
 */
export async function downloadPdfPackage(
  pkg: QuestionPackage,
  schoolProfile: SchoolProfile | null,
  options: ExportOptions
) {
  const blob = await exportToPdfDocument(pkg, schoolProfile, options);
  const prefix = options.includeAnswers ? 'Paket_Guru' : 'Naskah_Siswa';
  const cleanTitle = pkg.title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  triggerBrowserDownload(blob, `${prefix}_${cleanTitle}.pdf`);
}

/**
 * Ekspor Dokumen Matriks Kisi-Kisi ke Microsoft Word (.docx) Asli
 * Format tabel landscape resmi standar Kemenag lengkap dengan tanda tangan di bagian akhir
 */
export async function exportKisiKisiToWordDocument(
  pkg: QuestionPackage,
  schoolProfile: SchoolProfile | null,
  options: ExportOptions = { includeAnswers: true }
): Promise<Blob> {
  const activeProfile = schoolProfile || getSchoolProfile();
  const schoolName = pkg.schoolName || activeProfile?.schoolName || 'MADRASAH IBTIDAIYAH';
  const questions = normalizeQuestionNumbering(pkg.questions || []);
  const docChildren: any[] = [];

  // 1. KOP MADRASAH
  docChildren.push(...createMadrasahKopElements(activeProfile, schoolName));

  // 2. JUDUL KISI-KISI
  docChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: 'KISI-KISI PENULISAN SOAL ASESMEN MADRASAH',
          font: 'Times New Roman',
          size: 22,
          bold: true,
          underline: {},
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: `${pkg.assessmentType.toUpperCase()} — TAHUN PELAJARAN ${pkg.academicYear} (SEMESTER ${pkg.semester.toUpperCase()})`,
          font: 'Times New Roman',
          size: 18,
          bold: true,
        }),
      ],
    })
  );

  // 3. TABEL IDENTITAS KISI-KISI
  const identityTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: 'Satuan Pendidikan\t: ', bold: true, size: 18 }),
                  new TextRun({ text: schoolName, size: 18 }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: 'Mata Pelajaran\t: ', bold: true, size: 18 }),
                  new TextRun({ text: pkg.subject, size: 18 }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: 'Kelas / Fase\t: ', bold: true, size: 18 }),
                  new TextRun({ text: `Kelas ${pkg.grade} (${pkg.phase})`, size: 18 }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: 'Alokasi Waktu\t: ', bold: true, size: 18 }),
                  new TextRun({ text: `${pkg.durationMinutes} Menit`, size: 18 }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: 'Jumlah Soal\t: ', bold: true, size: 18 }),
                  new TextRun({ text: `${questions.length} Butir`, size: 18 }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: 'Penyusun\t: ', bold: true, size: 18 }),
                  new TextRun({ text: pkg.teacherName, size: 18 }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
  docChildren.push(identityTable);

  docChildren.push(
    new Paragraph({
      spacing: { before: 140, after: 60 },
      children: [],
    })
  );

  // 4. TABEL MATRIKS KISI-KISI
  const tableHeaderCells = [
    new TableCell({ width: { size: 6, type: WidthType.PERCENTAGE }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'No', bold: true, size: 18 })] })] }),
    new TableCell({ width: { size: 18, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: 'Materi Pokok', bold: true, size: 18 })] })] }),
    new TableCell({ width: { size: 36, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: 'Indikator Soal', bold: true, size: 18 })] })] }),
    new TableCell({ width: { size: 12, type: WidthType.PERCENTAGE }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Bentuk', bold: true, size: 18 })] })] }),
    new TableCell({ width: { size: 16, type: WidthType.PERCENTAGE }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Level Kognitif', bold: true, size: 18 })] })] }),
    new TableCell({ width: { size: 6, type: WidthType.PERCENTAGE }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Kunci', bold: true, size: 18 })] })] }),
    new TableCell({ width: { size: 6, type: WidthType.PERCENTAGE }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Skor', bold: true, size: 18 })] })] }),
  ];

  const tableRows = [
    new TableRow({
      tableHeader: true,
      children: tableHeaderCells,
    }),
  ];

  questions.forEach((q) => {
    const itemTopic = q.topic || pkg.topic;
    const typeLabel =
      q.type === 'multiple_choice'
        ? 'PG'
        : q.type === 'complex_multiple_choice'
        ? 'PG-K'
        : q.type === 'short_answer'
        ? 'Isian'
        : 'Uraian';

    tableRows.push(
      new TableRow({
        children: [
          new TableCell({
            width: { size: 6, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${q.number}`, size: 17, bold: true })] })],
          }),
          new TableCell({
            width: { size: 18, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: [new TextRun({ text: itemTopic, size: 17 })] })],
          }),
          new TableCell({
            width: { size: 36, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: [new TextRun({ text: q.indicator || `Menjawab soal materi ${itemTopic}`, size: 17 })] })],
          }),
          new TableCell({
            width: { size: 12, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: typeLabel, size: 17 })] })],
          }),
          new TableCell({
            width: { size: 16, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: q.cognitiveLevel || 'L1', size: 17 })] })],
          }),
          new TableCell({
            width: { size: 6, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: q.answerKey || '-', size: 17, bold: true })] })],
          }),
          new TableCell({
            width: { size: 6, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${q.score || 1}`, size: 17 })] })],
          }),
        ],
      })
    );
  });

  const matrixTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: tableRows,
  });
  docChildren.push(matrixTable);

  // 5. BAGIAN PENANDATANGAN DOKUMEN KISI-KISI
  docChildren.push(
    ...createSignatureBlock(activeProfile, {
      teacherName: pkg.teacherName,
      teacherRoleTitle: 'Guru Mata Pelajaran',
    })
  );

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: 'landscape' as any,
            },
            margin: {
              top: 1000,
              bottom: 1000,
              left: 1000,
              right: 1000,
            },
          },
        },
        children: docChildren,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  return blob;
}

/**
 * Ekspor Dokumen Matriks Kisi-Kisi ke PDF Asli
 * Format landscape resmi standar Kemenag dengan tanda tangan Kepala Madrasah dan Guru di bagian akhir
 */
export async function exportKisiKisiToPdfDocument(
  pkg: QuestionPackage,
  schoolProfile: SchoolProfile | null,
  options: ExportOptions = { includeAnswers: true }
): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  const schoolName = pkg.schoolName || schoolProfile?.schoolName || 'MADRASAH IBTIDAIYAH';
  const address = schoolProfile?.address
    ? `${schoolProfile.address}${schoolProfile.village ? ', ' + schoolProfile.village : ''}${schoolProfile.city ? ', ' + schoolProfile.city : ''}`
    : 'Kementerian Agama Republik Indonesia';

  let y = margin;

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - margin - 8) {
      doc.addPage();
      y = margin;
      renderKisiKop();
    }
  };

  const renderKisiKop = () => {
    doc.setFont('times', 'bold');
    doc.setFontSize(11);
    doc.text('KEMENTERIAN AGAMA REPUBLIK INDONESIA', pageWidth / 2, y, { align: 'center' });
    y += 5;

    doc.setFontSize(13);
    doc.text(schoolName.toUpperCase(), pageWidth / 2, y, { align: 'center' });
    y += 4.5;

    if (schoolProfile?.npsnOrNsm) {
      doc.setFont('times', 'normal');
      doc.setFontSize(8.5);
      doc.text(`NSM / NPSN: ${schoolProfile.npsnOrNsm}`, pageWidth / 2, y, { align: 'center' });
      y += 4;
    }

    doc.setFont('times', 'italic');
    doc.setFontSize(8);
    doc.text(address, pageWidth / 2, y, { align: 'center' });
    y += 3.5;

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.7);
    doc.line(margin, y, pageWidth - margin, y);
    doc.setLineWidth(0.2);
    doc.line(margin, y + 1, pageWidth - margin, y + 1);
    y += 5;
  };

  // 1. Render Kop Awal
  renderKisiKop();

  // 2. Judul
  doc.setFont('times', 'bold');
  doc.setFontSize(11.5);
  doc.text('KISI-KISI PENULISAN SOAL ASESMEN MADRASAH', pageWidth / 2, y, { align: 'center' });
  y += 4.5;

  doc.setFontSize(9.5);
  doc.text(`${pkg.assessmentType.toUpperCase()} — TAHUN PELAJARAN ${pkg.academicYear} (SEMESTER ${pkg.semester.toUpperCase()})`, pageWidth / 2, y, { align: 'center' });
  y += 5.5;

  // 3. Identitas Singkat
  const idColWidth = contentWidth / 2;
  doc.setFont('times', 'bold');
  doc.setFontSize(8.5);
  doc.text('Mata Pelajaran', margin, y);
  doc.setFont('times', 'normal');
  doc.text(`: ${pkg.subject}`, margin + 26, y);

  doc.setFont('times', 'bold');
  doc.text('Alokasi Waktu', margin + idColWidth, y);
  doc.setFont('times', 'normal');
  doc.text(`: ${pkg.durationMinutes} Menit`, margin + idColWidth + 26, y);
  y += 4.5;

  doc.setFont('times', 'bold');
  doc.text('Kelas / Fase', margin, y);
  doc.setFont('times', 'normal');
  doc.text(`: Kelas ${pkg.grade} (${pkg.phase})`, margin + 26, y);

  const questions = normalizeQuestionNumbering(pkg.questions || []);
  doc.setFont('times', 'bold');
  doc.text('Jumlah Soal', margin + idColWidth, y);
  doc.setFont('times', 'normal');
  doc.text(`: ${questions.length} Butir`, margin + idColWidth + 26, y);
  y += 6;

  // 4. Tabel Kisi-kisi Matriks
  const colWidths = {
    no: 10,
    materi: 50,
    indikator: 110,
    bentuk: 28,
    level: 38,
    kunci: 16,
    skor: 17,
  };

  const renderTableHeader = () => {
    doc.setFillColor(240, 243, 246);
    doc.rect(margin, y, contentWidth, 7, 'F');
    doc.setDrawColor(120, 120, 120);
    doc.setLineWidth(0.25);
    doc.rect(margin, y, contentWidth, 7, 'D');

    let curX = margin;
    doc.setFont('times', 'bold');
    doc.setFontSize(8.5);

    doc.text('No', curX + colWidths.no / 2, y + 4.8, { align: 'center' });
    curX += colWidths.no;
    doc.line(curX, y, curX, y + 7);

    doc.text('Materi Pokok', curX + 2, y + 4.8);
    curX += colWidths.materi;
    doc.line(curX, y, curX, y + 7);

    doc.text('Indikator Butir Soal', curX + 2, y + 4.8);
    curX += colWidths.indikator;
    doc.line(curX, y, curX, y + 7);

    doc.text('Bentuk Soal', curX + colWidths.bentuk / 2, y + 4.8, { align: 'center' });
    curX += colWidths.bentuk;
    doc.line(curX, y, curX, y + 7);

    doc.text('Level Kognitif', curX + colWidths.level / 2, y + 4.8, { align: 'center' });
    curX += colWidths.level;
    doc.line(curX, y, curX, y + 7);

    doc.text('Kunci', curX + colWidths.kunci / 2, y + 4.8, { align: 'center' });
    curX += colWidths.kunci;
    doc.line(curX, y, curX, y + 7);

    doc.text('Skor', curX + colWidths.skor / 2, y + 4.8, { align: 'center' });
    y += 7;
  };

  renderTableHeader();

  questions.forEach((q) => {
    const itemTopic = q.topic || pkg.topic;
    const indicatorText = q.indicator || `Menjawab soal materi ${itemTopic}`;
    const indicatorLines = doc.splitTextToSize(indicatorText, colWidths.indikator - 4);
    const rowHeight = Math.max(6.5, indicatorLines.length * 3.8 + 2.5);

    checkPageBreak(rowHeight + 2);

    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.2);
    doc.rect(margin, y, contentWidth, rowHeight);

    let curX = margin;
    // No
    doc.setFont('times', 'bold');
    doc.setFontSize(8.5);
    doc.text(`${q.number}`, curX + colWidths.no / 2, y + 4.5, { align: 'center' });
    curX += colWidths.no;
    doc.line(curX, y, curX, y + rowHeight);

    // Materi
    doc.setFont('times', 'normal');
    doc.setFontSize(8);
    const topicLines = doc.splitTextToSize(itemTopic, colWidths.materi - 4);
    doc.text(topicLines, curX + 2, y + 4);
    curX += colWidths.materi;
    doc.line(curX, y, curX, y + rowHeight);

    // Indikator
    doc.text(indicatorLines, curX + 2, y + 4);
    curX += colWidths.indikator;
    doc.line(curX, y, curX, y + rowHeight);

    // Bentuk Soal
    const typeLabel =
      q.type === 'multiple_choice'
        ? 'PG'
        : q.type === 'complex_multiple_choice'
        ? 'PG Kompleks'
        : q.type === 'short_answer'
        ? 'Isian'
        : 'Uraian';
    doc.text(typeLabel, curX + colWidths.bentuk / 2, y + 4.5, { align: 'center' });
    curX += colWidths.bentuk;
    doc.line(curX, y, curX, y + rowHeight);

    // Level
    doc.text(q.cognitiveLevel || 'L1', curX + colWidths.level / 2, y + 4.5, { align: 'center' });
    curX += colWidths.level;
    doc.line(curX, y, curX, y + rowHeight);

    // Kunci
    doc.setFont('times', 'bold');
    doc.text(q.answerKey || '-', curX + colWidths.kunci / 2, y + 4.5, { align: 'center' });
    curX += colWidths.kunci;
    doc.line(curX, y, curX, y + rowHeight);

    // Skor
    doc.setFont('times', 'normal');
    doc.text(`${q.score || 1}`, curX + colWidths.skor / 2, y + 4.5, { align: 'center' });

    y += rowHeight;
  });

  // 5. TANDA TANGAN DI BAGIAN AKHIR DOKUMEN KISI-KISI
  checkPageBreak(38);
  y += 7;
  doc.setFont('times', 'normal');
  doc.setFontSize(8.5);

  const signDate = `${schoolProfile?.city ? schoolProfile.city + ', ' : ''}${formatIndonesianDate(pkg.createdAt)}`;
  const leftSignX = margin + 20;
  const rightSignX = margin + contentWidth / 2 + 20;

  doc.text('Mengetahui,', leftSignX, y);
  doc.text(signDate, rightSignX, y);
  y += 4.5;
  doc.text(`Kepala ${schoolName}`, leftSignX, y);
  doc.text('Guru Mata Pelajaran', rightSignX, y);

  y += 18; // Ruang tanda tangan
  doc.setFont('times', 'bold');
  const principalName = schoolProfile?.principalName || '...........................................';
  doc.text(principalName, leftSignX, y);
  doc.text(pkg.teacherName, rightSignX, y);

  y += 4;
  doc.setFont('times', 'normal');
  doc.text(`NIP. ${schoolProfile?.principalNip || '...................................'}`, leftSignX, y);
  doc.text(`NIP. ${schoolProfile?.teacherNip || '...................................'}`, rightSignX, y);

  // 6. Header/Footer Pagination
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('times', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `Matriks Kisi-kisi Asesmen ${pkg.subject} Kelas ${pkg.grade} — Halaman ${i} dari ${totalPages}`,
      margin,
      pageHeight - 8
    );
    doc.text('MADRASAH SMART SOAL', pageWidth - margin, pageHeight - 8, { align: 'right' });
  }

  return doc.output('blob');
}

/**
 * Helper fungsi unduh kisi-kisi ke MS Word
 */
export async function downloadKisiKisiWord(
  pkg: QuestionPackage,
  schoolProfile: SchoolProfile | null,
  options: ExportOptions = { includeAnswers: true }
) {
  const activeProfile = schoolProfile || getSchoolProfile();
  const blob = await exportKisiKisiToWordDocument(pkg, activeProfile, options);
  const cleanTitle = (pkg.title || 'Kisi_Kisi').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  triggerBrowserDownload(blob, `Kisi_Kisi_${cleanTitle}.docx`);
}

/**
 * Helper fungsi unduh kisi-kisi ke PDF
 */
export async function downloadKisiKisiPdf(
  pkg: QuestionPackage,
  schoolProfile: SchoolProfile | null,
  options: ExportOptions = { includeAnswers: true }
) {
  const blob = await exportKisiKisiToPdfDocument(pkg, schoolProfile, options);
  const cleanTitle = pkg.title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  triggerBrowserDownload(blob, `Kisi_Kisi_${cleanTitle}.pdf`);
}

/**
 * Ekspor Dokumen Kunci Jawaban & Pedoman Penskoran ke Microsoft Word (.docx)
 */
export async function exportKunciJawabanToWordDocument(
  pkg: QuestionPackage,
  schoolProfile: SchoolProfile | null,
  options: { showExplanations?: boolean } = { showExplanations: true }
): Promise<Blob> {
  const activeProfile = schoolProfile || getSchoolProfile();
  const questions = normalizeQuestionNumbering(pkg.questions || []);
  const showExp = options.showExplanations !== false;
  const docChildren: any[] = [];

  // 1. KOP MADRASAH
  docChildren.push(...createMadrasahKopElements(activeProfile, pkg.schoolName));

  // 2. JUDUL DOKUMEN
  docChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 80, after: 40 },
      children: [
        new TextRun({
          text: 'KUNCI JAWABAN DAN PEDOMAN PENSKORAN',
          font: 'Times New Roman',
          size: 24,
          bold: true,
          underline: {},
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 150 },
      children: [
        new TextRun({
          text: `${pkg.assessmentType.toUpperCase()} — TAHUN PELAJARAN ${pkg.academicYear}`,
          font: 'Times New Roman',
          size: 18,
          bold: true,
        }),
      ],
    })
  );

  // 3. TABEL IDENTITAS
  const totalScore = questions.reduce((sum, q) => sum + (Number(q.score) || 1), 0);
  docChildren.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: 'Mata Pelajaran\t: ', bold: true, font: 'Times New Roman', size: 18 }),
                    new TextRun({ text: pkg.subject, font: 'Times New Roman', size: 18 }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({ text: 'Kelas / Fase\t: ', bold: true, font: 'Times New Roman', size: 18 }),
                    new TextRun({ text: `${pkg.grade} (${pkg.phase})`, font: 'Times New Roman', size: 18 }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({ text: 'Semester\t: ', bold: true, font: 'Times New Roman', size: 18 }),
                    new TextRun({ text: pkg.semester, font: 'Times New Roman', size: 18 }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: 'Alokasi Waktu\t: ', bold: true, font: 'Times New Roman', size: 18 }),
                    new TextRun({ text: `${pkg.durationMinutes} Menit`, font: 'Times New Roman', size: 18 }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({ text: 'Guru Pengampu\t: ', bold: true, font: 'Times New Roman', size: 18 }),
                    new TextRun({ text: pkg.teacherName || schoolProfile?.teacherName || 'Guru Madrasah', font: 'Times New Roman', size: 18 }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({ text: 'Total Skor Maks.\t: ', bold: true, font: 'Times New Roman', size: 18 }),
                    new TextRun({ text: `${totalScore}`, bold: true, font: 'Times New Roman', size: 18 }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }),
    new Paragraph({ spacing: { after: 180 } })
  );

  // 4. TABEL REKAP KUNCI JAWABAN
  const tableRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          width: { size: 8, type: WidthType.PERCENTAGE },
          shading: { fill: 'E2E8F0' },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'No.', bold: true, font: 'Times New Roman', size: 18 })] })],
        }),
        new TableCell({
          width: { size: 18, type: WidthType.PERCENTAGE },
          shading: { fill: 'E2E8F0' },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Bentuk Soal', bold: true, font: 'Times New Roman', size: 18 })] })],
        }),
        new TableCell({
          width: { size: showExp ? 34 : 64, type: WidthType.PERCENTAGE },
          shading: { fill: 'E2E8F0' },
          children: [new Paragraph({ children: [new TextRun({ text: 'Kunci Jawaban Benar', bold: true, font: 'Times New Roman', size: 18 })] })],
        }),
        new TableCell({
          width: { size: 10, type: WidthType.PERCENTAGE },
          shading: { fill: 'E2E8F0' },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Skor', bold: true, font: 'Times New Roman', size: 18 })] })],
        }),
        ...(showExp
          ? [
              new TableCell({
                width: { size: 30, type: WidthType.PERCENTAGE },
                shading: { fill: 'E2E8F0' },
                children: [new Paragraph({ children: [new TextRun({ text: 'Pembahasan Singkat', bold: true, font: 'Times New Roman', size: 18 })] })],
              }),
            ]
          : []),
      ],
    }),
  ];

  for (const q of questions) {
    const typeLabel =
      q.type === 'multiple_choice'
        ? 'PG Biasa'
        : q.type === 'complex_multiple_choice'
        ? 'PG Kompleks'
        : q.type === 'short_answer'
        ? 'Isian'
        : 'Uraian';

    let keyText = q.answerKey || '-';
    if (q.type === 'short_answer' && q.acceptedAnswers && q.acceptedAnswers.length > 0) {
      keyText += ` (Alternatif: ${q.acceptedAnswers.join(' / ')})`;
    }

    tableRows.push(
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(q.number), bold: true, font: 'Times New Roman', size: 18 })] })],
          }),
          new TableCell({
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: typeLabel, font: 'Times New Roman', size: 18 })] })],
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: keyText, bold: q.type === 'multiple_choice', font: 'Times New Roman', size: 18 })] })],
          }),
          new TableCell({
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(q.score || 1), bold: true, font: 'Times New Roman', size: 18 })] })],
          }),
          ...(showExp
            ? [
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: q.explanation || '-', font: 'Times New Roman', size: 16 })] })],
                }),
              ]
            : []),
        ],
      })
    );
  }

  docChildren.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: tableRows,
    }),
    new Paragraph({ spacing: { after: 200 } })
  );

  // 5. DETAIL RUBRIK SOAL URAIAN JIKA ADA
  const essayQuestions = questions.filter((q) => q.type === 'essay');
  if (essayQuestions.length > 0) {
    docChildren.push(
      new Paragraph({
        spacing: { before: 150, after: 100 },
        children: [
          new TextRun({
            text: 'PEDOMAN PENSKORAN & RUBRIK SOAL URAIAN',
            bold: true,
            font: 'Times New Roman',
            size: 20,
          }),
        ],
      })
    );

    for (const eq of essayQuestions) {
      docChildren.push(
        new Paragraph({
          spacing: { before: 80, after: 40 },
          children: [
            new TextRun({ text: `Nomor ${eq.number}. `, bold: true, font: 'Times New Roman', size: 18 }),
            new TextRun({ text: eq.questionText, font: 'Times New Roman', size: 18 }),
          ],
        }),
        new Paragraph({
          spacing: { after: 40 },
          children: [
            new TextRun({ text: 'Kunci / Jawaban Ideal: ', bold: true, font: 'Times New Roman', size: 18 }),
            new TextRun({ text: eq.answerKey || 'Uraian sesuai capaian materi.', font: 'Times New Roman', size: 18 }),
          ],
        })
      );

      if (eq.rubric && eq.rubric.length > 0) {
        const rubricRows: TableRow[] = [
          new TableRow({
            tableHeader: true,
            children: [
              new TableCell({
                width: { size: 80, type: WidthType.PERCENTAGE },
                shading: { fill: 'F1F5F9' },
                children: [new Paragraph({ children: [new TextRun({ text: 'Kriteria Penilaian', bold: true, font: 'Times New Roman', size: 16 })] })],
              }),
              new TableCell({
                width: { size: 20, type: WidthType.PERCENTAGE },
                shading: { fill: 'F1F5F9' },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Skor', bold: true, font: 'Times New Roman', size: 16 })] })],
              }),
            ],
          }),
        ];

        for (const rub of eq.rubric) {
          rubricRows.push(
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: rub.criteria, font: 'Times New Roman', size: 16 })] })] }),
                new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(rub.score), bold: true, font: 'Times New Roman', size: 16 })] })] }),
              ],
            })
          );
        }

        docChildren.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: rubricRows,
          }),
          new Paragraph({ spacing: { after: 100 } })
        );
      }
    }
  }

  // 6. TANDA TANGAN
  docChildren.push(
    ...createSignatureBlock(activeProfile, {
      teacherName: pkg.teacherName,
      teacherRoleTitle: 'Guru Mata Pelajaran / Penilai',
    })
  );

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
        },
        children: docChildren,
      },
    ],
  });

  return await Packer.toBlob(doc);
}

/**
 * Unduh Kunci Jawaban ke Microsoft Word (.docx)
 */
export async function downloadKunciJawabanWord(
  pkg: QuestionPackage,
  schoolProfile: SchoolProfile | null,
  options: { showExplanations?: boolean } = { showExplanations: true }
) {
  const activeProfile = schoolProfile || getSchoolProfile();
  const blob = await exportKunciJawabanToWordDocument(pkg, activeProfile, options);
  const cleanTitle = (pkg.title || 'Kunci_Jawaban').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  triggerBrowserDownload(blob, `Kunci_Jawaban_${cleanTitle}.docx`);
}

/**
 * Ekspor Dokumen Kunci Jawaban & Pedoman Penskoran ke PDF
 */
export async function exportKunciJawabanToPdfDocument(
  pkg: QuestionPackage,
  schoolProfile: SchoolProfile | null,
  options: { showExplanations?: boolean } = { showExplanations: true }
): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = 14;

  const schoolName = pkg.schoolName || schoolProfile?.schoolName || 'MADRASAH IBTIDAIYAH';
  const questions = normalizeQuestionNumbering(pkg.questions || []);
  const showExp = options.showExplanations !== false;

  // Header Kop
  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.text('KEMENTERIAN AGAMA REPUBLIK INDONESIA', pageWidth / 2, y, { align: 'center' });
  y += 5.5;

  doc.setFontSize(14);
  doc.text(schoolName.toUpperCase(), pageWidth / 2, y, { align: 'center' });
  y += 5;

  doc.setFont('times', 'normal');
  doc.setFontSize(9);
  if (schoolProfile?.npsnOrNsm) {
    doc.text(`NSM / NPSN: ${schoolProfile.npsnOrNsm}`, pageWidth / 2, y, { align: 'center' });
    y += 4;
  }

  const address = schoolProfile?.address || 'Kementerian Agama Republik Indonesia';
  doc.text(address, pageWidth / 2, y, { align: 'center' });
  y += 3;

  doc.setLineWidth(0.8);
  doc.line(margin, y, pageWidth - margin, y);
  y += 0.8;
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  // Title
  doc.setFont('times', 'bold');
  doc.setFontSize(12);
  doc.text('KUNCI JAWABAN DAN PEDOMAN PENSKORAN', pageWidth / 2, y, { align: 'center' });
  y += 4.5;
  doc.setFontSize(10);
  doc.text(`${pkg.assessmentType.toUpperCase()} — TP ${pkg.academicYear}`, pageWidth / 2, y, { align: 'center' });
  y += 6;

  // Identity Table
  doc.setFont('times', 'normal');
  doc.setFontSize(9);
  doc.text(`Mata Pelajaran : ${pkg.subject}`, margin, y);
  doc.text(`Alokasi Waktu : ${pkg.durationMinutes} Menit`, pageWidth / 2 + 10, y);
  y += 4;
  doc.text(`Kelas / Fase   : ${pkg.grade} (${pkg.phase})`, margin, y);
  doc.text(`Semester      : ${pkg.semester}`, pageWidth / 2 + 10, y);
  y += 4;
  doc.text(`Guru Pengampu  : ${pkg.teacherName || schoolProfile?.teacherName || 'Guru Madrasah'}`, margin, y);
  const totalScore = questions.reduce((sum, q) => sum + (Number(q.score) || 1), 0);
  doc.text(`Total Skor    : ${totalScore}`, pageWidth / 2 + 10, y);
  y += 6;

  doc.setLineWidth(0.2);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  // Table header
  doc.setFont('times', 'bold');
  doc.setFontSize(9);
  doc.rect(margin, y, contentWidth, 7, 'S');
  doc.text('No.', margin + 2, y + 5);
  doc.text('Bentuk', margin + 12, y + 5);
  doc.text('Kunci Jawaban', margin + 35, y + 5);
  doc.text('Skor', margin + (showExp ? 95 : 155), y + 5);
  if (showExp) {
    doc.text('Pembahasan Singkat', margin + 110, y + 5);
  }
  y += 7;

  doc.setFont('times', 'normal');
  doc.setFontSize(8.5);

  for (const q of questions) {
    if (y > pageHeight - 35) {
      doc.addPage();
      y = 15;
    }

    const typeLabel =
      q.type === 'multiple_choice'
        ? 'PG'
        : q.type === 'complex_multiple_choice'
        ? 'PGK'
        : q.type === 'short_answer'
        ? 'Isian'
        : 'Uraian';

    let keyText = q.answerKey || '-';
    if (q.type === 'short_answer' && q.acceptedAnswers && q.acceptedAnswers.length > 0) {
      keyText += ` / ${q.acceptedAnswers.join(' / ')}`;
    }

    const expText = q.explanation || '-';
    const splitKey = doc.splitTextToSize(keyText, showExp ? 55 : 115);
    const splitExp = showExp ? doc.splitTextToSize(expText, 65) : [];
    const rowHeight = Math.max(6, Math.max(splitKey.length, splitExp.length) * 4 + 2);

    doc.rect(margin, y, contentWidth, rowHeight, 'S');
    doc.text(String(q.number), margin + 3, y + 4.5);
    doc.text(typeLabel, margin + 12, y + 4.5);
    doc.text(splitKey, margin + 35, y + 4.5);
    doc.text(String(q.score || 1), margin + (showExp ? 97 : 157), y + 4.5);
    if (showExp) {
      doc.text(splitExp, margin + 110, y + 4.5);
    }

    y += rowHeight;
  }

  y += 8;
  if (y > pageHeight - 40) {
    doc.addPage();
    y = 20;
  }

  // Signatures
  doc.setFont('times', 'normal');
  doc.setFontSize(9);
  doc.text('Mengetahui,', margin + 20, y, { align: 'center' });
  doc.text(`${schoolProfile?.city || 'Madrasah'}, ${formatIndonesianDate(new Date().toISOString())}`, pageWidth - margin - 25, y, { align: 'center' });
  y += 4;
  doc.setFont('times', 'bold');
  doc.text('Kepala Madrasah', margin + 20, y, { align: 'center' });
  doc.text('Guru Mata Pelajaran', pageWidth - margin - 25, y, { align: 'center' });
  y += 18;

  doc.text(schoolProfile?.principalName || '( ........................................ )', margin + 20, y, { align: 'center' });
  doc.text(pkg.teacherName || schoolProfile?.teacherName || '( ........................................ )', pageWidth - margin - 25, y, { align: 'center' });
  y += 4;
  doc.setFont('times', 'normal');
  doc.setFontSize(8);
  doc.text(`NIP. ${schoolProfile?.principalNip || '................................'}`, margin + 20, y, { align: 'center' });
  doc.text(`NIP. ${schoolProfile?.teacherNip || '................................'}`, pageWidth - margin - 25, y, { align: 'center' });

  return doc.output('blob');
}

/**
 * Unduh Kunci Jawaban ke PDF
 */
export async function downloadKunciJawabanPdf(
  pkg: QuestionPackage,
  schoolProfile: SchoolProfile | null,
  options: { showExplanations?: boolean } = { showExplanations: true }
) {
  const blob = await exportKunciJawabanToPdfDocument(pkg, schoolProfile, options);
  const cleanTitle = pkg.title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  triggerBrowserDownload(blob, `Kunci_Jawaban_${cleanTitle}.pdf`);
}



/**
 * Buat Blob Excel untuk Kunci Jawaban
 */
export function exportKunciJawabanToExcelWorkbook(
  pkg: QuestionPackage,
  schoolProfile: SchoolProfile | null,
  options: { showExplanations?: boolean } = { showExplanations: true }
): Blob {
  const questions = normalizeQuestionNumbering(pkg.questions || []);
  const showExp = options.showExplanations !== false;

  const data: any[] = [];
  data.push(['KUNCI JAWABAN DAN PEDOMAN PENSKORAN']);
  data.push([`${pkg.schoolName || schoolProfile?.schoolName || 'MADRASAH IBTIDAIYAH'}`]);
  data.push([`Mata Pelajaran: ${pkg.subject} | Kelas: ${pkg.grade} (${pkg.phase}) | Semester: ${pkg.semester}`]);
  data.push([`Jenis Asesmen: ${pkg.assessmentType} | TP: ${pkg.academicYear}`]);
  data.push([]);

  const headers = ['Nomor', 'Bentuk Soal', 'Kunci Jawaban', 'Alternatif Jawaban', 'Bobot Skor'];
  if (showExp) headers.push('Pembahasan Singkat');
  headers.push('Indikator');
  data.push(headers);

  for (const q of questions) {
    const typeLabel =
      q.type === 'multiple_choice'
        ? 'Pilihan Ganda'
        : q.type === 'complex_multiple_choice'
        ? 'PG Kompleks'
        : q.type === 'short_answer'
        ? 'Isian Singkat'
        : 'Uraian';

    const row = [
      q.number,
      typeLabel,
      q.answerKey || '-',
      q.acceptedAnswers ? q.acceptedAnswers.join('; ') : '-',
      q.score || 1,
    ];
    if (showExp) row.push(q.explanation || '-');
    row.push(q.indicator || '-');
    data.push(row);
  }

  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Kunci Jawaban');

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * Unduh Kunci Jawaban ke Excel (.xlsx)
 */
export function downloadKunciJawabanExcel(
  pkg: QuestionPackage,
  schoolProfile: SchoolProfile | null,
  options: { showExplanations?: boolean } = { showExplanations: true }
) {
  const blob = exportKunciJawabanToExcelWorkbook(pkg, schoolProfile, options);
  const cleanTitle = pkg.title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  triggerBrowserDownload(blob, `Kunci_Jawaban_${cleanTitle}.xlsx`);
}


