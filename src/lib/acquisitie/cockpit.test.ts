import { describe, expect, it } from 'vitest';
import { berekenJaarVoortgang, bouwCockpitSamenvatting } from '@/lib/acquisitie/cockpit';

const actuals = {
  jaar: 2026,
  kadasterAanvragen: 80,
  kadasterKostenBesteBeschikbaar: 800,
  verzondenCommunicaties: 400,
  reacties: 32,
  positieveReacties: 12,
  retourpost: 2,
  opvolgingAangemaakt: 20,
  opvolgingAfgerond: 14,
  responspercentage: 8,
  positieveResponspercentage: 3,
};

describe('TRACK-7 acquisitiecockpit', () => {
  it('berekent jaarvoortgang deterministisch tussen 0 en 1', () => {
    expect(berekenJaarVoortgang(new Date(2026, 0, 1), 2026)).toBe(0);
    expect(berekenJaarVoortgang(new Date(2027, 0, 1), 2026)).toBe(1);
    expect(berekenJaarVoortgang(new Date(2026, 6, 2), 2026)).toBeGreaterThan(0.49);
    expect(berekenJaarVoortgang(new Date(2026, 6, 2), 2026)).toBeLessThan(0.51);
  });

  it('signaleert budgetoverschrijding als kritiek', () => {
    const result = bouwCockpitSamenvatting(actuals, {
      acquisitie_kadaster_budget_doel: 700,
    }, new Date(2026, 7, 16));

    expect(result.status).toBe('kritiek');
    expect(result.signalen.some(s => s.id === 'kadaster-budget-overschreden' && s.severity === 'kritiek')).toBe(true);
  });

  it('beoordeelt brieventempo tegen verstreken jaar en niet alleen tegen einddoel', () => {
    const result = bouwCockpitSamenvatting({ ...actuals, verzondenCommunicaties: 100 }, {
      acquisitie_brieven_doel: 1000,
    }, new Date(2026, 6, 2));

    expect(result.signalen.some(s => s.id === 'brieven-achterstand')).toBe(true);
  });

  it('signaleert respons en positieve respons afzonderlijk', () => {
    const result = bouwCockpitSamenvatting(actuals, {
      acquisitie_responspercentage_doel: 10,
      acquisitie_positieve_responspercentage_doel: 5,
    }, new Date(2026, 7, 16));

    expect(result.signalen.some(s => s.id === 'respons-onder-doel')).toBe(true);
    expect(result.signalen.some(s => s.id === 'positieve-respons-onder-doel')).toBe(true);
  });

  it('leidt open opvolging uitsluitend af uit aangemaakt minus afgerond', () => {
    const result = bouwCockpitSamenvatting(actuals, null, new Date(2026, 7, 16));

    expect(result.openOpvolging).toBe(6);
    expect(result.signalen.some(s => s.id === 'open-opvolging')).toBe(true);
  });

  it('maakt ontbrekende doelen zichtbaar zonder actuals te blokkeren', () => {
    const result = bouwCockpitSamenvatting({
      ...actuals,
      retourpost: 0,
      opvolgingAangemaakt: 0,
      opvolgingAfgerond: 0,
    }, null, new Date(2026, 7, 16));

    expect(result.doelDekking).toBe(0);
    expect(result.signalen.some(s => s.id === 'geen-doelen')).toBe(true);
    expect(result.status).toBe('op_schema');
  });
});
