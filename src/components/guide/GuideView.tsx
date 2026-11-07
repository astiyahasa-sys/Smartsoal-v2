import React from 'react';
import {
  BookOpenCheck,
  CheckCircle2,
  HardDrive,
  Sparkles,
  School,
  FileText,
  AlertTriangle,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { ActiveView } from '../../types';

interface GuideViewProps {
  onNavigate: (view: ActiveView) => void;
}

export const GuideView: React.FC<GuideViewProps> = ({ onNavigate }) => {
  return (
    <div className="space-y-8 max-w-4xl mx-auto animate-in fade-in duration-150">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200">
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
          <BookOpenCheck className="w-7 h-7 text-teal-700" />
          <span>Panduan Penggunaan Madrasah Smart Soal</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Petunjuk lengkap penyusunan perangkat asesmen pembelajaran untuk Guru Madrasah Ibtidaiyah (MI).
        </p>
      </div>

      {/* Peringatan Utama Penyimpanan Lokal */}
      <div className="p-5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 space-y-3">
        <div className="flex items-center gap-2 font-bold text-sm text-amber-900">
          <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" />
          <span>Pemberitahuan Penting Mengenai Penyimpanan Local Storage</span>
        </div>
        <p className="text-xs leading-relaxed">
          Aplikasi <strong>MADRASAH SMART SOAL (Tahap 1)</strong> menggunakan teknologi{' '}
          <strong>Local Storage</strong> pada peramban (browser) Anda. Harap perhatikan hal-hal berikut:
        </p>
        <ul className="list-disc list-inside space-y-1 text-xs text-amber-900/90 pl-1">
          <li>
            Data draf paket soal dan identitas madrasah <strong>hanya tersimpan pada peramban dan perangkat yang sedang Anda pakai</strong>.
          </li>
          <li>
            Data <strong>tidak otomatis tersinkronisasi</strong> jika Anda membuka aplikasi ini dari ponsel atau laptop lain.
          </li>
          <li>
            Data dapat terhapus apabila Anda membersihkan riwayat browser (Clear History / Clear Cookies & Site Data).
          </li>
          <li>
            <strong>Saran Praktis:</strong> Gunakan menu <strong>Pengaturan &gt; Cadangkan Data (Ekspor JSON)</strong> secara berkala agar naskah soal Anda selalu memiliki salinan aman.
          </li>
        </ul>
      </div>

      {/* Bagian 1: Fase Kurikulum Merdeka di Madrasah Ibtidaiyah */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <Layers className="w-5 h-5 text-teal-700" />
          <h2 className="text-base font-bold text-slate-900">
            1. Pembagian Fase Kurikulum Merdeka Madrasah Ibtidaiyah (MI)
          </h2>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          Sesuai dengan regulasi Kementerian Agama dan Kemendikbudristek, jenjang Madrasah Ibtidaiyah terbagi ke dalam 3 fase utama:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-4 rounded-xl bg-teal-50/70 border border-teal-200 space-y-1.5">
            <span className="px-2 py-0.5 rounded-md bg-teal-700 text-white font-bold text-[11px]">
              Fase A
            </span>
            <h3 className="font-bold text-sm text-teal-950">Kelas 1 dan Kelas 2</h3>
            <p className="text-xs text-teal-800 leading-relaxed">
              Fokus pada literasi dasar, numerasi konkret, pengenalan huruf hijaiyah, dan pembiasaan adab ibadah harian.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-sky-50/70 border border-sky-200 space-y-1.5">
            <span className="px-2 py-0.5 rounded-md bg-sky-700 text-white font-bold text-[11px]">
              Fase B
            </span>
            <h3 className="font-bold text-sm text-sky-950">Kelas 3 dan Kelas 4</h3>
            <p className="text-xs text-sky-800 leading-relaxed">
              Pengembangan konsep tematik/IPAS, pemahaman tata cara shalat, kisah teladan nabi, dan teks bacaan sederhana.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-1.5">
            <span className="px-2 py-0.5 rounded-md bg-indigo-700 text-white font-bold text-[11px]">
              Fase C
            </span>
            <h3 className="font-bold text-sm text-indigo-950">Kelas 5 dan Kelas 6</h3>
            <p className="text-xs text-indigo-800 leading-relaxed">
              Penalaran kritis (HOTS), penguasaan fikih muamalah, sejarah peradaban Islam, dan persiapan Asesmen Madrasah (AM).
            </p>
          </div>
        </div>
      </div>

      {/* Bagian 2: Langkah Penyusunan Paket Soal */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <FileText className="w-5 h-5 text-teal-700" />
          <h2 className="text-base font-bold text-slate-900">
            2. Alur Langkah Penggunaan Aplikasi
          </h2>
        </div>

        <div className="space-y-4 text-xs text-slate-600">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-teal-100 text-teal-800 font-bold flex items-center justify-center shrink-0">
              1
            </div>
            <div>
              <strong className="text-slate-900 block text-sm">Lengkapi Identitas Madrasah</strong>
              <p className="mt-0.5">
                Buka menu <strong>Identitas Madrasah</strong>. Masukkan nama madrasah, alamat, nama kepala madrasah, dan nama Anda sebagai guru. Ini akan mengotomatiskan kop naskah soal.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-teal-100 text-teal-800 font-bold flex items-center justify-center shrink-0">
              2
            </div>
            <div>
              <strong className="text-slate-900 block text-sm">Buat Rancangan Paket Soal</strong>
              <p className="mt-0.5">
                Klik menu <strong>Buat Paket Soal</strong>. Pilih mata pelajaran, kelas (fase otomatis terisi), jenis asesmen, serta tentukan jumlah butir Pilihan Ganda, Isian, dan Uraian.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-teal-100 text-teal-800 font-bold flex items-center justify-center shrink-0">
              3
            </div>
            <div>
              <strong className="text-slate-900 block text-sm">Simpan dan Periksa di Bank Soal</strong>
              <p className="mt-0.5">
                Simpan paket sebagai draf. Anda dapat mencari, mengedit, menduplikasi, atau mencetak naskah asesmen kapan pun melalui menu <strong>Bank Soal</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-teal-100 text-teal-800 font-bold flex items-center justify-center shrink-0">
              4
            </div>
            <div>
              <strong className="text-slate-900 block text-sm">Pratinjau dan Cetak Standar A4</strong>
              <p className="mt-0.5">
                Buka pratinjau naskah untuk melihat kop resmi, tabel identitas asesmen, dan rincian komposisi butir soal. Gunakan tombol <strong>Cetak / Simpan PDF (A4)</strong> untuk mencetak langsung.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bagian 3: Roadmap Tahap 1 vs Tahap 2 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <Sparkles className="w-5 h-5 text-teal-700" />
          <h2 className="text-base font-bold text-slate-900">
            3. Roadmap Pengembangan Aplikasi
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Tahap 1 */}
          <div className="p-4 rounded-xl border border-emerald-300 bg-emerald-50/40 space-y-2">
            <span className="px-2.5 py-1 rounded-full bg-emerald-700 text-white font-bold text-[10px]">
              Tahap 1 — Fondasi Aplikasi (Aktif)
            </span>
            <ul className="space-y-1.5 text-emerald-950 pt-2">
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Navigasi dan dashboard responsif Indonesia.</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Formulir penyusunan paket soal MI lengkap.</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Penyimpanan lokal tangguh, duplikasi, dan pencarian.</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Pratinjau naskah cetak A4 dengan kop madrasah.</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Cadangkan dan pulihkan data JSON.</span>
              </li>
            </ul>
          </div>

          {/* Tahap 2 */}
          <div className="p-4 rounded-xl border border-teal-300 bg-teal-50/40 space-y-2">
            <span className="px-2.5 py-1 rounded-full bg-teal-700 text-white font-bold text-[10px]">
              Tahap 2 — Integrasi AI & Ekspor Dokumen
            </span>
            <ul className="space-y-1.5 text-teal-950 pt-2">
              <li className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-teal-200 text-teal-800 flex items-center justify-center font-bold text-[10px] shrink-0">
                  ✦
                </span>
                <span>Pembangkitan butir soal otomatis dengan Gemini AI.</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-teal-200 text-teal-800 flex items-center justify-center font-bold text-[10px] shrink-0">
                  ✦
                </span>
                <span>Kunci jawaban dan rubrik penskoran terotomasi.</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-teal-200 text-teal-800 flex items-center justify-center font-bold text-[10px] shrink-0">
                  ✦
                </span>
                <span>Ekspor resmi dokumen Microsoft Word (.docx).</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-teal-200 text-teal-800 flex items-center justify-center font-bold text-[10px] shrink-0">
                  ✦
                </span>
                <span>Ekspor matriks kisi-kisi ke Excel (.xlsx).</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-teal-200 text-teal-800 flex items-center justify-center font-bold text-[10px] shrink-0">
                  ✦
                </span>
                <span>Penyempurnaan stimulus teks kontekstual keislaman.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="text-center pt-2">
        <button
          type="button"
          onClick={() => onNavigate('create-package')}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-sm shadow-md transition"
        >
          <span>Mulai Buat Paket Soal Sekarang</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
