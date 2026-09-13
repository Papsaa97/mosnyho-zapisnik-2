/**
 * Sequential document numbering for handover protocols (PR-YYYY/XXX) and
 * invoices (VF-YYYY/XXX).
 */

/**
 * Finds the highest existing sequence number for a given prefix + year among
 * a list of already-issued document numbers, and returns the next one
 * (zero-padded to 3 digits, e.g. "VF-2026/029").
 *
 * Only numbers matching the exact prefix and year are considered, so the
 * sequence naturally resets to 001 once the calendar year rolls over –
 * no explicit year-tracking/reset logic is needed.
 */
export function getNextDocumentNumber(
  prefix: string,
  year: number,
  existingNumbers: Array<string | undefined | null>
): string {
  const pattern = new RegExp(`^${prefix}-${year}/(\\d+)$`);
  let maxSeq = 0;

  for (const num of existingNumbers) {
    if (!num) continue;
    const match = num.trim().match(pattern);
    if (!match) continue;
    const seq = parseInt(match[1], 10);
    if (Number.isFinite(seq) && seq > maxSeq) {
      maxSeq = seq;
    }
  }

  const nextSeq = maxSeq + 1;
  return `${prefix}-${year}/${String(nextSeq).padStart(3, '0')}`;
}
