import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareBuyerDocuments } from '../src/services/buyer-documents.js';

const pdf = (text = 'business document') => ({
  mimetype: 'application/pdf',
  buffer: Buffer.from(`%PDF-1.7\n${text}`),
});

test('buyer documents require at least one supported, typed document and permit multiple uploads', async () => {
  await assert.rejects(
    prepareBuyerDocuments([], [], { required: true }),
    (error) => error.status === 422 && Boolean(error.fields.documents),
  );
  const documents = await prepareBuyerDocuments(
    [pdf('trade'), pdf('tax')],
    ['trade_license', 'etin_certificate'],
    { required: true },
  );
  assert.deepEqual(
    documents.map((document) => [document.documentType, document.contentType]),
    [
      ['trade_license', 'application/pdf'],
      ['etin_certificate', 'application/pdf'],
    ],
  );
  await assert.rejects(
    prepareBuyerDocuments([pdf()], ['not-a-document']),
    (error) => error.status === 422 && Boolean(error.fields.documents),
  );
  await assert.rejects(
    prepareBuyerDocuments([{ mimetype: 'application/pdf', buffer: Buffer.from('not a PDF') }], [
      'trade_license',
    ]),
    (error) => error.status === 422 && Boolean(error.fields.documents),
  );
});
