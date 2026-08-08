import { describe, expect, it } from 'vitest';

import type { AcquisitiedossierContract } from './productiekernContract';
import {
  selectieIdsVoorWerkbak,
  selecteerDossiersVoorWerkbak,
} from './productiekernWerkbakSelectie';

function dossier(
  selectieId: string,
  primaireWerkbak: AcquisitiedossierContract['primaireWerkbak'],
): AcquisitiedossierContract {
  return {
    selectieId,
    signaalId: `signaal-${selectieId}`,
    objectId: null,
    verwerkingGestartOp: primaireWerkbak === 'nieuwe_selectie' ? null : '2026-08-08T12:00:00Z',
    verwerkingGestartDoor: primaireWerkbak === 'nieuwe_selectie' ? null : 'actor-1',
    primaireWerkbak,
    volgendeActieOp: null,
    volgendeActieOmschrijving: null,
  };
}

describe('productiekernWerkbakSelectie', () => {
  const dossiers = [
    dossier('sel-1', 'nieuwe_selectie'),
    dossier('sel-2', 'eigenaar_achterhalen'),
    dossier('sel-3', 'eigenaar_achterhalen'),
    dossier('sel-4', 'opvolgen'),
  ];

  it('selecteert alleen dossiers met exact de formele primaire werkbak', () => {
    expect(selectieIdsVoorWerkbak(dossiers, 'eigenaar_achterhalen')).toEqual(['sel-2', 'sel-3']);
    expect(selectieIdsVoorWerkbak(dossiers, 'nieuwe_selectie')).toEqual(['sel-1']);
  });

  it('behandelt ontbrekende dossiers nooit impliciet als nieuwe selectie', () => {
    expect(selectieIdsVoorWerkbak(dossiers, 'nieuwe_selectie')).not.toContain('sel-ontbreekt');
  });

  it('behoudt dossierobjecten en volgorde in Alles', () => {
    expect(selecteerDossiersVoorWerkbak(dossiers, 'alles')).toEqual(dossiers);
  });
});
