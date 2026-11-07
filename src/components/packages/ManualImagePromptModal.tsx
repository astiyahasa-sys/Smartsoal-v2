import React, { useState, useEffect } from 'react';
import {
  X,
  Copy,
  Check,
  Sparkles,
  ExternalLink,
  Upload,
  Layers,
  Info,
  Edit2,
  RefreshCw,
} from 'lucide-react';
import { QuestionItem } from '../../types';
import {
  buildManualImagePrompt,
  AI_IMAGE_PLATFORMS,
  ImagePromptResult,
} from '../../utils/imagePromptBuilder';

interface ManualImagePromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  question: QuestionItem | null;
  packageContext: {
    subject: string;
    grade: string | number;
    phase: string;
    topic: string;
  };
  onUploadImage: (file: File) => void;
  onUpdateImageAlt?: (newAlt: string) => void;
}

export const ManualImagePromptModal: React.FC<ManualImagePromptModalProps> = ({
  isOpen,
  onClose,
  question,
  packageContext,
  onUploadImage,
  onUpdateImageAlt,
}) => {
  const [activeLang, setActiveLang] = useState<'id' | 'en'>('id');
  const [copied, setCopied] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [promptData, setPromptData] = useState<ImagePromptResult | null>(null);

  // Perbarui data prompt setiap kali butir soal berganti
  useEffect(() => {
    if (!question) {
      setPromptData(null);
      setCustomPrompt('');
      return;
    }

    const data = buildManualImagePrompt(question, packageContext);
    setPromptData(data);
    setCustomPrompt(activeLang === 'id' ? data.indonesianPrompt : data.englishPrompt);
    setIsCustomizing(false);
  }, [question, packageContext, activeLang]);

  if (!isOpen || !question || !promptData) return null;

  const currentPromptText = isCustomizing
    ? customPrompt
    : activeLang === 'id'
    ? promptData.indonesianPrompt
    : promptData.englishPrompt;

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(currentPromptText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback manual selection
      setCopied(false);
    }
  };

  const handleResetPrompt = () => {
    const original = activeLang === 'id' ? promptData.indonesianPrompt : promptData.englishPrompt;
    setCustomPrompt(original);
    setIsCustomizing(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadImage(file);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-teal-900 via-teal-800 to-indigo-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold tracking-tight">Prompt AI Gambar Stimulus</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-teal-400/20 text-teal-200 border border-teal-400/30">
                  Nomor {question.number}
                </span>
              </div>
              <p className="text-[11px] text-teal-100/80">
                {packageContext.subject} {packageContext.grade} ({packageContext.phase})
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

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Ringkasan Konteks Stimulus Soal */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Kalimat Butir Pertanyaan
                </span>
                <p className="text-slate-800 font-medium line-clamp-2">
                  "{question.questionText}"
                </p>
              </div>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-200 text-slate-700 shrink-0">
                Rasio: {promptData.suggestedAspect}
              </span>
            </div>

            <div className="pt-2 border-t border-slate-200/60 flex items-center gap-1.5 text-slate-600">
              <span className="text-[11px] font-semibold">Objek Visual Inti:</span>
              <span className="font-bold text-teal-900 bg-teal-50 px-2 py-0.5 rounded border border-teal-200/80">
                {promptData.coreStimulus}
              </span>
            </div>
          </div>

          {/* Tab Pemilihan Bahasa Prompt */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-100 border border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setActiveLang('id');
                    setIsCustomizing(false);
                    setCustomPrompt(promptData.indonesianPrompt);
                  }}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition ${
                    activeLang === 'id'
                      ? 'bg-white text-teal-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  🇮🇩 Bahasa Indonesia (Gemini / Canva)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveLang('en');
                    setIsCustomizing(false);
                    setCustomPrompt(promptData.englishPrompt);
                  }}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition ${
                    activeLang === 'en'
                      ? 'bg-white text-indigo-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  🇬🇧 English (DALL-E 3 / Midjourney)
                </button>
              </div>

              <div className="flex items-center gap-2">
                {isCustomizing && (
                  <button
                    type="button"
                    onClick={handleResetPrompt}
                    className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800"
                    title="Kembalikan ke format prompt otomatis"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Reset</span>
                  </button>
                )}
                <span className="text-[11px] text-slate-400">Siap Disalin</span>
              </div>
            </div>

            {/* Kotak Teks Prompt */}
            <div className="relative rounded-xl border border-teal-200 bg-teal-50/40 p-3.5 space-y-2.5">
              <textarea
                rows={4}
                value={currentPromptText}
                onChange={(e) => {
                  setCustomPrompt(e.target.value);
                  setIsCustomizing(true);
                }}
                className="w-full bg-white p-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-800 text-xs font-medium leading-relaxed resize-none shadow-2xs"
                placeholder="Teks prompt AI..."
              />

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {promptData.quickKeywords.map((kw, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white border border-slate-200 text-slate-600"
                    >
                      {kw}
                    </span>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-300" />
                      <span>Prompt Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Salin Prompt AI</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Quick Links AI Image Generators */}
          <div className="space-y-2 pt-1">
            <span className="text-[11px] font-bold text-slate-700 block">
              Buka Generator AI Gratis di Tab Baru:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {AI_IMAGE_PLATFORMS.slice(0, 4).map((platform) => (
                <a
                  key={platform.name}
                  href={platform.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-teal-300 transition flex flex-col justify-between gap-1 group shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 group-hover:text-teal-700 text-[11px] truncate">
                      {platform.name}
                    </span>
                    <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-teal-600 shrink-0" />
                  </div>
                  <span className="text-[10px] text-teal-700 font-semibold">
                    {platform.badge}
                  </span>
                </a>
              ))}
            </div>
          </div>

          {/* Langkah Cepat Guru */}
          <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200 text-indigo-950 text-[11px] space-y-1 leading-relaxed">
            <div className="flex items-center gap-1.5 font-bold text-indigo-900">
              <Info className="w-3.5 h-3.5 text-indigo-700" />
              <span>Cara Praktis Menggunakan Gambar:</span>
            </div>
            <ol className="list-decimal list-inside space-y-0.5 text-indigo-900/90 pl-1">
              <li>Klik tombol <strong>"Salin Prompt AI"</strong> di atas.</li>
              <li>Buka <strong>Gemini</strong> atau <strong>Bing Image Creator</strong> lalu paste prompt.</li>
              <li>Unduh (*download*) gambar yang dihasilkan ke komputer atau ponsel Anda.</li>
              <li>Tekan tombol <strong>"Unggah Gambar Hasil Generate"</strong> di bawah untuk memasang gambar ke soal nomor {question.number}.</li>
            </ol>
          </div>
        </div>

        {/* Modal Footer dengan Upload Langsung */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <input
            type="file"
            id={`modal-upload-${question.id}`}
            accept="image/jpeg,image/png,image/webp,image/jpg"
            className="hidden"
            onChange={handleFileChange}
          />

          <label
            htmlFor={`modal-upload-${question.id}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-xs transition cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Unggah Gambar Hasil Generate</span>
          </label>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
