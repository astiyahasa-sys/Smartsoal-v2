import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getNeonConnectionString,
  isNeonConfigured,
  getSanitizedNeonEndpoint,
  checkNeonConnection,
  isAlreadyExistsError,
} from './neon.ts';
import {
  handleDbStatusApi,
  handlePackagesApi,
  handleSchoolProfileApi,
} from './neonHandlers.ts';

test('getNeonConnectionString membaca environment variable dengan benar', () => {
  const originalEnv = process.env.DATABASE_URL;
  try {
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;
    assert.equal(isNeonConfigured(), false);
    assert.equal(getNeonConnectionString(), null);

    process.env.DATABASE_URL = 'postgresql://user:pass@ep-test-1234.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';
    assert.equal(isNeonConfigured(), true);
    assert.equal(getNeonConnectionString(), process.env.DATABASE_URL);
  } finally {
    process.env.DATABASE_URL = originalEnv;
  }
});

test('getSanitizedNeonEndpoint mengekstrak host dan database tanpa membocorkan kata sandi', () => {
  const conn = 'postgresql://admin_user:SuperSecretPassword123@ep-royal-moon-567890.ap-southeast-1.aws.neon.tech/madrasahdb?sslmode=require';
  const info = getSanitizedNeonEndpoint(conn);
  assert.equal(info.host, 'ep-royal-moon-567890.ap-southeast-1.aws.neon.tech');
  assert.equal(info.database, 'madrasahdb');
});

test('checkNeonConnection mengembalikan status local_fallback saat DATABASE_URL kosong', async () => {
  const originalEnv = process.env.DATABASE_URL;
  const originalPostgres = process.env.POSTGRES_URL;
  try {
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;

    const status = await checkNeonConnection();
    assert.equal(status.configured, false);
    assert.equal(status.connected, false);
    assert.equal(status.provider, 'local');
    assert.ok(status.checkedAt);
  } finally {
    process.env.DATABASE_URL = originalEnv;
    process.env.POSTGRES_URL = originalPostgres;
  }
});

test('handleDbStatusApi mengembalikan JSON response dengan status koneksi', async () => {
  let statusCode = 0;
  let jsonPayload: any = null;
  const mockRes = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(data: any) {
      jsonPayload = data;
      return this;
    },
    setHeader() {
      return this;
    },
  };

  await handleDbStatusApi({}, mockRes);
  assert.equal(statusCode, 200);
  assert.ok(jsonPayload);
  assert.equal(jsonPayload.success, true);
});

test('handlePackagesApi mengembalikan local fallback saat Neon belum dikonfigurasi', async () => {
  const originalEnv = process.env.DATABASE_URL;
  const originalPostgres = process.env.POSTGRES_URL;
  try {
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;

    let statusCode = 0;
    let jsonPayload: any = null;
    const mockRes = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(data: any) {
        jsonPayload = data;
        return this;
      },
      setHeader() {
        return this;
      },
    };

    await handlePackagesApi({ method: 'GET' }, mockRes);
    assert.equal(statusCode, 200);
    assert.equal(jsonPayload.configured, false);
    assert.equal(jsonPayload.source, 'local_fallback');
  } finally {
    process.env.DATABASE_URL = originalEnv;
    process.env.POSTGRES_URL = originalPostgres;
  }
});

test('handleSchoolProfileApi mengembalikan local fallback saat Neon belum dikonfigurasi', async () => {
  const originalEnv = process.env.DATABASE_URL;
  const originalPostgres = process.env.POSTGRES_URL;
  try {
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;

    let statusCode = 0;
    let jsonPayload: any = null;
    const mockRes = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(data: any) {
        jsonPayload = data;
        return this;
      },
      setHeader() {
        return this;
      },
    };

    await handleSchoolProfileApi({ method: 'GET' }, mockRes);
    assert.equal(statusCode, 200);
    assert.equal(jsonPayload.configured, false);
    assert.equal(jsonPayload.source, 'local_fallback');
  } finally {
    process.env.DATABASE_URL = originalEnv;
    process.env.POSTGRES_URL = originalPostgres;
  }
});

test('isAlreadyExistsError mendeteksi error 23505 pg_type_typname_nsp_index dari Vercel/Postgres', () => {
  const vercelNeonError = {
    severity: 'ERROR',
    code: '23505',
    detail: 'Key (typname, typnamespace)=(packages, 2200) already exists.',
    constraint: 'pg_type_typname_nsp_index',
    routine: '_bt_check_unique',
  };

  assert.equal(isAlreadyExistsError(vercelNeonError), true);
  assert.equal(isAlreadyExistsError({ code: '42P07', message: 'relation "packages" already exists' }), true);
  assert.equal(isAlreadyExistsError({ code: '42710', message: 'type "packages" already exists' }), true);
  assert.equal(isAlreadyExistsError({ code: '28000', message: 'invalid password' }), false);
  assert.equal(isAlreadyExistsError(null), false);
});

