export interface WerkCrmActivatieBewijs {
  doelomgevingIsWerkdatabase: boolean;
  supabaseDoelKomtOvereen: boolean;
  schemaGeinstalleerd: boolean;
  rlsEnRechtenGeverifieerd: boolean;
  gerichteWorkflowtestsGroen: boolean;
  applicatiebuildGroen: boolean;
  duurzameDatabewaringBevestigd: boolean;
  explicietWerkakkoord: boolean;
}

export interface WerkCrmActivatieBesluit {
  lezenActief: boolean;
  schrijvenActief: boolean;
  ontbrekendBewijs: string[];
}

const WERKCRM_BEWIJS_LABELS: Array<[keyof WerkCrmActivatieBewijs, string]> = [
  ['doelomgevingIsWerkdatabase', 'De doelomgeving is niet expliciet als werk-CRM gemarkeerd.'],
  ['supabaseDoelKomtOvereen', 'De gekoppelde Supabase-omgeving komt niet overeen met het verwachte werk-CRM-doel.'],
  ['schemaGeinstalleerd', 'Het Acquisitieproductiekern-schema is niet aantoonbaar geïnstalleerd.'],
  ['rlsEnRechtenGeverifieerd', 'RLS en rechten van de werk-CRM zijn niet aantoonbaar geverifieerd.'],
  ['gerichteWorkflowtestsGroen', 'Gerichte workflowtests op de werk-CRM zijn niet groen.'],
  ['applicatiebuildGroen', 'De applicatiebuild voor de werk-CRM is niet groen.'],
  ['duurzameDatabewaringBevestigd', 'Duurzame databewaring en latere migratie zijn niet bevestigd.'],
  ['explicietWerkakkoord', 'Expliciet akkoord voor operationeel gebruik van de werk-CRM ontbreekt.'],
];

/**
 * Fail-closed activatiepoort voor een afzonderlijke, duurzame werk-CRM.
 *
 * Dit is nadrukkelijk NIET de productiepoort. Lezen en schrijven worden pas
 * samen vrijgegeven wanneer alle acht werk-CRM-bewijzen expliciet waar zijn.
 * Ontbrekende configuratie, een verkeerd Supabase-doel of gedeeltelijk bewijs
 * houdt de volledige Productiekern dicht.
 */
export function bepaalWerkCrmActivatie(
  bewijs: Partial<WerkCrmActivatieBewijs> | null | undefined,
): WerkCrmActivatieBesluit {
  const ontbrekendBewijs = WERKCRM_BEWIJS_LABELS
    .filter(([sleutel]) => bewijs?.[sleutel] !== true)
    .map(([, label]) => label);

  const actief = ontbrekendBewijs.length === 0;
  return {
    lezenActief: actief,
    schrijvenActief: actief,
    ontbrekendBewijs,
  };
}

export const werkCrmStandaardUitgeschakeld = bepaalWerkCrmActivatie(undefined);
