import { describe, expect, it } from 'vitest';

import {
  bepaalBrowserProductieActivatieUitOmgeving,
  bepaalBrowserProductiekernActivatieUitOmgeving,
  bepaalBrowserWerkCrmActivatieUitOmgeving,
} from './productiekernBrowserClient';

const volledigWerkCrm = {
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

const volledigProductie = {
  VITE_ACQUISITIE_PRODUCTIEKERN_MODUS: 'productie',
  VITE_SUPABASE_URL: 'https://productie123.supabase.co',
  VITE_ACQUISITIE_PRODUCTIEKERN_PRODUCTIE_PROJECTREF: 'productie123',
  VITE_ACQUISITIE_PRODUCTIEKERN_DDL_GEVERIFIEERD: 'true',
  VITE_ACQUISITIE_PRODUCTIEKERN_RLS_GEVERIFIEERD: 'true',
  VITE_ACQUISITIE_PRODUCTIEKERN_MIGRATIEPROEF_GROEN: 'true',
  VITE_ACQUISITIE_PRODUCTIEKERN_CONCURRENCYPROEF_GROEN: 'true',
  VITE_ACQUISITIE_PRODUCTIEKERN_VOLLEDIGE_TESTSUITE_GROEN: 'true',
  VITE_ACQUISITIE_PRODUCTIEKERN_BUILD_GROEN: 'true',
  VITE_ACQUISITIE_PRODUCTIEKERN_PRODUCTIEAKKOORD: 'true',
};

describe('Productiekern browser werk-CRM-poort', () => {
  it('blijft dicht zonder expliciete werk-CRM-modus', () => {
    const besluit = bepaalBrowserWerkCrmActivatieUitOmgeving({
      ...volledigWerkCrm,
      VITE_ACQUISITIE_PRODUCTIEKERN_MODUS: undefined,
    });

    expect(besluit.lezenActief).toBe(false);
    expect(besluit.schrijvenActief).toBe(false);
  });

  it('blijft dicht bij een verkeerde Supabase-projectref', () => {
    const besluit = bepaalBrowserWerkCrmActivatieUitOmgeving({
      ...volledigWerkCrm,
      VITE_SUPABASE_URL: 'https://anderproject.supabase.co',
    });

    expect(besluit.lezenActief).toBe(false);
    expect(besluit.schrijvenActief).toBe(false);
    expect(besluit.ontbrekendBewijs).toContain(
      'De gekoppelde Supabase-omgeving komt niet overeen met het verwachte werk-CRM-doel.',
    );
  });

  it('gaat uitsluitend open bij volledige expliciete werk-CRM-configuratie', () => {
    expect(bepaalBrowserWerkCrmActivatieUitOmgeving(volledigWerkCrm)).toEqual({
      lezenActief: true,
      schrijvenActief: true,
      ontbrekendBewijs: [],
    });
  });
});

describe('Productiekern browser productiepoort', () => {
  it('activeert productie uitsluitend bij volledige productieconfiguratie', () => {
    expect(bepaalBrowserProductieActivatieUitOmgeving(volledigProductie)).toEqual({
      lezenActief: true,
      schrijvenActief: true,
      ontbrekendBewijs: [],
    });
  });

  it('weigert een juiste bewijsset op de verkeerde Supabase-projectref', () => {
    const besluit = bepaalBrowserProductieActivatieUitOmgeving({
      ...volledigProductie,
      VITE_SUPABASE_URL: 'https://verkeerd.supabase.co',
    });

    expect(besluit.lezenActief).toBe(false);
    expect(besluit.schrijvenActief).toBe(false);
    expect(besluit.ontbrekendBewijs).toContain(
      'De gekoppelde Supabase-omgeving komt niet overeen met het verwachte productiedoel.',
    );
  });

  it('weigert productie wanneer één van de zeven releasebewijzen ontbreekt', () => {
    const besluit = bepaalBrowserProductieActivatieUitOmgeving({
      ...volledigProductie,
      VITE_ACQUISITIE_PRODUCTIEKERN_CONCURRENCYPROEF_GROEN: 'false',
    });

    expect(besluit.lezenActief).toBe(false);
    expect(besluit.schrijvenActief).toBe(false);
    expect(besluit.ontbrekendBewijs).toContain('Concurrencyproef is niet groen.');
  });

  it('houdt productie en werk-CRM strikt gescheiden in de centrale dispatch', () => {
    const alsWerkCrmVermomd = {
      ...volledigProductie,
      VITE_ACQUISITIE_PRODUCTIEKERN_MODUS: 'werkcrm',
    };

    const besluit = bepaalBrowserProductiekernActivatieUitOmgeving(alsWerkCrmVermomd);
    expect(besluit.lezenActief).toBe(false);
    expect(besluit.schrijvenActief).toBe(false);
  });

  it('blijft fail-closed bij onbekende runtime-modus', () => {
    expect(bepaalBrowserProductiekernActivatieUitOmgeving({
      VITE_ACQUISITIE_PRODUCTIEKERN_MODUS: 'preview',
    })).toEqual({
      lezenActief: false,
      schrijvenActief: false,
      ontbrekendBewijs: ['Geen geldige Acquisitieproductiekern-runtimeomgeving geconfigureerd.'],
    });
  });
});
