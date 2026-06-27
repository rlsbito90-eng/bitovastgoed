// V48 — Adreslabels-PDF moet liggend zijn (90 mm × 29 mm).
// Borg dat het Page-element de juiste afmetingen krijgt en dat het
// `orientation` attribuut niet (verkeerd) wordt doorgegeven, zodat
// react-pdf de afmetingen niet automatisch omwisselt.
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import GecombineerdeAdreslabelsPDF
  from '@/components/offmarket/acquisitie/GecombineerdeAdreslabelsPDF';
import {
  LABEL_BREEDTE_PT, LABEL_HOOGTE_PT, LABEL_BREEDTE_MM, LABEL_HOOGTE_MM,
  type AdresLabel,
} from '@/lib/offMarket/acquisitie/adreslabel';

function maakLabel(briefId: string): AdresLabel {
  return {
    bron: {
      briefId, signaalId: 's1', toegevoegdOp: null,
      geadresseerdeKey: 'g1', campagneStap: 'brief_1',
      eigenaarNaam: 'Fictief Persoon', eigenaarBedrijfsnaam: null,
      verzendadres: 'Teststraat 1\n1234 AB Testdorp', opgeslagenAanhef: null,
    },
    variant: 'persoon',
    regels: ['De heer/mevrouw Fictief Persoon', 'Teststraat 1', '1234 AB TESTDORP'],
    postcode: '1234 AB', plaats: 'TESTDORP',
    geldig: true, blokkadeReden: null,
    overflowWaarschuwing: null, fontPt: 10,
  };
}

describe('V48 GecombineerdeAdreslabelsPDF — liggende oriëntatie', () => {
  it('constanten geven 90 × 29 mm en breedte > hoogte (landscape)', () => {
    expect(LABEL_BREEDTE_MM).toBe(90);
    expect(LABEL_HOOGTE_MM).toBe(29);
    expect(LABEL_BREEDTE_PT).toBeGreaterThan(LABEL_HOOGTE_PT);
  });

  it('Page krijgt size 90 × 29 mm-pt en GEEN orientation prop', () => {
    const element = createElement(GecombineerdeAdreslabelsPDF as any, {
      labels: [maakLabel('b1'), maakLabel('b2')],
    });
    // Render via de functioncomponent zelf om de virtuele tree te inspecteren.
    const tree: any = (GecombineerdeAdreslabelsPDF as any)(element.props);
    const doc = tree;
    const pages: any[] = ([] as any[]).concat(doc.props.children).filter(Boolean);
    expect(pages.length).toBe(2);
    for (const p of pages) {
      expect(p.props.size).toEqual({
        width: LABEL_BREEDTE_PT,
        height: LABEL_HOOGTE_PT,
      });
      // Cruciale regressie: orientation mag NIET 'landscape' zijn,
      // anders draait react-pdf de pagina alsnog naar portrait.
      expect(p.props.orientation).not.toBe('landscape');
    }
  });
});
