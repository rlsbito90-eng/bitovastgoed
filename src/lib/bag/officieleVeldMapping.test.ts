import { describe, expect, it } from 'vitest';
import {
  BAG_EXTRACT_NAMESPACES,
  BAG_OFFICIELE_VELDMAPPINGS,
  BAG_VOORKOMEN_MAPPING,
  isInactiefVoorkomen,
  valideerRdCoordinaatwaarden,
  veldMappingVoor,
} from './officieleVeldMapping';

describe('officiële BAG veldmapping', () => {
  it('dekt alle zeven BAG-objecttypen', () => {
    expect(BAG_OFFICIELE_VELDMAPPINGS.map(item => item.objecttype)).toEqual([
      'Pand',
      'Verblijfsobject',
      'Nummeraanduiding',
      'OpenbareRuimte',
      'Woonplaats',
      'Standplaats',
      'Ligplaats',
    ]);
  });

  it('legt de bevestigde namespaces vast', () => {
    expect(BAG_EXTRACT_NAMESPACES.extract).toContain('extract-deelbestand-lvc/v20200601');
    expect(BAG_EXTRACT_NAMESPACES.objecten).toContain('imbag/objecten/v20200601');
    expect(BAG_EXTRACT_NAMESPACES.gml).toBe('http://www.opengis.net/gml/3.2');
  });

  it('legt voorkomenhistorie los van de objectvelden vast', () => {
    expect(BAG_VOORKOMEN_MAPPING.voorkomenidentificatie).toBe(
      'voorkomen/Voorkomen/voorkomenidentificatie',
    );
    expect(BAG_VOORKOMEN_MAPPING.tijdstipInactief).toBe(
      'voorkomen/Voorkomen/tijdstipInactief',
    );
    expect(BAG_VOORKOMEN_MAPPING.tijdstipEindRegistratieLV).toBe(
      'voorkomen/Voorkomen/tijdstipEindRegistratieLV',
    );
  });

  it('modelleert de officiële VBO-relaties naar adres en pand', () => {
    const vbo = veldMappingVoor('Verblijfsobject');
    expect(vbo.relaties.hoofdadres).toBe('heeftAlsHoofdadres/NummeraanduidingRef');
    expect(vbo.relaties.maaktDeelUitVan).toBe(
      'object/Verblijfsobject/maaktDeelUitVan/PandRef',
    );
    expect(vbo.velden.gebruiksdoel).toBe('object/Verblijfsobject/gebruiksdoel');
    expect(vbo.velden.oppervlakte).toBe('object/Verblijfsobject/oppervlakte');
  });

  it('onderscheidt punt-, polygoon- en objecten zonder geometrie', () => {
    expect(veldMappingVoor('Pand').geometrie.vorm).toBe('polygoon');
    expect(veldMappingVoor('Verblijfsobject').geometrie.vorm).toBe('punt');
    expect(veldMappingVoor('Nummeraanduiding').geometrie.vorm).toBe('geen');
    expect(veldMappingVoor('OpenbareRuimte').geometrie.vorm).toBe('geen');
  });

  it('houdt rekening met 2D en 3D RD-coördinaten', () => {
    expect(valideerRdCoordinaatwaarden([230704.673, 557717.195, 0], 3)).toEqual({
      geldig: true,
      punten: 1,
    });
    expect(valideerRdCoordinaatwaarden([231944.424, 557746.199, 231942.408, 557738.033], 2)).toEqual({
      geldig: true,
      punten: 2,
    });
    expect(valideerRdCoordinaatwaarden([1, 2, 3], 2)).toEqual({
      geldig: false,
      punten: 0,
    });
  });

  it('herkent inactieve voorkomens via een van beide inactieftijdstippen', () => {
    expect(isInactiefVoorkomen({ tijdstipInactief: '2015-10-14T17:07:49.770' })).toBe(true);
    expect(isInactiefVoorkomen({ tijdstipInactiefLV: '2015-10-14T17:07:49.770' })).toBe(true);
    expect(isInactiefVoorkomen({})).toBe(false);
  });
});
