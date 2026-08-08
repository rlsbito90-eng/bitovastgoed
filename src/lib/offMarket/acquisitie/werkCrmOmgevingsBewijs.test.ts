import { describe, expect, it } from 'vitest';

import {
  bouwWerkCrmActivatieBewijs,
  haalSupabaseProjectrefUitUrl,
} from './werkCrmOmgevingsBewijs';

const volledig = {
  modus: 'werkcrm',
  actueleSupabaseUrl: 'https://werkproject123.supabase.co',
  verwachteSupabaseProjectref: 'werkproject123',
  schemaGeinstalleerd: 'true',
  rlsEnRechtenGeverifieerd: 'true',
  gerichteWorkflowtestsGroen: 'true',
  applicatiebuildGroen: 'true',
  duurzameDatabewaringBevestigd: 'true',
  explicietWerkakkoord: 'true',
};

describe('werkCrmOmgevingsBewijs', () => {
  it('haalt uitsluitend een projectref uit een geldige Supabase-host', () => {
    expect(haalSupabaseProjectrefUitUrl('https://abc123.supabase.co')).toBe('abc123');
    expect(haalSupabaseProjectrefUitUrl('https://voorbeeld.nl')).toBeNull();
    expect(haalSupabaseProjectrefUitUrl('geen-url')).toBeNull();
  });

  it('bouwt volledig groen bewijs bij een expliciet overeenkomend werk-CRM-doel', () => {
    expect(bouwWerkCrmActivatieBewijs(volledig)).toEqual({
      doelomgevingIsWerkdatabase: true,
      supabaseDoelKomtOvereen: true,
      schemaGeinstalleerd: true,
      rlsEnRechtenGeverifieerd: true,
      gerichteWorkflowtestsGroen: true,
      applicatiebuildGroen: true,
      duurzameDatabewaringBevestigd: true,
      explicietWerkakkoord: true,
    });
  });

  it('weigert een andere actuele Supabase-projectref', () => {
    const bewijs = bouwWerkCrmActivatieBewijs({
      ...volledig,
      actueleSupabaseUrl: 'https://anderproject.supabase.co',
    });
    expect(bewijs.supabaseDoelKomtOvereen).toBe(false);
  });

  it('activeert niet op basis van alleen een preview-achtige configuratie', () => {
    const bewijs = bouwWerkCrmActivatieBewijs({
      modus: 'werkcrm',
      actueleSupabaseUrl: 'https://werkproject123.supabase.co',
      verwachteSupabaseProjectref: 'werkproject123',
    });

    expect(bewijs.doelomgevingIsWerkdatabase).toBe(true);
    expect(bewijs.supabaseDoelKomtOvereen).toBe(true);
    expect(bewijs.schemaGeinstalleerd).toBe(false);
    expect(bewijs.explicietWerkakkoord).toBe(false);
  });
});
