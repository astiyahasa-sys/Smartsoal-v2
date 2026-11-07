import test from 'node:test';
import assert from 'node:assert/strict';
import { extractErrorMessage, parseErrorDetails } from './errorParser.ts';

test('extractErrorMessage never returns [object Object]', () => {
  // Test 1: Plain Object with code & message
  const obj1 = { code: 'FUNCTION_INVOCATION_TIMEOUT', message: 'Function timed out' };
  const res1 = extractErrorMessage(obj1);
  assert.notEqual(res1, '[object Object]');
  assert.match(res1, /Waktu pemrosesan di server Vercel habis/);

  // Test 2: Vercel standard error payload
  const vercelTimeout = {
    error: {
      code: 'FUNCTION_INVOCATION_TIMEOUT',
    },
  };
  const res2 = extractErrorMessage(vercelTimeout);
  assert.notEqual(res2, '[object Object]');
  assert.match(res2, /Waktu pemrosesan di server Vercel habis/);

  // Test 3: Raw Error instance created with an object (the exact cause of [object Object])
  const badErrorInstance = new Error({ message: 'Internal failure' } as any);
  const res3 = extractErrorMessage(badErrorInstance);
  assert.notEqual(res3, '[object Object]');
  assert.ok(res3.length > 5);

  // Test 4: Empty object
  const emptyObj = {};
  const res4 = extractErrorMessage(emptyObj);
  assert.notEqual(res4, '[object Object]');
  assert.ok(res4.length > 5);

  // Test 5: Null and undefined
  assert.notEqual(extractErrorMessage(null), '[object Object]');
  assert.notEqual(extractErrorMessage(undefined), '[object Object]');
});

test('extractErrorMessage correctly translates Vercel and Google AI error codes', () => {
  // Rate limit / Quota exceeded
  const quotaObj = {
    error: {
      code: 429,
      status: 'RESOURCE_EXHAUSTED',
      message: 'Quota exceeded for quota metric',
    },
  };
  const quotaMsg = extractErrorMessage(quotaObj);
  assert.match(quotaMsg, /Batas kuota harian atau frekuensi Gemini API terlampaui/);

  // Stringified JSON error from GoogleGenAI SDK
  const jsonErrorStr = JSON.stringify({
    error: {
      code: 429,
      status: 'RESOURCE_EXHAUSTED',
      message: 'Resource has been exhausted',
    },
  });
  const jsonResult = extractErrorMessage(jsonErrorStr);
  assert.match(jsonResult, /Batas kuota/);

  // Invalid API Key / Auth failure
  const authObj = {
    error: {
      code: 401,
      status: 'UNAUTHENTICATED',
      message: 'API_KEY_INVALID',
    },
  };
  const authMsg = extractErrorMessage(authObj);
  assert.match(authMsg, /Kunci API Gemini tidak valid/);

  // High demand / 503
  const busyObj = { status: 503, message: 'The model is overloaded' };
  const busyMsg = extractErrorMessage(busyObj);
  assert.match(busyMsg, /Layanan Google AI saat ini sedang mengalami lonjakan beban/);
});

test('extractErrorMessage redacts API keys and sensitive Linux paths', () => {
  const leakStr = 'Failed at AIzaSyB_1234567890abcdefghijklmnopqrstu in /var/task/node_modules/handler.js';
  const sanitized = extractErrorMessage(leakStr);
  assert.ok(!sanitized.includes('AIzaSyB_1234567890abcdefghijklmnopqrstu'));
  assert.ok(sanitized.includes('[REDACTED_API_KEY]'));
  assert.ok(!sanitized.includes('/var/task/node_modules'));
});

test('parseErrorDetails accurately maps categories and HTTP statuses', () => {
  const timeoutDetails = parseErrorDetails({ code: 'FUNCTION_INVOCATION_TIMEOUT' });
  assert.equal(timeoutDetails.category, 'TIMEOUT');
  assert.equal(timeoutDetails.statusCode, 504);

  const quotaDetails = parseErrorDetails({ code: 'RESOURCE_EXHAUSTED' });
  assert.equal(quotaDetails.category, 'QUOTA');
  assert.equal(quotaDetails.statusCode, 429);

  const authDetails = parseErrorDetails({ code: 'API_KEY_INVALID' });
  assert.equal(authDetails.category, 'AUTH');
  assert.equal(authDetails.statusCode, 401);

  // Unexpected model name format
  const modelErrDetails = parseErrorDetails({
    message: '* GenerateContentRequest.model: unexpected model name format',
  });
  assert.equal(modelErrDetails.category, 'VALIDATION');
  assert.equal(modelErrDetails.statusCode, 400);
  assert.match(modelErrDetails.message, /Format nama model Gemini pada server tidak valid/);
});
