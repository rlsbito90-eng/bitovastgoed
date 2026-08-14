// Pure parser for owner postal addresses in the official Kadaster PDF text.
// No OCR, no network calls and no persistence of full PDF text.

export interface PdfOwnerHint {
  id: string;
  naam: string;
  alternatieveNamen?: string[];
}

export interface PdfOwnerAdresMatch {
  ownerId: string;
  matchedName: string;
  adres: string;
  postcode: string;
  plaats: string;
  confidence: number;
}

interface AddressCandidate {
  lineIndex: number;
  adres: string;
  postcode: string;
  plaats: string;
}

function norm(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('nl-NL')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function isPlausibleStreetLine(value: string): boolean {
  const s = cleanLine(value);
  if (!s || s.length > 100) return false;
  if (/^(adres|woonadres|correspondentieadres|vestigingsadres)\s*:?$/i.test(s)) return false;
  return /\d/.test(s) && /[a-zà-öø-ÿ]/i.test(s);
}

function addressCandidates(lines: string[]): AddressCandidate[] {
  const out: AddressCandidate[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = cleanLine(lines[i]);
    if (!line) continue;

    const full = line.match(/^(.+?\s+\d{1,6}[a-z]?(?:[-\s][a-z0-9]{1,8})?)\s*,?\s+(\d{4})\s*([a-z]{2})\s+(.{2,60})$/i);
    if (full && isPlausibleStreetLine(full[1])) {
      const postcode = `${full[2]}${full[3].toUpperCase()}`;
      const kandidaat: AddressCandidate = {
        lineIndex: i,
        adres: cleanLine(full[1]),
        postcode,
        plaats: cleanLine(full[4].replace(/[.,;]+$/, '')),
      };
      const key = `${norm(kandidaat.adres)}|${postcode}|${norm(kandidaat.plaats)}`;
      if (!seen.has(key)) { seen.add(key); out.push(kandidaat); }
      continue;
    }

    const pc = line.match(/^(\d{4})\s*([a-z]{2})\s+(.{2,60})$/i);
    if (pc && i > 0) {
      const prev = cleanLine(lines[i - 1]);
      if (isPlausibleStreetLine(prev)) {
        const postcode = `${pc[1]}${pc[2].toUpperCase()}`;
        const kandidaat: AddressCandidate = {
          lineIndex: i,
          adres: prev,
          postcode,
          plaats: cleanLine(pc[3].replace(/[.,;]+$/, '')),
        };
        const key = `${norm(kandidaat.adres)}|${postcode}|${norm(kandidaat.plaats)}`;
        if (!seen.has(key)) { seen.add(key); out.push(kandidaat); }
      }
    }
  }
  return out;
}

function nameLines(lines: string[], aliases: string[], lastNameUnique: boolean): number[] {
  const aliasesNorm = aliases.map(norm).filter(Boolean);
  const lastNames = aliasesNorm.map((v) => v.split(' ').at(-1) ?? '').filter((v) => v.length >= 4);
  const hits: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = norm(lines[i]);
    if (!line) continue;
    if (aliasesNorm.some((a) => a.length >= 5 && line.includes(a))) {
      hits.push(i);
      continue;
    }
    if (lastNameUnique && lastNames.some((last) => line.includes(last))) hits.push(i);
  }
  return hits;
}

function hasAddressLabelNearby(lines: string[], index: number): boolean {
  const start = Math.max(0, index - 3);
  const end = Math.min(lines.length - 1, index + 1);
  for (let i = start; i <= end; i++) {
    if (/\b(woonadres|correspondentieadres|vestigingsadres|adres)\b/i.test(lines[i])) return true;
  }
  return false;
}

export function parseKadasterPdfOwnerAddresses(text: string, hints: PdfOwnerHint[]): PdfOwnerAdresMatch[] {
  const lines = text.split(/\r?\n/).map(cleanLine).filter(Boolean);
  if (!lines.length || !hints.length) return [];
  const addresses = addressCandidates(lines);
  if (!addresses.length) return [];

  const surnameCounts = new Map<string, number>();
  for (const hint of hints) {
    const n = norm(hint.naam);
    const last = n.split(' ').at(-1) ?? '';
    if (last) surnameCounts.set(last, (surnameCounts.get(last) ?? 0) + 1);
  }

  const matches: PdfOwnerAdresMatch[] = [];
  const usedAddressKeys = new Set<string>();
  for (const hint of hints) {
    const aliases = [hint.naam, ...(hint.alternatieveNamen ?? [])].filter(Boolean);
    const primaryNorm = norm(hint.naam);
    const last = primaryNorm.split(' ').at(-1) ?? '';
    const ownerLines = nameLines(lines, aliases, !!last && (surnameCounts.get(last) ?? 0) === 1);
    if (!ownerLines.length) continue;

    let best: { address: AddressCandidate; score: number } | null = null;
    for (const candidate of addresses) {
      const distance = Math.min(...ownerLines.map((idx) => Math.abs(candidate.lineIndex - idx)));
      if (distance > 10) continue;
      let score = 100 - distance * 8;
      if (hasAddressLabelNearby(lines, candidate.lineIndex)) score += 8;
      if (candidate.lineIndex >= Math.min(...ownerLines)) score += 4;
      if (!best || score > best.score) best = { address: candidate, score };
    }
    if (!best || best.score < 52) continue;

    const key = `${norm(best.address.adres)}|${best.address.postcode}|${norm(best.address.plaats)}`;
    if (usedAddressKeys.has(key) && ownerLines.length === 1) continue;
    usedAddressKeys.add(key);

    matches.push({
      ownerId: hint.id,
      matchedName: hint.naam,
      adres: best.address.adres,
      postcode: best.address.postcode,
      plaats: best.address.plaats,
      confidence: Math.min(99, Math.max(52, best.score)),
    });
  }

  return matches;
}
