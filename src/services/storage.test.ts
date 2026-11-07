import test from 'node:test';
import assert from 'node:assert/strict';
import {
  savePackage,
  getStoredPackages,
  deletePackage,
  duplicatePackage,
  saveSchoolProfile,
  getSchoolProfile,
  exportAllData,
  importAllData,
  clearAllData,
  STORAGE_KEYS,
} from './storage';
import { QuestionPackage, SchoolProfile } from '../types';

// Setup Mock LocalStorage for Node test environment
class MockLocalStorage {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.store[key] || null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = value.toString();
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }
}

// Attach mock window and localStorage
(global as any).window = {
  localStorage: new MockLocalStorage(),
};

test('storage handles empty storage gracefully', () => {
  window.localStorage.clear();
  const packages = getStoredPackages();
  assert.deepEqual(packages, []);
});

test('storage saves and retrieves package correctly', () => {
  window.localStorage.clear();
  const samplePkg: QuestionPackage = {
    id: 'pkg_test_1',
    title: 'Penilaian Sumatif Fikih',
    schoolName: 'MI Al-Ikhlas',
    teacherName: 'Ust. Zulkifli, S.Pd',
    academicYear: '2024/2025',
    semester: 'Ganjil',
    assessmentType: 'Sumatif Lingkup Materi',
    subject: 'Fikih',
    grade: 3,
    phase: 'Fase B',
    topic: 'Tayamum dan Wudhu',
    learningObjectives: 'Memahami rukun tayamum',
    durationMinutes: 60,
    multipleChoiceCount: 15,
    shortAnswerCount: 5,
    essayCount: 0,
    difficulty: 'Sedang',
    language: 'Bahasa Indonesia',
    sourceMaterial: 'Buku Siswa Fikih Kelas 3',
    additionalNotes: '',
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const saveRes = savePackage(samplePkg);
  assert.equal(saveRes.success, true);

  const packages = getStoredPackages();
  assert.equal(packages.length, 1);
  assert.equal(packages[0].title, 'Penilaian Sumatif Fikih');
});

test('storage duplicates package with unique id and "(Salinan)" suffix', () => {
  const dupRes = duplicatePackage('pkg_test_1');
  assert.equal(dupRes.success, true);
  assert.ok(dupRes.data);
  assert.notEqual(dupRes.data.id, 'pkg_test_1');
  assert.equal(dupRes.data.title, 'Penilaian Sumatif Fikih (Salinan)');

  const packages = getStoredPackages();
  assert.equal(packages.length, 2);
});

test('storage deletes package successfully', () => {
  const delRes = deletePackage('pkg_test_1');
  assert.equal(delRes.success, true);

  const packages = getStoredPackages();
  assert.equal(packages.length, 1);
  assert.notEqual(packages[0].id, 'pkg_test_1');
});

test('storage handles corrupt JSON in localStorage without throwing', () => {
  window.localStorage.setItem(STORAGE_KEYS.PACKAGES, 'INVALID_CORRUPT_JSON_{{]');
  const packages = getStoredPackages();
  assert.deepEqual(packages, []);
});

test('school profile can be saved and retrieved', () => {
  const profile: SchoolProfile = {
    schoolName: 'MIN 2 Banyuwangi',
    npsnOrNsm: '111235100002',
    address: 'Jl. Melati No. 5',
    village: 'Genteng',
    subdistrict: 'Genteng',
    city: 'Banyuwangi',
    province: 'Jawa Timur',
    principalName: 'Drs. H. Sholihin, M.Pd.I',
    teacherName: 'Siti Aminah, S.Pd',
    updatedAt: new Date().toISOString(),
  };

  const res = saveSchoolProfile(profile);
  assert.equal(res.success, true);

  const loaded = getSchoolProfile();
  assert.ok(loaded);
  assert.equal(loaded?.schoolName, 'MIN 2 Banyuwangi');
});

test('export and import data functionality works properly', () => {
  const exported = exportAllData();
  assert.ok(exported.includes('MIN 2 Banyuwangi'));

  // Clear data
  clearAllData();
  assert.deepEqual(getStoredPackages(), []);
  assert.equal(getSchoolProfile(), null);

  // Restore
  const importRes = importAllData(exported);
  assert.equal(importRes.success, true);
  assert.equal(getSchoolProfile()?.schoolName, 'MIN 2 Banyuwangi');
});
