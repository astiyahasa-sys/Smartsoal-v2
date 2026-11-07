import React from 'react';
import {
  LayoutDashboard,
  PlusCircle,
  FolderArchive,
  Table2,
  School,
  Settings,
  BookOpenCheck,
  ChevronRight,
  Sparkles,
  KeyRound,
} from 'lucide-react';
import { ActiveView, SchoolProfile } from '../../types';

interface SidebarProps {
  activeView: ActiveView;
  onNavigate: (view: ActiveView) => void;
  packageCount: number;
  schoolProfile: SchoolProfile | null;
}

interface NavItem {
  id: ActiveView;
  label: string;
  icon: React.ReactNode;
  badge?: string | number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onNavigate,
  packageCount,
  schoolProfile,
}) => {
  const navItems: NavItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard className="w-5 h-5 shrink-0" />,
    },
    {
      id: 'create-package',
      label: 'Buat Paket Soal',
      icon: <PlusCircle className="w-5 h-5 shrink-0" />,
    },
    {
      id: 'bank-soal',
      label: 'Bank Soal',
      icon: <FolderArchive className="w-5 h-5 shrink-0" />,
      badge: packageCount > 0 ? packageCount : undefined,
    },
    {
      id: 'kunci-jawaban',
      label: 'Kunci & Pembahasan',
      icon: <KeyRound className="w-5 h-5 shrink-0" />,
    },
    {
      id: 'kisi-kisi',
      label: 'Kisi-kisi Soal',
      icon: <Table2 className="w-5 h-5 shrink-0" />,
    },
    {
      id: 'identitas-madrasah',
      label: 'Identitas Madrasah',
      icon: <School className="w-5 h-5 shrink-0" />,
    },
    {
      id: 'pengaturan',
      label: 'Pengaturan',
      icon: <Settings className="w-5 h-5 shrink-0" />,
    },
    {
      id: 'panduan',
      label: 'Panduan Penggunaan',
      icon: <BookOpenCheck className="w-5 h-5 shrink-0" />,
    },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-slate-900 border-r border-slate-800 shrink-0 min-h-[calc(100vh-4rem)] p-4 justify-between no-print select-none">
      <div className="space-y-6">
        {/* Navigation Section */}
        <div>
          <div className="px-3 mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Menu Utama
          </div>
          <nav className="space-y-1.5" aria-label="Navigasi Utama">
            {navItems.map((item) => {
              const isActive =
                activeView === item.id ||
                (item.id === 'create-package' && activeView === 'edit-package') ||
                (item.id === 'bank-soal' && activeView === 'preview-package');

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition group ${
                    isActive
                      ? 'bg-teal-600 text-white shadow-sm shadow-teal-900/30'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`${
                        isActive ? 'text-white' : 'text-slate-400 group-hover:text-teal-400'
                      }`}
                    >
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        isActive
                          ? 'bg-teal-800 text-teal-100'
                          : 'bg-slate-800 text-teal-300 border border-slate-700'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Feature Roadmap Notice for MI */}
        <div className="p-3.5 rounded-xl bg-slate-800/70 border border-slate-700/60 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-teal-300 mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Fokus Tahap 1</span>
          </div>
          <p className="text-slate-300 leading-relaxed text-[11px]">
            Fondasi naskah asesmen, identitas madrasah, dan penyimpanan lokal aktif. Integrasi AI Gemini akan hadir di Tahap 2.
          </p>
        </div>
      </div>

      {/* School Badge Footer */}
      <div className="pt-4 border-t border-slate-800">
        <button
          type="button"
          onClick={() => onNavigate('identitas-madrasah')}
          className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 text-left transition group"
        >
          <div className="overflow-hidden">
            <p className="text-[11px] font-medium text-slate-400">Madrasah Terdaftar</p>
            <p className="text-xs font-bold text-slate-200 truncate group-hover:text-teal-300">
              {schoolProfile?.schoolName || 'Belum Diatur'}
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 shrink-0" />
        </button>
      </div>
    </aside>
  );
};
