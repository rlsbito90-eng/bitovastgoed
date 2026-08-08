import { describe, expect, it } from 'vitest';

import {
  bepaalWerkCrmActivatie,
  werkCrmStandaardUitgeschakeld,
} from './werkCrmActivatiePoort';

const volledigWerkBewijs = {
  doelomgevingIsWerkdatabase: true,
  supabaseDoelKomtOvereen: true,
  schemaGeinstalleerd: true,
  rlsEnRechtenGeverifieerd: true,
  gerichteWorkflowtestsGroen: true,
  applicatiebuildGroen: true,
  duurzameDatabewaringBevestigd: true,
  explicietWerkakkoord: true,
};

describe('bepaalWerkCrmActivatie', () => {
  it('blijft standaard volledig uitgeschakeld', () => {
    expect(werkCrmStandaardUitgeschakeld.lezenActief).toBe(false);
    expect(werkCrmStandaardUitgeschakeld.schrijvenActief).toBe(false);
    expect(werkCrmStandaardUitgeschakeld.ontbrekendBewijs).toHaveLength(8);
  });

  it('weigert een verkeerd Supabase-doel ook wanneer alle andere bewijzen groen zijn', () => {
    const besluit = bepaalWerkCrmActivatie({
      ...volledigWerkBewijs,
      supabaseDoelKomtOvereen: false,
    });

    expect(besluit.lezenActief).toBe(false);
    expect(besluit.schrijvenActief).toBe(false);
    expect(besluit.ontbrekendBewijs).toEqual([
      'De gekoppelde Supabase-omgeving komt niet overeen met het verwachte werk-CRM-doel.',
    ]);
  });

  it('weigert operationeel gebruik zolang duurzame databewaring niet bevestigd is', () => {
    const besluit = bepaalWerkCrmActivatie({
      ...volledigWerkBewijs,
      duurzameDatabewaringBevestigd: false,
    });

    expect(besluit.lezenActief).toBe(false);
    expect(besluit.schrijvenActief).toBe(false);
  });

  it('activeert lezen en schrijven uitsluitend na alle acht bewijzen', () => {
    expect(bepaalWerkCrmActivatie(volledigWerkBewijs)).toEqual({
      lezenActief: true,
      schrijvenActief: true,
      ontbrekendBewijs: [],
    });
  });

  it('behandelt ontbrekende configuratie fail-closed', () => {
    expect(bepaalWerkCrmActivatie(null).schrijvenActief).toBe(false);
  });
});
