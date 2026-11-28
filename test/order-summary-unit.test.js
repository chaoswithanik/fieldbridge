import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizePortions } from '../src/lib/order-summary.js';
const portion = (status, quantity, totalCost = '100.00') => ({ status, quantity, totalCost });
test('historical rejections do not inflate the current replacement gap or payable cost', () => {
  const summary = summarizePortions(
    [
      portion('accepted', '600.000', '12000.00'),
      portion('rejected', '400.000', '8000.00'),
      portion('rejected', '400.000', '9000.00'),
      portion('pending', '150.000', '3500.00'),
    ],
    '1000.000',
    '1000.000',
  );
  assert.equal(summary.rejectedQuantity, '800.000');
  assert.equal(summary.replacementNeededQuantity, '250.000');
  assert.equal(summary.currentQuantity, '750.000');
  assert.equal(summary.currentCost, '15500.00');
  assert.equal(summary.status, 'awaiting_response');
});
test('accepted replacements restore an accepted order while retaining rejected history', () => {
  const summary = summarizePortions(
    [
      portion('accepted', '600.000'),
      portion('rejected', '400.000'),
      portion('accepted', '400.000'),
    ],
    '1000.000',
  );
  assert.equal(summary.status, 'accepted');
  assert.equal(summary.replacementNeededQuantity, '0.000');
  assert.equal(summary.rejectedQuantity, '400.000');
});
test('replacements cover the original order rather than the unmet part of an initially partial requirement', () => {
  const summary = summarizePortions(
    [portion('accepted', '500.000'), portion('rejected', '300.000')],
    '1000.000',
    '800.000',
  );
  assert.equal(summary.unfulfilledQuantity, '500.000');
  assert.equal(summary.replacementNeededQuantity, '300.000');
  const withoutRejection = summarizePortions(
    [portion('pending', '800.000')],
    '1000.000',
    '800.000',
  );
  assert.equal(withoutRejection.replacementNeededQuantity, '0.000');
});
test('quantities above the original order cannot produce negative replacement gaps', () => {
  const summary = summarizePortions(
    [portion('rejected', '100.000'), portion('accepted', '120.000')],
    '100.000',
  );
  assert.equal(summary.status, 'accepted');
  assert.equal(summary.replacementNeededQuantity, '0.000');
  assert.equal(summary.unfulfilledQuantity, '0.000');
});

test('completion covers the ordered quantity, includes replacements, and excludes unresolved portions', () => {
  const finished = (quantity) => ({ ...portion('accepted', quantity), progress: 'completed' });
  const status = (...portions) => summarizePortions(portions, '1000.000', '800.000').status;
  assert.equal(status(finished('800.000')), 'completed');
  assert.equal(status(finished('600.000'), portion('rejected', '200.000')), 'partially_accepted');
  assert.equal(status(finished('600.000'), portion('rejected', '200.000'), finished('200.000')), 'completed');
  assert.equal(status(finished('800.000'), portion('pending', '50.000')), 'awaiting_response');
  assert.equal(status(finished('800.000'), portion('accepted', '50.000')), 'accepted');
  assert.equal(status(portion('rejected', '800.000')), 'rejected');
});
