import { scaledDecimal, decimalString } from './collective-matching.js';
export function summarizePortions(portions, requested, originallyOrdered = requested) {
  const sums = { accepted: 0n, pending: 0n, rejected: 0n };
  let currentCost = 0n;
  for (const portion of portions) {
    sums[portion.status] += scaledDecimal(portion.quantity, 3);
    if (portion.status !== 'rejected') currentCost += scaledDecimal(portion.totalCost, 2);
  }
  const active = sums.accepted + sums.pending,
    target = scaledDecimal(originallyOrdered, 3);
  const missing = target > active ? target - active : 0n;
  const status =
    sums.pending > 0n
      ? 'awaiting_response'
      : sums.accepted === 0n
        ? 'rejected'
        : missing > 0n
          ? 'partially_accepted'
          : 'accepted';
  return {
    status,
    acceptedQuantity: decimalString(sums.accepted, 3),
    pendingQuantity: decimalString(sums.pending, 3),
    rejectedQuantity: decimalString(sums.rejected, 3),
    unfulfilledQuantity: decimalString(
      scaledDecimal(requested, 3) > sums.accepted
        ? scaledDecimal(requested, 3) - sums.accepted
        : 0n,
      3,
    ),
    currentQuantity: decimalString(active, 3),
    currentCost: decimalString(currentCost, 2),
    replacementNeededQuantity: decimalString(sums.rejected > 0n ? missing : 0n, 3),
  };
}
