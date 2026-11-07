import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  Sparkles,
  ExternalLink,
  Layers,
  Image as ImageIcon,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import { QuestionItem, QuestionPackage } from '../../types';
import {
  buildAllPackageImagePrompts,
  AI_IMAGE_PLATFORMS,
  ImagePromptResult,
} from '../../utils/imagePromptBuilder';

interface BatchImagePromptsModalProps {
  isOpen: boolean;
  onClose: () => void;
  packageData: QuestionPackage;
  questions: QuestionItem[];
  onOpenSinglePrompt: (index: number) => void;
}

export const BatchImagePromptsModal: React.FC<BatchImagePromptsModalProps> = ({
  isOpen,
  onClose,
  packageData,
  questions,
  onOpenSinglePrompt,
}) => {
  const [filterMissingOnly, setFilterMissingOnly] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedItemNumber, setCopiedItemNumber] = useState<number | null>(null);

  if (!isOpen) return null;

  const allPrompts = buildAllPackageImagePrompts({
    ...packageData,
    questions,
  });

  const displayedPrompts = filterMissingOnly
    ? allPrompts.filter((p) => !p.hasExistingImage)
    : allPrompts;

  const missingImageCount = allPrompts.filter((p) => !p.hasExistingImage).length;

  const handleCopySingle = async (p: ImagePromptResult) => {
    try {
      await navigator.clipboard.writeText(p.indonesianPrompt);
      setCopiedItemNumber(p.questionNumber);
      setTimeout(() => setCopiedItemNumber(null), 2000);
    } catch {}
  };

  const handleCopyAll = async () => {
    try {
      const header = [
        `=== DAFTAR PROMPT AI GAMBAR STIMULUS SOAL ===`,
        `Mata Pelajaran: ${packageData.subject} ${packageData.grade} (${packageData.phase})`,
        `Judul Paket: ${packageData.title}`,
        `Materi Pokok: ${packageData.topic}`,
        `Total Butir: ${displayedPrompts.length} Soal`,
        `Rekomendasi Generator: Google Gemini / Bing Image Creator / Canva / ChatGPT`,
        `--------------------------------------------------\n`,
      ].join('\n');

      const items = displayedPrompts.map((p) => {
        return [
          `[SOAL NOMOR ${p.questionNumber}] (${p.questionType.toUpperCase()})`,
          `Stimulus Inti: ${p.coreStimulus}`,
          `Prompt AI (Indonesia):`,
          p.indonesianPrompt,
          `\nPrompt AI (English):`,
          p.englishPrompt,
          `\n--------------------------------------------------`,
        ].join('\n');
      }).join('\n\n');

      await navigator.clipboard.writeText(header + items);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2500);
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-teal-900 via-teal-800 to-indigo-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold tracking-tight">Daftar Prompt AI Gambar Seluruh Paket</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-teal-400/20 text-teal-200 border border-teal-400/30">
                  {displayedPrompts.length} Soal
                </span>
              </div>
              <p className="text-[11px] text-teal-100/80">
                {packageData.subject} {packageData.grade} • Salin prompt sekaligus untuk pembuatan gambar serentak
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-teal-200 hover:text-white hover:bg-white/10 transition"
            title="Tutup dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter and Bulk Action Toolbar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFilterMissingOnly(false)}
              className={`px-3 py-1.5 rounded-xl font-bold transition ${
                !filterMissingOnly
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Semua Soal ({allPrompts.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMissingOnly(true)}
              className={`px-3 py-1.5 rounded-xl font-bold transition ${
                filterMissingOnly
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Belum Bergambar ({missingImageCount})
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopyAll}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs shadow-xs transition cursor-pointer"
          >
            {copiedAll ? (
              <>
                <Check className="w-4 h-4 text-emerald-300" />
                <span>Seluruh Prompt Paket Tersalin!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Salin Seluruh Prompt Paket (Format Teks Lengkap)</span>
              </>
            )}
          </button>
        </div>

        {/* Prompts List */}
        <div className="p-5 overflow-y-auto space-y-3.5 text-xs">
          {displayedPrompts.map((p, index) => {
            const actualQuestionIndex = questions.findIndex((q) => q.id === p.questionId);
            return (
              <div
                key={p.questionId}
                className="p-4 rounded-xl border border-slate-200 bg-white hover:border-teal-300 transition space-y-2.5 shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-teal-100 text-teal-800 font-bold flex items-center justify-center text-xs">
                      {p.questionNumber}
                    </span>
                    <span className="font-bold text-slate-800">
                      Soal Nomor {p.questionNumber}
                    </span>
                    {p.hasExistingImage ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        Sudah Ada Gambar
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                        Perlu Gambar
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopySingle(p)}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg border border-teal-300 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold transition"
                    >
                      {copiedItemNumber === p.questionNumber ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Tersalin!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Salin Prompt</span>
                        </>
                      )}
                    </button>

                    {actualQuestionIndex !== -1 && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenSinglePrompt(actualQuestionIndex);
                        }}
                        className="px-2.5 py-1 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold"
                        title="Buka detail & langsung unggah gambar untuk soal ini"
                      >
                        Buka & Unggah
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 text-[11px] leading-relaxed font-mono select-all">
                  {p.indonesianPrompt}
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Prompt dioptimasi untuk buku ajar Kurikulum Merdeka Madrasah Ibtidaiyah.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
