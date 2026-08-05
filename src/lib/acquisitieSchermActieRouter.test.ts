import { describe, expect, it } from 'vitest';
import { routeerOffMarketCommando, routeerVastgoedkansCommando } from './acquisitieSchermActieRouter';

describe('acquisitie schermactie-routers', () => {
  it('routeert Vastgoedkans-relatiekoppeling naar de bestaande handmatige eigenaarsectie', () => {
    const actie = routeerVastgoedkansCommando('relatie_koppelen');
    expect(actie.tab).toBe('kadaster');
    expect(actie.anker).toBe('vastgoedkans-eigenaaronderzoek');
    expect(actie.intentie).toBe('relatie_selecteren');
  });

  it('routeert Vastgoedkans-briefvoorbereiding naar de bestaande brieventab zonder verzending', () => {
    const actie = routeerVastgoedkansCommando('brief_voorbereiden');
    expect(actie.tab).toBe('brieven');
    expect(actie.intentie).toBe('briefconcept_openen');
    expect(actie.veiligheidsmelding).toContain('niets automatisch');
  });

  it('routeert Vastgoedkans-respons naar handmatige beoordeling', () => {
    const actie = routeerVastgoedkansCommando('respons_beoordelen');
    expect(actie.anker).toBe('vastgoedkans-reactie');
    expect(actie.intentie).toBe('respons_beoordelen');
  });

  it('hergebruikt voor Off-Market de bestaande briefvoorbereidingsdialoog', () => {
    const actie = routeerOffMarketCommando('geadresseerde_controleren');
    expect(actie.dialoog).toBe('brief_voorbereiden');
    expect(actie.vereistGeselecteerdeBrief).toBe(false);
  });

  it('vereist voor Off-Market-verzendregistratie een geselecteerde brief', () => {
    const actie = routeerOffMarketCommando('verzending_registreren');
    expect(actie.dialoog).toBe('markeer_verstuurd');
    expect(actie.vereistGeselecteerdeBrief).toBe(true);
  });

  it('vereist voor Off-Market-respons de bestaande responsdialoog en een geselecteerde brief', () => {
    const actie = routeerOffMarketCommando('respons_registreren');
    expect(actie.dialoog).toBe('registreer_respons');
    expect(actie.vereistGeselecteerdeBrief).toBe(true);
    expect(actie.veiligheidsmelding).toContain('RegistreerResponsDialog');
  });
});
