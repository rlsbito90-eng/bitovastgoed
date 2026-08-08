export const PRODUCTIEKERN_TOEGESTANE_PADPREFIXEN = [
  'src/lib/offMarket/acquisitie/',
  'supabase/migration-drafts/20260806_acquisitie_productiekern',
  'docs/off-market/ACQUISITIE-PRODUCTIEKERN',
  'docs/off-market/BUILD-A-IMPLEMENTATIEGRENZEN.md',
] as const;

export interface ProductiekernReviewScopeResultaat {
  binnenScope: boolean;
  buitenScopeBestanden: string[];
  verbodenDomeinen: string[];
  blokkades: string[];
}

const VERBODEN_DOMEINPATRONEN: Array<[string, RegExp]> = [
  ['BAG', /(?:^|\/)bag(?:\/|_|\.)/i],
  ['Kadaster', /kadaster/i],
  ['Vastgoedkansen', /vastgoedkansen/i],
  ['Objectidentiteit-backfill', /objectIdentity\/.*backfill/i],
  ['Lovable', /lovable/i],
];

export function beoordeelProductiekernReviewScope(
  gewijzigdeBestanden: readonly string[],
): ProductiekernReviewScopeResultaat {
  const buitenScopeBestanden = gewijzigdeBestanden.filter(
    (bestand) => !PRODUCTIEKERN_TOEGESTANE_PADPREFIXEN.some(
      (prefix) => bestand.startsWith(prefix),
    ),
  );
  const verbodenDomeinen = Array.from(new Set(
    gewijzigdeBestanden.flatMap((bestand) =>
      VERBODEN_DOMEINPATRONEN
        .filter(([, patroon]) => patroon.test(bestand))
        .map(([domein]) => domein),
    ),
  ));
  const blokkades: string[] = [];

  if (buitenScopeBestanden.length > 0) {
    blokkades.push(
      `Bestanden buiten de productiekernscope: ${buitenScopeBestanden.join(', ')}.`,
    );
  }
  if (verbodenDomeinen.length > 0) {
    blokkades.push(
      `Verboden of afzonderlijk te diagnosticeren domeinen geraakt: ${verbodenDomeinen.join(', ')}.`,
    );
  }

  return {
    binnenScope: blokkades.length === 0,
    buitenScopeBestanden,
    verbodenDomeinen,
    blokkades,
  };
}
