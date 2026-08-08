export type ProductiekernBlokkadecategorie =
  | 'productiecontract'
  | 'schema_proef'
  | 'concurrency_proef'
  | 'beveiliging'
  | 'repository'
  | 'documentproductie'
  | 'regressie'
  | 'akkoord';

export interface ProductiekernBlokkadeBewijs {
  actueleProductieDdlGeverifieerd: boolean;
  actueleProductieRlsGeverifieerd: boolean;
  schemaProefGroen: boolean;
  concurrencyProefGroen: boolean;
  rlsPoliciesEnGrantsGetest: boolean;
  supabaseRepositoryGeimplementeerd: boolean;
  documentproductieGeimplementeerd: boolean;
  volledigeRegressiesuiteGroen: boolean;
  explicietProductieakkoord: boolean;
}

export interface ProductiekernOpenBlokkade {
  categorie: ProductiekernBlokkadecategorie;
  omschrijving: string;
  vereistVoor: 'technische_review' | 'merge' | 'productie';
}

export interface ProductiekernBlokkadeOverzicht {
  open: ProductiekernOpenBlokkade[];
  gereedVoorTechnischeReview: boolean;
  gereedVoorMerge: boolean;
  gereedVoorProductie: boolean;
}

const DEFINITIES: Array<{
  veld: keyof ProductiekernBlokkadeBewijs;
  blokkade: ProductiekernOpenBlokkade;
}> = [
  {
    veld: 'actueleProductieDdlGeverifieerd',
    blokkade: {
      categorie: 'productiecontract',
      omschrijving: 'Actuele productie-DDL is niet read-only geverifieerd.',
      vereistVoor: 'technische_review',
    },
  },
  {
    veld: 'actueleProductieRlsGeverifieerd',
    blokkade: {
      categorie: 'productiecontract',
      omschrijving: 'Actuele productie-RLS is niet read-only geverifieerd.',
      vereistVoor: 'technische_review',
    },
  },
  {
    veld: 'schemaProefGroen',
    blokkade: {
      categorie: 'schema_proef',
      omschrijving: 'De geïsoleerde schema-only rollbackproef is niet groen.',
      vereistVoor: 'merge',
    },
  },
  {
    veld: 'concurrencyProefGroen',
    blokkade: {
      categorie: 'concurrency_proef',
      omschrijving: 'De geïsoleerde concurrencyproef is niet groen.',
      vereistVoor: 'merge',
    },
  },
  {
    veld: 'rlsPoliciesEnGrantsGetest',
    blokkade: {
      categorie: 'beveiliging',
      omschrijving: 'Definitieve RLS-policies en gerichte grants zijn niet getest.',
      vereistVoor: 'merge',
    },
  },
  {
    veld: 'supabaseRepositoryGeimplementeerd',
    blokkade: {
      categorie: 'repository',
      omschrijving: 'De Supabase-repository achter de gesloten activatiepoort ontbreekt.',
      vereistVoor: 'merge',
    },
  },
  {
    veld: 'documentproductieGeimplementeerd',
    blokkade: {
      categorie: 'documentproductie',
      omschrijving: 'Documentgeneratie, batch-, print- en postregistratie zijn niet volledig geïmplementeerd.',
      vereistVoor: 'merge',
    },
  },
  {
    veld: 'volledigeRegressiesuiteGroen',
    blokkade: {
      categorie: 'regressie',
      omschrijving: 'De volledige regressiesuite is niet groen.',
      vereistVoor: 'merge',
    },
  },
  {
    veld: 'explicietProductieakkoord',
    blokkade: {
      categorie: 'akkoord',
      omschrijving: 'Afzonderlijk expliciet productieakkoord ontbreekt.',
      vereistVoor: 'productie',
    },
  },
];

export function bepaalProductiekernOpenBlokkades(
  bewijs: ProductiekernBlokkadeBewijs,
): ProductiekernBlokkadeOverzicht {
  const open = DEFINITIES
    .filter(({ veld }) => !bewijs[veld])
    .map(({ blokkade }) => ({ ...blokkade }));

  const blokkeertTechnischeReview = open.some(
    ({ vereistVoor }) => vereistVoor === 'technische_review',
  );
  const blokkeertMerge = open.some(
    ({ vereistVoor }) => vereistVoor === 'technische_review' || vereistVoor === 'merge',
  );

  return {
    open,
    gereedVoorTechnischeReview: !blokkeertTechnischeReview,
    gereedVoorMerge: !blokkeertMerge,
    gereedVoorProductie: open.length === 0,
  };
}
