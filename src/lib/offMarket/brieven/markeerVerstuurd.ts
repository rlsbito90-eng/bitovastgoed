// Hulpfunctie: bereken follow-up deadline op basis van postdatum.
// Follow-up = postdatum + 21 dagen (vaste regel binnen Bito-brievenflow).

/**
 * @param postdatum YYYY-MM-DD (lokale dag)
 * @returns YYYY-MM-DD voor de opvolgdeadline
 */
export function berekenFollowUpDeadline(postdatum: string, dagen = 21): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(postdatum)) {
    throw new Error('Postdatum moet in YYYY-MM-DD formaat staan');
  }
  // Gebruik UTC om DST-shifts te vermijden.
  const d = new Date(`${postdatum}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + dagen);
  return d.toISOString().slice(0, 10);
}
