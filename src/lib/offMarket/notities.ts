// Splits een vrije notitietekst in dossiernotities (menselijk) en
// technische import-/systeem-regels. Auto-import en parser-info worden
// herkend aan de bekende prefix-patronen die de normalisatie-edgefunction
// gebruikt: regels die beginnen met `[auto-import …]` of `[auto-import]`
// horen bij Technisch, de rest is een menselijke notitie.
export interface GesplitsteNotities {
  dossier: string;
  technisch: string;
}

const TECHNISCH_PATROON = /^\s*\[auto-import\b/i;

export function splitsNotities(notities: string | null | undefined): GesplitsteNotities {
  if (!notities || !notities.trim()) return { dossier: '', technisch: '' };
  const dossier: string[] = [];
  const technisch: string[] = [];
  for (const regel of notities.split(/\r?\n/)) {
    if (TECHNISCH_PATROON.test(regel)) technisch.push(regel);
    else dossier.push(regel);
  }
  return {
    dossier: dossier.join('\n').trim(),
    technisch: technisch.join('\n').trim(),
  };
}
