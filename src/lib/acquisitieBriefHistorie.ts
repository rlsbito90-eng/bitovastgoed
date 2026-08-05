import type { AcquisitieDossierContext } from './acquisitieDossierContext';

export type AcquisitieBriefGebeurtenisType =
  | 'concept_aangemaakt'
  | 'pdf_gegenereerd'
  | 'geprint'
  | 'verzonden'
  | 'reactie_ontvangen';

export interface AcquisitieBriefGebeurtenisBron {
  id: string;
  type: AcquisitieBriefGebeurtenisType;
  datum: string;
  briefKenmerk?: string | null;
  geadresseerde?: string | null;
  pdfBestandsnaam?: string | null;
  verzendwijze?: string | null;
  toelichting?: string | null;
}

export interface AcquisitieBriefHistorieItem {
  id: string;
  type: AcquisitieBriefGebeurtenisType;
  label: string;
  datum: string;
  briefKenmerk: string | null;
  geadresseerde: string | null;
  pdfBestandsnaam: string | null;
  verzendwijze: string | null;
  toelichting: string | null;
}

export interface AcquisitieBriefDossierBron {
  briefStatus?: string | null;
  briefKenmerk?: string | null;
  briefGeadresseerde?: string | null;
  briefVerzendwijze?: string | null;
  briefVerzondenOp?: string | null;
  gebeurtenissen?: AcquisitieBriefGebeurtenisBron[] | null;
}

export interface AcquisitieBriefDossierReadModel {
  dossier: AcquisitieDossierContext;
  huidigKenmerk: string | null;
  huidigeGeadresseerde: string | null;
  huidigeVerzendwijze: string | null;
  laatstVerzondenOp: string | null;
  heeftPdfRegistratie: boolean;
  heeftPrintregistratie: boolean;
  heeftVerzendregistratie: boolean;
  historie: AcquisitieBriefHistorieItem[];
  veiligheidsmelding: string;
}

const LABELS: Record<AcquisitieBriefGebeurtenisType, string> = {
  concept_aangemaakt: 'Concept aangemaakt',
  pdf_gegenereerd: 'PDF gegenereerd',
  geprint: 'Geprint',
  verzonden: 'Verzonden',
  reactie_ontvangen: 'Reactie ontvangen',
};

const schoon = (waarde?: string | null): string | null => {
  const resultaat = waarde?.trim();
  return resultaat ? resultaat : null;
};

export function bouwAcquisitieBriefDossierReadModel(
  dossier: AcquisitieDossierContext,
  bron: AcquisitieBriefDossierBron,
): AcquisitieBriefDossierReadModel {
  const gebeurtenissen = Array.isArray(bron.gebeurtenissen) ? bron.gebeurtenissen : [];
  const historie = gebeurtenissen
    .filter((item) => Boolean(item.id?.trim()) && Boolean(item.datum?.trim()))
    .map((item): AcquisitieBriefHistorieItem => ({
      id: item.id,
      type: item.type,
      label: LABELS[item.type],
      datum: item.datum,
      briefKenmerk: schoon(item.briefKenmerk),
      geadresseerde: schoon(item.geadresseerde),
      pdfBestandsnaam: schoon(item.pdfBestandsnaam),
      verzendwijze: schoon(item.verzendwijze),
      toelichting: schoon(item.toelichting),
    }))
    .sort((a, b) => b.datum.localeCompare(a.datum));

  const status = schoon(bron.briefStatus)?.toLowerCase();
  const laatstVerzondenOp = schoon(bron.briefVerzondenOp)
    ?? historie.find((item) => item.type === 'verzonden')?.datum
    ?? null;

  return {
    dossier,
    huidigKenmerk: schoon(bron.briefKenmerk),
    huidigeGeadresseerde: schoon(bron.briefGeadresseerde),
    huidigeVerzendwijze: schoon(bron.briefVerzendwijze),
    laatstVerzondenOp,
    heeftPdfRegistratie: historie.some((item) => item.type === 'pdf_gegenereerd'),
    heeftPrintregistratie: historie.some((item) => item.type === 'geprint'),
    heeftVerzendregistratie: Boolean(laatstVerzondenOp || status === 'verzonden' || status === 'reactie_ontvangen'),
    historie,
    veiligheidsmelding: 'Dit dossier toont uitsluitend geregistreerde historie en genereert, print of verzendt niets automatisch.',
  };
}
