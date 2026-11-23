import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateRequirement,
  onlyRequirementFields,
  requirementFields,
  requirementVersion,
} from '../src/lib/requirement-validation.js';

const requirement = {
  cropName: 'আমন ধান',
  quantity: '১০০০.১২৫',
  unit: 'kg',
  deliveryAddress: 'পরীক্ষার গুদাম, মিরপুর, ঢাকা',
};
test('purchase requirements normalize Bangla quantities and allow optional instructions', () => {
  assert.equal(validateRequirement(requirement).quantity, '1000.125');
  assert.equal(validateRequirement(requirement).instructions, null);
  assert.equal(
    validateRequirement({ ...requirement, instructions: '  বস্তায় দিন।  ' }).instructions,
    'বস্তায় দিন।',
  );
  assert.equal(
    validateRequirement({ ...requirement, quantity: '999999999.999' }).quantity,
    '999999999.999',
  );
  assert.equal(requirementVersion('১২'), 12);
});
test('purchase requirements enforce mandatory data, precision, positive stock and whole pieces', () => {
  for (const [key, value] of [
    ['cropName', ''],
    ['deliveryAddress', ''],
    ['quantity', '0'],
    ['quantity', '-1'],
    ['quantity', '1e3'],
    ['quantity', '0.0001'],
    ['quantity', '1000000000'],
    ['quantity', []],
    ['unit', 'invalid'],
    ['instructions', 'x'.repeat(2001)],
    ['instructions', {}],
  ])
    assert.throws(
      () => validateRequirement({ ...requirement, [key]: value }),
      (error) => error.status === 422 && Boolean(error.fields[key]),
    );
  assert.throws(
    () => validateRequirement({ ...requirement, unit: 'piece', quantity: '1.5' }),
    (error) => error.status === 422,
  );
});
test('buyers cannot assign ownership, counters, budgets or delivery deadlines', () => {
  for (const key of [
    'buyerId',
    'editCount',
    'editsRemaining',
    'status',
    'maxBudget',
    'expectedPrice',
    'deliveryDate',
  ])
    assert.throws(
      () => onlyRequirementFields({ ...requirement, [key]: 'injected' }, requirementFields),
      (error) => error.status === 422,
    );
  for (const input of [null, [], 'invalid'])
    assert.throws(
      () => onlyRequirementFields(input, requirementFields),
      (error) => error.status === 422,
    );
  for (const version of [undefined, 0, -1, '1e2', '4294967295'])
    assert.throws(
      () => requirementVersion(version),
      (error) => error.status === 422,
    );
});
