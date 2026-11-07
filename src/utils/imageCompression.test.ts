import test from 'node:test';
import assert from 'node:assert/strict';
import { extractBase64FromDataUrl, dataUrlToUint8Array } from './imageCompression.ts';

test('extractBase64FromDataUrl correctly extracts base64 string', () => {
  const dummyBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const dataUrl = `data:image/png;base64,${dummyBase64}`;

  const extracted = extractBase64FromDataUrl(dataUrl);
  assert.equal(extracted, dummyBase64);

  // Raw base64 string
  const rawExtracted = extractBase64FromDataUrl(dummyBase64);
  assert.equal(rawExtracted, dummyBase64);

  // Invalid data URL
  assert.equal(extractBase64FromDataUrl('invalid'), null);
  assert.equal(extractBase64FromDataUrl(''), null);
});

test('dataUrlToUint8Array converts valid base64 data to byte array', () => {
  const dummyBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const dataUrl = `data:image/png;base64,${dummyBase64}`;

  const bytes = dataUrlToUint8Array(dataUrl);
  assert.ok(bytes instanceof Uint8Array);
  assert.ok(bytes.length > 10);
  assert.equal(bytes[0], 0x89); // PNG Magic byte
  assert.equal(bytes[1], 0x50); // 'P'
  assert.equal(bytes[2], 0x4e); // 'N'
  assert.equal(bytes[3], 0x47); // 'G'
});

test('validateImageFile validates image types and size limits correctly', async () => {
  const { validateImageFile } = await import('./imageCompression.ts');

  // 1. Valid image types
  const validJpg = new Blob(['sample-jpeg-data'], { type: 'image/jpeg' });
  const validPng = new Blob(['sample-png-data'], { type: 'image/png' });
  const validWebp = new Blob(['sample-webp-data'], { type: 'image/webp' });

  assert.equal(validateImageFile(validJpg).isValid, true);
  assert.equal(validateImageFile(validPng).isValid, true);
  assert.equal(validateImageFile(validWebp).isValid, true);

  // 2. Oversized image (> 10MB)
  const oversizedBlob = {
    size: 11 * 1024 * 1024,
    type: 'image/jpeg',
  } as any;
  const oversizedRes = validateImageFile(oversizedBlob);
  assert.equal(oversizedRes.isValid, false);
  assert.match(oversizedRes.error || '', /terlalu besar/i);

  // 3. Unsupported mime type
  const pdfBlob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
  const pdfRes = validateImageFile(pdfBlob);
  assert.equal(pdfRes.isValid, false);
  assert.match(pdfRes.error || '', /tidak didukung/i);
});
