import React, { useState, useEffect, useCallback } from 'react';
import {
  ActiveView,
  AppSettings,
  QuestionPackage,
  SchoolProfile,
} from './types';
import {
  getStoredPackages,
  savePackage,
  deletePackage,
  duplicatePackage,
  getSchoolProfile,
  saveSchoolProfile,
  getAppSettings,
  saveAppSettings,
  clearAllData,
  DEFAULT_SETTINGS,
  hydrateFromNeonIfAvailable,
} from './services/storage';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { MobileNav } from './components/layout/MobileNav';
import { DashboardView } from './components/dashboard/DashboardView';
import { PackageFormView } from './components/packages/PackageFormView';
import { BankSoalView } from './components/packages/BankSoalView';
import { PackagePreviewView } from './components/packages/PackagePreviewView';
import { QuestionEditorView } from './components/packages/QuestionEditorView';
import { KisiKisiView } from './components/kisi-kisi/KisiKisiView';
import { KunciJawabanView } from './components/kunci-jawaban/KunciJawabanView';
import { SchoolProfileView } from './components/school/SchoolProfileView';
import { SettingsView } from './components/settings/SettingsView';
import { GuideView } from './components/guide/GuideView';
import {
  NotificationToast,
  ToastMessage,
} from './components/common/NotificationToast';
import { ConfirmModal } from './components/common/ConfirmModal';

export default function App() {
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');
  const [packages, setPackages] = useState<QuestionPackage[]>([]);
  const [schoolProfile, setSchoolProfile] = useState<SchoolProfile | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  const [selectedPackage, setSelectedPackage] = useState<QuestionPackage | null>(null);
  const [editingPackage, setEditingPackage] = useState<QuestionPackage | null>(null);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  } | null>(null);

  // Refresh all data from local storage
  const refreshData = useCallback(() => {
    try {
      const storedPkgs = getStoredPackages();
      setPackages(storedPkgs);

      const profile = getSchoolProfile();
      setSchoolProfile(profile);

      const settings = getAppSettings();
      setAppSettings(settings);
    } catch (err) {
      console.error('Error refreshing local storage data:', err);
    }
  }, []);

  useEffect(() => {
    refreshData();
    hydrateFromNeonIfAvailable()
      .then((res) => {
        if (res.packagesUpdated > 0 || res.profileUpdated) {
          refreshData();
        }
      })
      .catch(() => {});
  }, [refreshData]);

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToast({
      id: Date.now().toString(),
      type,
      message,
    });
  };

  const handleNavigate = (view: ActiveView) => {
    if (view === 'create-package') {
      setEditingPackage(null);
    }
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenPackage = (pkg: QuestionPackage) => {
    setSelectedPackage(pkg);
    setActiveView('preview-package');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenKunciJawaban = (pkg: QuestionPackage) => {
    setSelectedPackage(pkg);
    setActiveView('kunci-jawaban');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenEditor = (pkg: QuestionPackage) => {
    if (pkg.questions && pkg.questions.length > 0) {
      savePackage(pkg);
      refreshData();
    }
    setSelectedPackage(pkg);
    setActiveView('review-questions');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEditPackage = (pkg: QuestionPackage) => {
    setEditingPackage(pkg);
    setActiveView('create-package');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSavePackage = (pkg: QuestionPackage, andPreview = false) => {
    const result = savePackage(pkg);
    if (result.success && result.data) {
      refreshData();
      showToast('success', `Paket soal "${pkg.title}" berhasil disimpan!`);
      if (andPreview) {
        setSelectedPackage(result.data);
        setActiveView('preview-package');
      } else {
        setActiveView('bank-soal');
      }
    } else {
      showToast('error', result.error || 'Gagal menyimpan paket soal.');
    }
  };

  const handleDuplicatePackage = (id: string) => {
    const result = duplicatePackage(id);
    if (result.success && result.data) {
      refreshData();
      showToast('success', `Paket berhasil diduplikasi sebagai "${result.data.title}".`);
    } else {
      showToast('error', result.error || 'Gagal menduplikasi paket soal.');
    }
  };

  const handleDeletePackageRequest = (pkg: QuestionPackage) => {
    setConfirmModal({
      isOpen: true,
      title: 'Hapus Paket Soal',
      message: `Apakah Anda yakin ingin menghapus paket "${pkg.title}"? Tindakan ini tidak dapat dibatalkan.`,
      confirmLabel: 'Ya, Hapus Paket',
      isDestructive: true,
      onConfirm: () => {
        const result = deletePackage(pkg.id);
        if (result.success) {
          refreshData();
          showToast('success', 'Paket soal berhasil dihapus.');
          if (selectedPackage?.id === pkg.id) {
            setSelectedPackage(null);
            setActiveView('bank-soal');
          }
        } else {
          showToast('error', result.error || 'Gagal menghapus paket soal.');
        }
        setConfirmModal(null);
      },
    });
  };

  const handleSaveProfile = (profile: SchoolProfile) => {
    const result = saveSchoolProfile(profile);
    if (result.success) {
      refreshData();
      showToast('success', 'Identitas madrasah berhasil diperbarui.');
    } else {
      showToast('error', result.error || 'Gagal menyimpan profil madrasah.');
    }
  };

  const handleSaveSettings = (settings: AppSettings) => {
    const result = saveAppSettings(settings);
    if (result.success) {
      refreshData();
      showToast('success', 'Pengaturan aplikasi berhasil disimpan.');
    } else {
      showToast('error', result.error || 'Gagal menyimpan pengaturan.');
    }
  };

  const handleResetAllDataRequest = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Hapus Seluruh Data Aplikasi',
      message:
        'Peringatan: Seluruh paket soal, identitas madrasah, dan pengaturan yang tersimpan di browser ini akan dihapus permanen. Lanjutkan?',
      confirmLabel: 'Hapus Permanen',
      isDestructive: true,
      onConfirm: () => {
        const result = clearAllData();
        if (result.success) {
          refreshData();
          setSelectedPackage(null);
          setEditingPackage(null);
          setActiveView('dashboard');
          showToast('info', 'Seluruh data lokal telah dibersihkan.');
        } else {
          showToast('error', result.error || 'Gagal menghapus data.');
        }
        setConfirmModal(null);
      },
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      {/* Top Navbar */}
      <Navbar
        activeView={activeView}
        onNavigate={handleNavigate}
        onToggleMobileMenu={() => setMobileMenuOpen(true)}
        schoolProfile={schoolProfile}
        packageCount={packages.length}
      />

      {/* Main Body */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {/* Desktop Sidebar */}
        <Sidebar
          activeView={activeView}
          onNavigate={handleNavigate}
          packageCount={packages.length}
          schoolProfile={schoolProfile}
        />

        {/* Mobile Nav Drawer */}
        <MobileNav
          isOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          activeView={activeView}
          onNavigate={handleNavigate}
          packageCount={packages.length}
          schoolProfile={schoolProfile}
        />

        {/* Dynamic Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {activeView === 'dashboard' && (
            <DashboardView
              packages={packages}
              schoolProfile={schoolProfile}
              onNavigate={handleNavigate}
              onOpenPackage={handleOpenPackage}
              onEditPackage={handleEditPackage}
              onDuplicatePackage={handleDuplicatePackage}
              onDeletePackageRequest={handleDeletePackageRequest}
            />
          )}

          {activeView === 'create-package' && (
            <PackageFormView
              packageToEdit={editingPackage}
              schoolProfile={schoolProfile}
              onSave={handleSavePackage}
              onNavigate={handleNavigate}
              onPreview={(pkg) => {
                setSelectedPackage(pkg);
                setActiveView('preview-package');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onOpenEditor={handleOpenEditor}
            />
          )}

          {activeView === 'review-questions' && (
            selectedPackage ? (
              <QuestionEditorView
                packageData={selectedPackage}
                onSavePackage={(pkg) => {
                  handleSavePackage(pkg);
                  setSelectedPackage(pkg);
                }}
                onNavigate={handleNavigate}
                onOpenPreview={(pkg) => {
                  setSelectedPackage(pkg);
                  setActiveView('preview-package');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                onOpenKisiKisi={(pkg) => {
                  setSelectedPackage(pkg);
                  setActiveView('kisi-kisi');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                onOpenKunciJawaban={(pkg) => {
                  setSelectedPackage(pkg);
                  setActiveView('kunci-jawaban');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                onRegenerateRequest={() => {
                  setEditingPackage(selectedPackage);
                  setActiveView('create-package');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            ) : (
              <div className="text-center py-16 space-y-4">
                <p className="text-sm font-semibold text-slate-700">
                  Tidak ada paket soal yang dipilih untuk direview.
                </p>
                <button
                  type="button"
                  onClick={() => handleNavigate('bank-soal')}
                  className="px-4 py-2 rounded-xl bg-teal-700 text-white text-xs font-bold"
                >
                  Buka Bank Soal
                </button>
              </div>
            )
          )}

          {activeView === 'bank-soal' && (
            <BankSoalView
              packages={packages}
              schoolProfile={schoolProfile}
              onNavigate={handleNavigate}
              onOpenPackage={handleOpenPackage}
              onOpenKunciJawaban={handleOpenKunciJawaban}
              onEditPackage={handleEditPackage}
              onDuplicatePackage={handleDuplicatePackage}
              onDeletePackageRequest={handleDeletePackageRequest}
            />
          )}

          {activeView === 'preview-package' && (
            selectedPackage ? (
              <PackagePreviewView
                packageData={selectedPackage}
                schoolProfile={schoolProfile}
                onNavigate={handleNavigate}
                onEditPackage={handleEditPackage}
                onOpenEditor={handleOpenEditor}
                onOpenKunciJawaban={handleOpenKunciJawaban}
              />
            ) : (
              <div className="text-center py-16 space-y-4">
                <p className="text-sm font-semibold text-slate-700">
                  Tidak ada paket soal yang dipilih untuk pratinjau.
                </p>
                <button
                  type="button"
                  onClick={() => handleNavigate('bank-soal')}
                  className="px-4 py-2 rounded-xl bg-teal-700 text-white text-xs font-bold"
                >
                  Buka Bank Soal
                </button>
              </div>
            )
          )}

          {activeView === 'kunci-jawaban' && (
            <KunciJawabanView
              packages={packages}
              initialPackageId={selectedPackage?.id}
              schoolProfile={schoolProfile}
              onNavigate={handleNavigate}
              onOpenPackage={handleOpenPackage}
              onUpdatePackage={handleSavePackage}
            />
          )}

          {activeView === 'kisi-kisi' && (
            <KisiKisiView
              packages={packages}
              schoolProfile={schoolProfile}
              onNavigate={handleNavigate}
              onOpenPackage={handleOpenPackage}
              onUpdatePackage={handleSavePackage}
            />
          )}

          {activeView === 'identitas-madrasah' && (
            <SchoolProfileView
              initialProfile={schoolProfile}
              onSaveProfile={handleSaveProfile}
            />
          )}

          {activeView === 'pengaturan' && (
            <SettingsView
              settings={appSettings}
              onSaveSettings={handleSaveSettings}
              onResetAllDataRequest={handleResetAllDataRequest}
              onRefreshData={refreshData}
              setToast={setToast}
            />
          )}

          {activeView === 'panduan' && <GuideView onNavigate={handleNavigate} />}
        </main>
      </div>

      {/* Floating Notification Toast */}
      <NotificationToast toast={toast} onClose={() => setToast(null)} />

      {/* Global Confirmation Modal */}
      {confirmModal && (
        <ConfirmModal
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          message={confirmModal.message}
          confirmLabel={confirmModal.confirmLabel}
          cancelLabel={confirmModal.cancelLabel}
          isDestructive={confirmModal.isDestructive}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}
    </div>
  );
}
