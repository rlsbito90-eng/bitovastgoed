import { describe, expect, it } from 'vitest';

import type {
  BriefContract,
  BriefversieContract,
  PrintbatchBriefContract,
  PrintbatchContract,
} from './productiekernContract';
import {
  bouwProductiekernPrintbatchModellen,
  indexeerProductieNummersPerSignaal,
} from './productiekernPrintbatchOverzicht';
import type { OffMarketSignaal } from '@/lib/offMarket/types';

const brief: BriefContract = {
  id: 'brief-1', briefnummer: 'BR2026000005', signaalId: 'signaal-1', selectieId: 'selectie-1',
  objectId: null, relatieId: null, actieveVersie: 1, status: 'definitief', vervangingVanBriefId: null,
  definitiefOp: '2026-08-18T01:00:00Z', vergrendeldOp: '2026-08-18T01:00:00Z', annuleringsreden: null,
};
const versie: BriefversieContract = {
  id: 'versie-1', briefId: brief.id, versienummer: 1, status: 'actief',
  inhoud: { onderwerp: null, brieftekst: 'Tekst', objectadres: 'Maasstraat 94-4', objectomschrijving: null, templateId: null, templateVersie: null },
  geadresseerde: {
    naam: 'E.S. Blok', bedrijfsnaam: null, aanhef: null, straatHuisnummer: 'Straat 1',
    postcode: '1000AA', plaats: 'Amsterdam', land: 'Nederland', bron: 'kadaster',
    verificatiestatus: 'geverifieerd', relatieId: null,
  },
  bestandReferentie: null, createdAt: '2026-08-18T01:00:00Z', vervallenOp: null, verzondenOp: null,
};
const batch: PrintbatchContract = {
  id: 'batch-1', batchnummer: 'BAT2026081801', status: 'documenten_gegenereerd', documentversie: 1,
  aanvullingOpBatchId: null, printdatum: null, verzenddatum: null, geannuleerdOp: null, annuleringsreden: null,
};
const koppeling: PrintbatchBriefContract = {
  id: 'koppeling-1', batchId: batch.id, briefId: brief.id, briefVersieId: versie.id,
  verwijderdOp: null, afwijkingsstatus: null, afwijkingsreden: null,
};

describe('Productiekern printbatchoverzicht', () => {
  it('projecteert BR en BAT terug naar het gekoppelde signaal voor zoeken en badges', () => {
    const modellen = bouwProductiekernPrintbatchModellen({
      batches: [batch],
      koppelingen: [koppeling],
      brieven: [brief],
      versies: [versie],
      signalen: [{ id: 'signaal-1', adres: 'Maasstraat 94-4', plaats: 'Amsterdam' } as OffMarketSignaal],
    });
    const index = indexeerProductieNummersPerSignaal(modellen, [brief]);

    expect(index.get('signaal-1')).toEqual({
      briefnummers: ['BR2026000005'],
      batchnummers: ['BAT2026081801'],
    });
  });

  it('houdt een formeel BR-nummer zichtbaar als de brief nog niet aan een BAT is gekoppeld', () => {
    const index = indexeerProductieNummersPerSignaal([], [brief]);
    expect(index.get('signaal-1')).toEqual({
      briefnummers: ['BR2026000005'],
      batchnummers: [],
    });
  });
});
