import React from 'react';
import {
  LayoutDashboard,
  PlusCircle,
  FolderArchive,
  Table2,
  School,
  Settings,
  BookOpenCheck,
  X,
  BookOpen,
  KeyRound,
} from 'lucide-react';
import { ActiveView, SchoolProfile } from '../../types';

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  activeView: ActiveView;
  onNavigate: (view: ActiveView) => void;
  packageCount: number;
  schoolProfile: SchoolProfile | null;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  isOpen,
  onClose,
  activeView,
  onNavigate,
  packageCount,
  schoolProfile,
}) => {
  if (!isOpen) return null;

  const handleSelect = (view: ActiveView) => {
    onNavigate(view);
    onClose();
  };

  const navItems = [
    {
      id: 'dashboard' as ActiveView,
      label: 'Dashboard',
      icon: <LayoutDashboard className="w-5 h-5 shrink-0" />,
    },
    {
      id: 'create-package' as ActiveView,
      label: 'Buat Paket Soal',
      icon: <PlusCircle className="w-5 h-5 shrink-0" />,
    },
    {
      id: 'bank-soal' as ActiveView,
      label: 'Bank Soal',
      icon: <FolderArchive className="w-5 h-5 shrink-0" />,
      badge: packageCount,
    },
    {
      id: 'kunci-jawaban' as ActiveView,
      label: 'Kunci & Pembahasan',
      icon: <KeyRound className="w-5 h-5 shrink-0" />,
    },
    {
      id: 'kisi-kisi' as ActiveView,
      label: 'Kisi-kisi Soal',
      icon: <Table2 className="w-5 h-5 shrink-0" />,
    },
    {
      id: 'identitas-madrasah' as ActiveView,
      label: 'Identitas Madrasah',
      icon: <School className="w-5 h-5 shrink-0" />,
    },
    {
      id: 'pengaturan' as ActiveView,
      label: 'Pengaturan',
      icon: <Settings className="w-5 h-5 shrink-0" />,
    },
    {
      id: 'panduan' as ActiveView,
      label: 'Panduan Penggunaan',
      icon: <BookOpenCheck className="w-5 h-5 shrink-0" />,
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Menu navigasi mobile"
      className="fixed inset-0 z-50 lg:hidden flex no-print"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative w-4/5 max-w-xs bg-slate-900 text-white flex flex-col justify-between p-5 z-10 shadow-2xl h-full">
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-teal-600 flex items-center justify-center text-white font-bold">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-sm text-white">MADRASAH SMART SOAL</h2>
                <p className="text-[11px] text-teal-400">Guru Madrasah Ibtidaiyah</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup navigasi"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive =
                activeView === item.id ||
                (item.id === 'create-package' && activeView === 'edit-package') ||
                (item.id === 'bank-soal' && activeView === 'preview-package');

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                    isActive
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={isActive ? 'text-white' : 'text-slate-400'}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-teal-300 border border-slate-700">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="pt-4 border-t border-slate-800 text-xs text-slate-400">
          <p className="font-medium text-slate-300">
            {schoolProfile?.schoolName || 'Madrasah Belum Diatur'}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">Versi 1.0 — Fondasi Aplikasi</p>
        </div>
      </div>
    </div>
  );
};
