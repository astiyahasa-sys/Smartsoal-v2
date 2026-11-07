import React from 'react';
import { Menu, School, Settings, HardDrive, BookOpen } from 'lucide-react';
import { ActiveView, SchoolProfile } from '../../types';

interface NavbarProps {
  activeView: ActiveView;
  onNavigate: (view: ActiveView) => void;
  onToggleMobileMenu: () => void;
  schoolProfile: SchoolProfile | null;
  packageCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  onNavigate,
  onToggleMobileMenu,
  schoolProfile,
  packageCount,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-slate-900 border-b border-slate-800 text-white shadow-sm no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Identity */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onToggleMobileMenu}
              className="lg:hidden p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition focus:outline-none"
              aria-label="Buka menu navigasi"
            >
              <Menu className="w-6 h-6" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate('dashboard')}
              className="flex items-center gap-3 text-left group"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-500 flex items-center justify-center text-white shadow-md shadow-teal-900/30 font-bold group-hover:scale-105 transition-transform">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-base tracking-wide text-white">
                    MADRASAH SMART SOAL
                  </span>
                  <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                    Versi 1.0 — Fondasi Aplikasi
                  </span>
                </div>
                <p className="text-xs text-slate-400 hidden md:block">
                  Aplikasi Penyusunan Soal untuk Guru Madrasah Ibtidaiyah
                </p>
              </div>
            </button>
          </div>

          {/* Right Header Status & Actions */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Storage indicator */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300">
              <HardDrive className="w-3.5 h-3.5 text-teal-400" />
              <span>Penyimpanan Lokal:</span>
              <span className="font-bold text-white">{packageCount} Paket</span>
            </div>

            {/* School Profile Shortcut */}
            <button
              type="button"
              onClick={() => onNavigate('identitas-madrasah')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-200 hover:text-white hover:bg-slate-800 transition border border-transparent hover:border-slate-700"
              title="Identitas Madrasah"
            >
              <School className="w-4 h-4 text-emerald-400" />
              <span className="hidden md:inline truncate max-w-[140px]">
                {schoolProfile?.schoolName || 'Atur Madrasah'}
              </span>
            </button>

            {/* Settings Shortcut */}
            <button
              type="button"
              onClick={() => onNavigate('pengaturan')}
              aria-label="Buka Pengaturan"
              className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"
              title="Pengaturan Aplikasi"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
