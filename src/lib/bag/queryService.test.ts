import { describe, expect, it } from 'vitest';
import {
  valideerPandZoekAanvraag,
  valideerViewportAanvraag,
} from './queryService';

describe('BAG private queryservicecontract', () => {
  it('accepteert een begrensde RD New-viewport', () => {
    expect(valideerViewportAanvraag({
      scopeCode: 'NL_SCALE_PROXY',
      viewport: { minX: 100_000, minY: 450_000, maxX: 101_000, maxY: 451_000 },
      limiet: 2_500,
    })).toEqual({ geldig: true, fouten: [] });
  });

  it('weigert niet-eindige, omgekeerde en te brede viewports', () => {
    expect(valideerViewportAanvraag({
      scopeCode: 'NL',
      viewport: { minX: Number.NaN, minY: 450_000, maxX: 100_000, maxY: 700_000 },
      limiet: 2_501,
    }).geldig).toBe(false);

    expect(valideerViewportAanvraag({
      scopeCode: 'NL',
      viewport: { minX: 101_000, minY: 451_000, maxX: 100_000, maxY: 450_000 },
      limiet: 100,
    }).fouten).toContain('De viewport valt buiten de begrensde RD New-zone.');
  });

  it('weigert onveilige scopecodes', () => {
    const validatie = valideerViewportAanvraag({
      scopeCode: 'NL; DROP SCHEMA bag_control',
      viewport: { minX: 100_000, minY: 450_000, maxX: 101_000, maxY: 451_000 },
      limiet: 100,
    });

    expect(validatie.geldig).toBe(false);
    expect(validatie.fouten).toContain('De BAG-scopecode is ongeldig.');
  });

  it('accepteert keysetpaginering en begrenst de zoekpagina', () => {
    expect(valideerPandZoekAanvraag({
      scopeCode: 'NL',
      naIdentificatie: '0123456789012345',
      limiet: 250,
    })).toEqual({ geldig: true, fouten: [] });

    const fout = valideerPandZoekAanvraag({
      scopeCode: 'NL',
      naIdentificatie: '   ',
      limiet: 251,
    });
    expect(fout.geldig).toBe(false);
    expect(fout.fouten).toHaveLength(2);
  });
});
