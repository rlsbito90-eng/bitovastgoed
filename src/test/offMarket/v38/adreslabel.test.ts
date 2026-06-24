// V38 — Tests voor adreslabel-helper, PDF-afmetingen en mutatievrijheid.
import { describe, it, expect } from 'vitest';
import {
  LABEL_BREEDTE_MM, LABEL_HOOGTE_MM, VEILIGE_MARGE_MM,
  LABEL_BREEDTE_PT, LABEL_HOOGTE_PT, VEILIGE_MARGE_PT,
  MM_PER_PT,
  bouwAdresLabel, parseVerzendadres,
  normaliseerPostcode, plaatsBovenkast, isSpecifiekeAanhef,
  briefNaarLabelBron,
  type LabelBron,
} from '@/lib/offMarket/acquisitie/adreslabel';
import { sorteerPrintItems } from '@/lib/offMarket/acquisitie/printVolgorde';

function bron(over: Partial<LabelBron> = {}): LabelBron {
  return {
    briefId: 'b1',
    signaalId: 's1',
    toegevoegdOp: '2026-01-01T00:00:00Z',
    geadresseerdeKey: 'k1',
    campagneStap: 'brief_1',
    eigenaarNaam: 'J. Achternaam',
    eigenaarBedrijfsnaam: null,
    verzendadres: 'Straatnaam 12-1\n1234 AB Plaats',
    opgeslagenAanhef: null,
    ...over,
  };
}

describe('v38 — afmetingen en marges', () => {
  it('exact 90 × 29 mm in mm-constanten', () => {
    expect(LABEL_BREEDTE_MM).toBe(90);
    expect(LABEL_HOOGTE_MM).toBe(29);
    expect(VEILIGE_MARGE_MM).toBe(3);
  });

  it('PDF-pagina exact 90 × 29 mm in punten', () => {
    expect(LABEL_BREEDTE_PT).toBeCloseTo(90 * MM_PER_PT, 3);
    expect(LABEL_HOOGTE_PT).toBeCloseTo(29 * MM_PER_PT, 3);
    expect(VEILIGE_MARGE_PT).toBeCloseTo(3 * MM_PER_PT, 3);
    // Sanity: 90 mm ≈ 255.118 pt; 29 mm ≈ 82.205 pt; 3 mm ≈ 8.504 pt.
    expect(Math.round(LABEL_BREEDTE_PT * 1000)).toBe(255118);
    expect(Math.round(LABEL_HOOGTE_PT * 1000)).toBe(82205);
  });
});

describe('v38 — normalisatie', () => {
  it('postcode wordt 1234 AB', () => {
    expect(normaliseerPostcode('1071vb')).toBe('1071 VB');
    expect(normaliseerPostcode('1071  vb')).toBe('1071 VB');
    expect(normaliseerPostcode('1071 VB')).toBe('1071 VB');
  });
  it('plaats wordt hoofdletters', () => {
    expect(plaatsBovenkast('Amsterdam')).toBe('AMSTERDAM');
    expect(plaatsBovenkast(' den haag ')).toBe('DEN HAAG');
  });
  it('parseert multi-line adres', () => {
    const p = parseVerzendadres('Straatnaam 12\n1234 ab Plaats');
    expect(p).toEqual({ straat: 'Straatnaam 12', postcode: '1234 AB', plaats: 'PLAATS' });
  });
  it('weigert adres zonder postcode', () => {
    expect(parseVerzendadres('Straat 1\nPlaats')).toBeNull();
  });
});

describe('v38 — label personen', () => {
  it('persoonsformaat zonder geslachtsinferentie', () => {
    const l = bouwAdresLabel(bron({ eigenaarNaam: 'J. Achternaam' }));
    expect(l.geldig).toBe(true);
    expect(l.variant).toBe('persoon');
    expect(l.regels[0]).toBe('De heer/mevrouw J. Achternaam');
    // Geen "Geachte heer" / "Mevrouw" / "Dhr." afleiding.
    for (const r of l.regels) {
      expect(/\b(de heer|dhr\.|mevrouw|mw\.)\s+[A-Z]\b/i.test(r) && !/heer\/mevrouw/i.test(r))
        .toBe(false);
    }
  });

  it('respecteert opgeslagen specifieke aanhef', () => {
    const l = bouwAdresLabel(bron({ opgeslagenAanhef: 'Dr. ir.', eigenaarNaam: 'J. Achternaam' }));
    expect(l.regels[0]).toBe('Dr. ir. J. Achternaam');
  });

  it('negeert generieke aanhef en valt terug op De heer/mevrouw', () => {
    expect(isSpecifiekeAanhef('Geachte heer/mevrouw,')).toBe(false);
    const l = bouwAdresLabel(bron({ opgeslagenAanhef: 'Geachte heer/mevrouw,' }));
    expect(l.regels[0]).toBe('De heer/mevrouw J. Achternaam');
  });

  it('plaats wordt in hoofdletters op label', () => {
    const l = bouwAdresLabel(bron({ verzendadres: 'Straat 1\n1234 AB Amsterdam' }));
    expect(l.regels[l.regels.length - 1]).toBe('1234 AB AMSTERDAM');
  });
});

describe('v38 — label bedrijf', () => {
  it('bedrijfsformaat met T.a.v. de directie', () => {
    const l = bouwAdresLabel(bron({
      eigenaarNaam: null, eigenaarBedrijfsnaam: 'Bedrijfsnaam B.V.',
    }));
    expect(l.variant).toBe('bedrijf');
    expect(l.regels[0]).toBe('Bedrijfsnaam B.V.');
    expect(l.regels[1]).toBe('T.a.v. de directie');
  });
});

describe('v38 — blokkades en overflow', () => {
  it('ontbrekend volledig postadres blokkeert met reden', () => {
    const l = bouwAdresLabel(bron({ verzendadres: 'Straat 1' }));
    expect(l.geldig).toBe(false);
    expect(l.blokkadeReden).toMatch(/postadres/i);
  });

  it('lege naam én bedrijfsnaam blokkeert', () => {
    const l = bouwAdresLabel(bron({ eigenaarNaam: null, eigenaarBedrijfsnaam: null }));
    expect(l.geldig).toBe(false);
    expect(l.blokkadeReden).toMatch(/naam/i);
  });

  it('lange tekst geeft overflowwaarschuwing maar blijft geldig', () => {
    const lang = 'X'.repeat(200);
    const l = bouwAdresLabel(bron({ eigenaarNaam: lang }));
    expect(l.geldig).toBe(true);
    expect(l.overflowWaarschuwing).toMatch(/past mogelijk niet/i);
  });

  it('normale tekst zakt niet onder ondergrens', () => {
    const l = bouwAdresLabel(bron());
    expect(l.overflowWaarschuwing).toBeNull();
    expect(l.fontPt).toBeGreaterThanOrEqual(8);
  });
});

describe('v38 — printvolgorde labels = brievenvolgorde', () => {
  it('sorteerPrintItems behoudt identieke sleutels', () => {
    const items = [
      { signaalId: 's2', toegevoegdOp: '2026-02-01', geadresseerdeKey: 'a', campagneStap: 'brief_1' },
      { signaalId: 's1', toegevoegdOp: '2026-01-01', geadresseerdeKey: 'b', campagneStap: 'brief_1' },
      { signaalId: 's1', toegevoegdOp: '2026-01-01', geadresseerdeKey: 'a', campagneStap: 'brief_1' },
    ];
    const r = sorteerPrintItems(items);
    expect(r.map(x => x.geadresseerdeKey)).toEqual(['a', 'b', 'a']);
    expect(r.map(x => x.signaalId)).toEqual(['s1', 's1', 's2']);
  });
});

describe('v38 — mutatievrij', () => {
  it('bouwAdresLabel raakt de bron niet aan', () => {
    const b = bron();
    const snapshot = JSON.stringify(b);
    bouwAdresLabel(b);
    expect(JSON.stringify(b)).toBe(snapshot);
  });

  it('briefNaarLabelBron pakt enkel kopieën — geen Supabase-aanroep', () => {
    const lb = briefNaarLabelBron({
      id: 'b1', signaal_id: 's1',
      eigenaar_naam: 'X', eigenaar_bedrijfsnaam: null,
      verzendadres: 'Straat 1\n1000 AA Plaats',
      geadresseerde_key: 'k1', campagne_stap: 'brief_1',
      kanaal: 'post', archived_at: null, status: 'concept', verzendstatus: 'concept',
      aanhef: null, onderwerp: '', brieftekst: '', verzonden_op: null,
      created_at: '2026-01-01', updated_at: '2026-01-01',
      objectadres: null, objectomschrijving: null,
      aangemaakt_door: null, archived_reason: null,
    } as any, '2026-01-01');
    expect(lb.briefId).toBe('b1');
    expect(lb.geadresseerdeKey).toBe('k1');
  });
});

describe('v38 — twee geadresseerden bij één signaal → twee labels', () => {
  it('elke unieke bron levert één label', () => {
    const l1 = bouwAdresLabel(bron({ briefId: 'b1', eigenaarNaam: 'A. Een', geadresseerdeKey: 'k1' }));
    const l2 = bouwAdresLabel(bron({ briefId: 'b2', eigenaarNaam: 'B. Twee', geadresseerdeKey: 'k2' }));
    expect(l1.bron.briefId).not.toBe(l2.bron.briefId);
    expect(l1.geldig && l2.geldig).toBe(true);
  });
});
