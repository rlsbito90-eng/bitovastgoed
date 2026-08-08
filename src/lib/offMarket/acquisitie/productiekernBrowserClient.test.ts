import { describe, expect, it } from 'vitest';

import { bepaalBrowserWerkCrmActivatieUitOmgeving } from './productiekernBrowserClient';

const volledig = {
  VITE_ACQUISITIE_PRODUCTIEKERN_MODUS: 'werkcrm',
  VITE_SUPABASE_URL: 'https://werkproject123.supabase.co',
  VITE_ACQUISITIE_PRODUCTIEKERN_WERKCRM_PROJECTREF: 'werkproject123',
  VITE_ACQUISITIE_PRODUCTIEKERN_SCHEMA_GEINSTALLEERD: 'true',
  VITE_ACQUISITIE_PRODUCTIEKERN_RLS_GEVERIFIEERD: 'true',
  VITE_ACQUISITIE_PRODUCTIEKERN_WORKFLOWTESTS_GROEN: 'true',
  VITE_ACQUISITIE_PRODUCTIEKERN_BUILD_GROEN: 'true',
  VITE_ACQUISITIE_PRODUCTIEKERN_DUURZAME_DATA: 'true',
  VITE_ACQUISITIE_PRODUCTIEKERN_WERKAKKOORD: 'true',
};

describe('Productiekern browser werk-CRM-poort', () => {
  it('blijft dicht zonder expliciete werk-CRM-modus', () => {
    const besluit = bepaalBrowserWerkCrmActivatieUitOmgeving({
      ...volledig,
      VITE_ACQUISITIE_PRODUCTIEKERN_MODUS: undefined,
    });

    expect(besluit.lezenActief).toBe(false);
    expect(besluit.schrijvenActief).toBe(false);
  });

  it('blijft dicht bij een verkeerde Supabase-projectref', () => {
    const besluit = bepaalBrowserWerkCrmActivatieUitOmgeving({
      ...volledig,
      VITE_SUPABASE_URL: 'https://anderproject.supabase.co',
    });

    expect(besluit.lezenActief).toBe(false);
    expect(besluit.schrijvenActief).toBe(false);
    expect(besluit.ontbrekendBewijs).toContain(
      'De gekoppelde Supabase-omgeving komt niet overeen met het verwachte werk-CRM-doel.',
    );
  });

  it('blijft dicht wanneer duurzame databewaring niet expliciet bewezen is', () => {
    const besluit = bepaalBrowserWerkCrmActivatieUitOmgeving({
      ...volledig,
      VITE_ACQUISITIE_PRODUCTIEKERN_DUURZAME_DATA: 'false',
    });

    expect(besluit.lezenActief).toBe(false);
    expect(besluit.schrijvenActief).toBe(false);
  });

  it('gaat uitsluitend open bij volledige expliciete werk-CRM-configuratie', () => {
    expect(bepaalBrowserWerkCrmActivatieUitOmgeving(volledig)).toEqual({
      lezenActief: true,
      schrijvenActief: true,
      ontbrekendBewijs: [],
    });
  });
});
