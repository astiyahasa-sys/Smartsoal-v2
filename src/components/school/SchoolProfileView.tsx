import React, { useState, useRef } from 'react';
import {
  School,
  Save,
  Upload,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Building2,
  User,
  MapPin,
  Image as ImageIcon,
} from 'lucide-react';
import { SchoolProfile } from '../../types';

interface SchoolProfileViewProps {
  initialProfile: SchoolProfile | null;
  onSaveProfile: (profile: SchoolProfile) => void;
}

export const SchoolProfileView: React.FC<SchoolProfileViewProps> = ({
  initialProfile,
  onSaveProfile,
}) => {
  const [schoolName, setSchoolName] = useState(initialProfile?.schoolName || '');
  const [npsnOrNsm, setNpsnOrNsm] = useState(initialProfile?.npsnOrNsm || '');
  const [address, setAddress] = useState(initialProfile?.address || '');
  const [village, setVillage] = useState(initialProfile?.village || '');
  const [subdistrict, setSubdistrict] = useState(initialProfile?.subdistrict || '');
  const [city, setCity] = useState(initialProfile?.city || '');
  const [province, setProvince] = useState(initialProfile?.province || '');
  const [principalName, setPrincipalName] = useState(initialProfile?.principalName || '');
  const [principalNip, setPrincipalNip] = useState(initialProfile?.principalNip || '');
  const [teacherName, setTeacherName] = useState(initialProfile?.teacherName || '');
  const [teacherNip, setTeacherNip] = useState(initialProfile?.teacherNip || '');
  const [logoUrl, setLogoUrl] = useState<string | undefined>(initialProfile?.logoUrl);

  const [uploadError, setUploadError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Logo file handler with validation
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.type.startsWith('image/')) {
      setUploadError('Berkas harus berupa gambar (JPG, PNG, atau WebP).');
      return;
    }

    // Check size limit: 500 KB to avoid exceeding LocalStorage quota
    if (file.size > 500 * 1024) {
      setUploadError('Ukuran berkas logo terlalu besar. Maksimum ukuran logo adalah 500 KB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setLogoUrl(reader.result);
      }
    };
    reader.onerror = () => {
      setUploadError('Gagal membaca berkas logo.');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoUrl(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!schoolName.trim()) {
      setValidationError('Nama madrasah wajib diisi.');
      return;
    }

    const profile: SchoolProfile = {
      schoolName: schoolName.trim(),
      npsnOrNsm: npsnOrNsm.trim(),
      address: address.trim(),
      village: village.trim(),
      subdistrict: subdistrict.trim(),
      city: city.trim(),
      province: province.trim(),
      principalName: principalName.trim(),
      principalNip: principalNip.trim() || undefined,
      teacherName: teacherName.trim(),
      teacherNip: teacherNip.trim() || undefined,
      logoUrl,
      updatedAt: new Date().toISOString(),
    };

    onSaveProfile(profile);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-150">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200">
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
          <School className="w-7 h-7 text-teal-700" />
          <span>Identitas Madrasah Ibtidaiyah</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Data identitas madrasah akan otomatis digunakan pada kop naskah soal asesmen dan tanda tangan lembar soal.
        </p>
      </div>

      {validationError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Card 1: Data Lembaga & Logo */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-teal-700" />
            <h2 className="text-sm font-bold text-slate-900">Data Satuan Pendidikan</h2>
          </div>

          <div className="p-6 space-y-5">
            <div className="flex flex-col sm:flex-row items-start gap-6">
              {/* Logo Upload Box */}
              <div className="shrink-0 space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  Logo Madrasah (Opsional)
                </label>
                <div className="w-28 h-28 rounded-2xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center p-2 bg-slate-50 overflow-hidden relative group">
                  {logoUrl ? (
                    <>
                      <img
                        src={logoUrl}
                        alt="Logo Preview"
                        className="w-full h-full object-contain"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="absolute inset-0 bg-slate-900/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition rounded-2xl"
                        title="Hapus Logo"
                      >
                        <Trash2 className="w-6 h-6 text-rose-300" />
                      </button>
                    </>
                  ) : (
                    <div className="text-center p-2">
                      <ImageIcon className="w-8 h-8 text-slate-400 mx-auto mb-1" />
                      <span className="text-[10px] text-slate-400 block font-medium">
                        Maks 500 KB
                      </span>
                    </div>
                  )}
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleLogoUpload}
                  className="hidden"
                  id="logo-upload-input"
                />

                <div className="flex items-center gap-1.5">
                  <label
                    htmlFor="logo-upload-input"
                    className="cursor-pointer inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{logoUrl ? 'Ganti' : 'Pilih Logo'}</span>
                  </label>
                  {logoUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50"
                      title="Hapus Logo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {uploadError && (
                  <p className="text-[11px] text-rose-600 font-medium max-w-[200px]">
                    {uploadError}
                  </p>
                )}
              </div>

              {/* Form Nama & NSM */}
              <div className="flex-1 w-full space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Nama Madrasah Ibtidaiyah <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    placeholder="Contoh: MIN 1 Jakarta / MI Al-Hidayah"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Nomor Statistik Madrasah (NSM) / NPSN
                  </label>
                  <input
                    type="text"
                    value={npsnOrNsm}
                    onChange={(e) => setNpsnOrNsm(e.target.value)}
                    placeholder="Contoh: 111231710001 (NSM) / 60721234 (NPSN)"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Opsional, akan dicantumkan di bagian kop naskah soal.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Alamat Lembaga */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-teal-700" />
            <h2 className="text-sm font-bold text-slate-900">Alamat Madrasah</h2>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Alamat Jalan / Gedung
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Contoh: Jl. Madrasah No. 12 RT 04 / RW 02"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Desa / Kelurahan
                </label>
                <input
                  type="text"
                  value={village}
                  onChange={(e) => setVillage(e.target.value)}
                  placeholder="Contoh: Sukamaju"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Kecamatan
                </label>
                <input
                  type="text"
                  value={subdistrict}
                  onChange={(e) => setSubdistrict(e.target.value)}
                  placeholder="Contoh: Pasar Minggu"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Kabupaten / Kota
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Contoh: Jakarta Selatan"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Provinsi
                </label>
                <input
                  type="text"
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  placeholder="Contoh: DKI Jakarta"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Pimpinan & Guru Penyusun */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
            <User className="w-5 h-5 text-teal-700" />
            <h2 className="text-sm font-bold text-slate-900">Pejabat & Guru Penyusun</h2>
          </div>

          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Nama Kepala Madrasah
                </label>
                <input
                  type="text"
                  value={principalName}
                  onChange={(e) => setPrincipalName(e.target.value)}
                  placeholder="Contoh: H. M. Ridwan, M.Pd.I"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  NIP Kepala Madrasah (jika ada)
                </label>
                <input
                  type="text"
                  value={principalNip}
                  onChange={(e) => setPrincipalNip(e.target.value)}
                  placeholder="Contoh: 19780512 200501 1 003"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Nama Guru Utama Penyusun Soal
                </label>
                <input
                  type="text"
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  placeholder="Contoh: Ust. Ahmad Fauzi, S.Pd.I"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Nama ini dapat otomatis mengisi kolom guru pada formulir paket baru.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  NIP Guru Penyusun (jika ada)
                </label>
                <input
                  type="text"
                  value={teacherNip}
                  onChange={(e) => setTeacherNip(e.target.value)}
                  placeholder="Contoh: 19850210 201101 2 015"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-sm shadow-md transition"
          >
            <Save className="w-4 h-4" />
            <span>Simpan Identitas Madrasah</span>
          </button>
        </div>
      </form>
    </div>
  );
};
