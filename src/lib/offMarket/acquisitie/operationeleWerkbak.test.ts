import { describe, expect, it } from 'vitest';
import {
  bepaalOperationeleWerkbak,
  type BepaalOperationeleWerkbakInput,
} from '@/lib/offMarket/acquisitie/operationeleWerkbak';

function bepaal(overrides: Partial<BepaalOperationeleWerkbakInput>) {
  return bepaalOperationeleWerkbak({
    fase: 'onderzoek_nodig',
    verwerkingGestart: true,
    wachtOpToekomstigeOpvolging: false,
    ...overrides,
  });
}

describe('operationele acquisitiewerkbak', () => {
  it('houdt een nog niet gestart dossier expliciet in Nieuwe selectie', () => {
    expect(bepaal({ verwerkingGestart: false, fase: 'gereed_voor_print' }))
      .toBe('nieuwe_selectie');
  });

  it.each([
    'onderzoek_nodig',
    'eigenaar_ontbreekt',
    'adres_ontbreekt',
  ] as const)('plaatst %s in Eigenaar achterhalen', (fase) => {
    expect(bepaal({ fase })).toBe('eigenaar_achterhalen');
  });

  it.each(['brief_voorbereiden', 'concept_gereed'] as const)(
    'plaatst %s in Brief opstellen',
    (fase) => expect(bepaal({ fase })).toBe('brief_opstellen'),
  );

  it('onderscheidt Printklaar en Geprint / posten', () => {
    expect(bepaal({ fase: 'gereed_voor_print' })).toBe('printklaar');
    expect(bepaal({ fase: 'geprint' })).toBe('geprint_posten');
  });

  it.each(['gepost', 'email_verzonden', 'opvolging_open'] as const)(
    'plaatst %s standaard in Opvolgen',
    (fase) => expect(bepaal({ fase })).toBe('opvolgen'),
  );

  it('plaatst alleen echt toekomstige opvolging in Wachten', () => {
    expect(bepaal({ fase: 'gepost', wachtOpToekomstigeOpvolging: true }))
      .toBe('wachten');
    expect(bepaal({ fase: 'opvolging_open', wachtOpToekomstigeOpvolging: true }))
      .toBe('opvolgen');
  });

  it('laat Afgehandeld altijd voorgaan op Nieuwe selectie', () => {
    expect(bepaal({ fase: 'afgerond', verwerkingGestart: false }))
      .toBe('afgehandeld');
  });
});
