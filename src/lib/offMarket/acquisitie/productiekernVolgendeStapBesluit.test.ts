import { describe, expect, it } from 'vitest';

import { beoordeelProductiekernVolgendeStap } from './productiekernVolgendeStapBesluit';

const geldigSchemaBewijs = {
  geldig: true,
  leeftijdUren: 2,
  blokkades: [],
};

const volledigBewijs = {
  schemaProefBewijs: geldigSchemaBewijs,
  actueleProductieDdlReadOnlyGeverifieerd: true,
  actueleProductieRlsReadOnlyGeverifieerd: true,
  sqlConceptNaVerificatieBijgewerkt: true,
  gerichteTypecheckGroen: true,
  gerichteTestsGroen: true,
  productiebuildGroen: true,
  explicietAkkoordVoorConcurrencyProef: true,
};

describe('beoordeelProductiekernVolgendeStap', () => {
  it('staat alleen voorbereiding van een geïsoleerde concurrencyproef toe', () => {
    expect(beoordeelProductiekernVolgendeStap(volledigBewijs)).toEqual({
      concurrencyProefVoorbereiden: true,
      productieMigratieToegestaan: false,
      productieActivatieToegestaan: false,
      blokkades: [],
    });
  });

  it('blijft volledig fail-closed zonder bewijs', () => {
    const besluit = beoordeelProductiekernVolgendeStap({
      schemaProefBewijs: {
        geldig: false,
        leeftijdUren: 72,
        blokkades: ['Het proefbewijs is verlopen.'],
      },
      actueleProductieDdlReadOnlyGeverifieerd: false,
      actueleProductieRlsReadOnlyGeverifieerd: false,
      sqlConceptNaVerificatieBijgewerkt: false,
      gerichteTypecheckGroen: false,
      gerichteTestsGroen: false,
      productiebuildGroen: false,
      explicietAkkoordVoorConcurrencyProef: false,
    });

    expect(besluit.concurrencyProefVoorbereiden).toBe(false);
    expect(besluit.productieMigratieToegestaan).toBe(false);
    expect(besluit.productieActivatieToegestaan).toBe(false);
    expect(besluit.blokkades).toHaveLength(8);
    expect(besluit.blokkades[0]).toBe(
      'Schema-only proefbewijs: Het proefbewijs is verlopen.',
    );
  });

  it('accepteert een groene build niet als vervanging voor DDL- en RLS-verificatie', () => {
    const besluit = beoordeelProductiekernVolgendeStap({
      ...volledigBewijs,
      actueleProductieDdlReadOnlyGeverifieerd: false,
      actueleProductieRlsReadOnlyGeverifieerd: false,
    });

    expect(besluit.concurrencyProefVoorbereiden).toBe(false);
    expect(besluit.blokkades).toEqual([
      'Actuele productie-DDL is niet read-only geverifieerd.',
      'Actuele productie-RLS is niet read-only geverifieerd.',
    ]);
  });

  it('vereist afzonderlijk akkoord voor de concurrencyproef', () => {
    const besluit = beoordeelProductiekernVolgendeStap({
      ...volledigBewijs,
      explicietAkkoordVoorConcurrencyProef: false,
    });

    expect(besluit).toEqual({
      concurrencyProefVoorbereiden: false,
      productieMigratieToegestaan: false,
      productieActivatieToegestaan: false,
      blokkades: [
        'Expliciet akkoord voor de geïsoleerde concurrencyproef ontbreekt.',
      ],
    });
  });
});
