import test from 'node:test';
import assert from 'node:assert/strict';
import questionsHandler, { maxDuration as qMaxDuration } from './generate-questions.ts';
import imageHandler, { maxDuration as imgMaxDuration } from './generate-question-image.ts';

test('Vercel serverless handlers export maxDuration 60', () => {
  assert.equal(qMaxDuration, 60, 'generate-questions must allow up to 60 seconds execution on Vercel');
  assert.equal(imgMaxDuration, 60, 'generate-question-image must allow up to 60 seconds execution on Vercel');
  assert.equal(typeof questionsHandler, 'function', 'Default export must be a function handler');
  assert.equal(typeof imageHandler, 'function', 'Default export must be a function handler');
});

test('generate-questions handler processes OPTIONS CORS preflight', async () => {
  let statusCode = 0;
  const headers: Record<string, string> = {};

  const mockReq = { method: 'OPTIONS' };
  const mockRes = {
    setHeader(key: string, val: string) {
      headers[key] = val;
    },
    status(code: number) {
      statusCode = code;
      return {
        json() {},
      };
    },
    end() {},
  };

  await questionsHandler(mockReq, mockRes);
  assert.equal(statusCode, 204);
  assert.equal(headers['Access-Control-Allow-Origin'], '*');
});

test('generate-questions handler handles invalid payload safely without throwing', async () => {
  let statusCode = 0;
  let responseData: any = null;

  const mockReq = {
    method: 'POST',
    body: { subject: '', grade: 4, topic: '' },
  };
  const mockRes = {
    setHeader() {},
    status(code: number) {
      statusCode = code;
      return {
        json(data: any) {
          responseData = data;
        },
      };
    },
    end() {},
  };

  await questionsHandler(mockReq, mockRes);
  assert.equal(statusCode, 400);
  assert.equal(responseData?.success, false);
  assert.match(responseData?.error, /Mata pelajaran wajib diisi/);
  assert.notEqual(responseData?.error, '[object Object]');
  assert.ok(responseData?.requestId, 'Harus menyertakan requestId');
});

test('generate-questions handler catches any fatal crash and returns safe 500 JSON', async () => {
  let statusCode = 0;
  let responseData: any = null;

  // Passing a malformed request that causes error
  const mockReq = {
    method: 'POST',
    get body() {
      throw new Error('Fatal stream corruption error');
    },
  };
  const mockRes = {
    setHeader() {},
    status(code: number) {
      statusCode = code;
      return {
        json(data: any) {
          responseData = data;
        },
      };
    },
    end() {},
  };

  // Must not throw an unhandled exception (which causes FUNCTION_INVOCATION_FAILED)
  await questionsHandler(mockReq, mockRes);
  assert.equal(statusCode, 500);
  assert.equal(responseData?.success, false);
  assert.ok(responseData?.requestId);
  assert.match(responseData?.error, /Fatal stream corruption error/);
  assert.notEqual(responseData?.error, '[object Object]');
});

test('generate-question-image handler processes OPTIONS and validates input safely', async () => {
  let statusCode = 0;
  let responseData: any = null;

  // 1. Test OPTIONS preflight
  const mockOptionsReq = { method: 'OPTIONS' };
  const mockOptionsRes = {
    setHeader() {},
    status(code: number) {
      statusCode = code;
      return { json() {} };
    },
    end() {},
  };
  await imageHandler(mockOptionsReq, mockOptionsRes);
  assert.equal(statusCode, 204);

  // 2. Test empty prompt validation
  const mockEmptyReq = {
    method: 'POST',
    body: { prompt: '' },
  };
  const mockEmptyRes = {
    setHeader() {},
    status(code: number) {
      statusCode = code;
      return {
        json(data: any) {
          responseData = data;
        },
      };
    },
    end() {},
  };
  await imageHandler(mockEmptyReq, mockEmptyRes);
  assert.equal(statusCode, 400);
  assert.equal(responseData?.success, false);
  assert.match(responseData?.error, /wajib diisi/i);
});

test('api/status handler reports API health transparently without leaking secrets', async () => {
  const statusHandler = (await import('./status.ts')).default;
  const originalKey = process.env.GEMINI_API_KEY;

  try {
    // 1. Uji saat GEMINI_API_KEY tidak dikonfigurasi
    delete process.env.GEMINI_API_KEY;

    let statusCode = 0;
    let responseData: any = null;

    const mockReq = { method: 'GET' };
    const mockRes = {
      setHeader() {},
      status(code: number) {
        statusCode = code;
        return {
          json(data: any) {
            responseData = data;
          },
        };
      },
      end() {},
    };

    await statusHandler(mockReq, mockRes);
    assert.equal(statusCode, 200);
    assert.equal(responseData?.success, true);
    assert.equal(responseData?.status, 'api_key_missing');
    assert.equal(responseData?.connected, false);
    assert.match(responseData?.message, /GEMINI_API_KEY belum dikonfigurasi/);
    assert.ok(responseData?.tips, 'Harus memberikan tips panduan yang jelas bagi guru');

    // 2. Uji saat GEMINI_API_KEY dikonfigurasi
    process.env.GEMINI_API_KEY = 'test-dummy-api-key-for-testing';

    statusCode = 0;
    responseData = null;

    await statusHandler(mockReq, mockRes);
    assert.equal(statusCode, 200);
    assert.equal(responseData?.success, true);
    assert.equal(responseData?.status, 'ready');
    assert.equal(responseData?.connected, true);
    assert.ok(responseData?.model, 'Harus mencantumkan nama model yang digunakan');

    // Keamanan: Pastikan isi API key asli TIDAK PERNAH bocor di respons
    const serializedResponse = JSON.stringify(responseData);
    assert.equal(serializedResponse.includes('test-dummy-api-key-for-testing'), false);
  } finally {
    if (originalKey) {
      process.env.GEMINI_API_KEY = originalKey;
    } else {
      delete process.env.GEMINI_API_KEY;
    }
  }
});

