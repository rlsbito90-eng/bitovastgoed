import { describe, expect, it } from 'vitest';

import { beoordeelProductiekernSchemaProef } from './productiekernSchemaProefBesluit';

const volledigeDekking = {
  aanwezig: [
    'acquisitiedossier',
    'briefkern',
    'briefversies',
    'printbatches',
    'batchbrieven',
    'batchdocumenten',
    'productieaudit',
    'nummerreeksen',
  ] as const,
  ontbrekend: [],
  volledig: true,
};

const volledigBewijs = {
  schemaDekking: volledigeDekking,
  actueleProductieDdlReadOnlyGeverifieerd: true,
  actueleProductieRlsReadOnlyGeverifieerd: true,
  kolomtypenEnNullabilityVergeleken: true,
  constraintnamenGecontroleerd: true,
  rollbackplanBeoordeeld: true,
  explicietProefakkoord: true,
};

describe('beoordeelProductiekernSchemaProef', () => {
  it('staat een schema-only proef uitsluitend toe bij volledig bewijs', () => {
    expect(beoordeelProductiekernSchemaProef(volledigBewijs)).toEqual({
      toegestaan: true,
      blokkades: [],
    });
  });

  it('blijft fail-closed wanneer ieder bewijs ontbreekt', () => {
    const besluit = beoordeelProductiekernSchemaProef({
      schemaDekking: {
        aanwezig: [],
        ontbrekend: ['acquisitiedossier', 'briefkern'],
        volledig: false,
      },
      actueleProductieDdlReadOnlyGeverifieerd: false,
      actueleProductieRlsReadOnlyGeverifieerd: false,
      kolomtypenEnNullabilityVergeleken: false,
      constraintnamenGecontroleerd: false,
      rollbackplanBeoordeeld: false,
      explicietProefakkoord: false,
    });

    expect(besluit.toegestaan).toBe(false);
    expect(besluit.blokkades).toHaveLength(7);
    expect(besluit.blokkades[0]).toContain('acquisitiedossier, briefkern');
  });

  it('accepteert volledige ontwerpdekking niet als vervanging voor productieverificatie', () => {
    const besluit = beoordeelProductiekernSchemaProef({
      ...volledigBewijs,
      actueleProductieDdlReadOnlyGeverifieerd: false,
      actueleProductieRlsReadOnlyGeverifieerd: false,
    });

    expect(besluit.toegestaan).toBe(false);
    expect(besluit.blokkades).toEqual([
      'Actuele productie-DDL is niet read-only geverifieerd.',
      'Actuele productie-RLS is niet read-only geverifieerd.',
    ]);
  });

  it('vereist altijd afzonderlijk expliciet proefakkoord', () => {
    const besluit = beoordeelProductiekernSchemaProef({
      ...volledigBewijs,
      explicietProefakkoord: false,
    });

    expect(besluit).toEqual({
      toegestaan: false,
      blokkades: [
        'Expliciet akkoord voor een geïsoleerde schema-only proef ontbreekt.',
      ],
    });
  });
});
