import { describe, expect, it } from 'vitest';
import { extractKadasterAdresVoorstellenUitTekst } from '../../../supabase/functions/_shared/kadasterPdfAdresParser';
import { normaliseerKadasterPdfTekst } from '../../../supabase/functions/_shared/kadasterPdfTekstNormalisatie';

type VerwachtVoorstel = {
  naam?: string;
  bedrijfsnaam?: string;
  verzendadres: string;
  rechtType: 'eigendom' | 'erfpacht' | 'overig';
};

type DossierFixture = {
  dossier: string;
  signaalId: string;
  raw: string;
  verwacht: VerwachtVoorstel[];
};

// Minimale, éénregelige fixtures van de feitelijke unpdf-structuren van de
// tien dossiers uit issue #442. Geboortedata en niet-relevante PDF-inhoud zijn
// bewust weggelaten; rechten, namen en adresvelden zijn inhoudelijk behouden.
const dossiers: DossierFixture[] = [
  {
    dossier: 'Agamemnonstraat 55-H',
    signaalId: '0638ce2d-ee33-4b39-9cf5-527739f17554',
    raw: 'Objectinformatie Adres Agamemnonstraat 55-1 1076LS Amsterdam Rechten & aantekeningen 11-08-2026 Rechten Eigendom (recht van) Aandeel 1/1 Naam Gemeente Amsterdam Adres Amstel 1 1011PN AMSTERDAM Postbus 1104 1000BC AMSTERDAM Zetel AMSTERDAM KvK-nummer 34366966 Overige rechten Erfpacht (recht van) Aandeel 1/1 Naam Dionysius Egbertus Willibrordus Riet Adres - Gebaseerd op Register Hyp4 Bijzonderheden',
    verwacht: [{ bedrijfsnaam: 'Gemeente Amsterdam', verzendadres: 'Amstel 1\n1011 PN AMSTERDAM', rechtType: 'eigendom' }],
  },
  {
    dossier: 'Czaar Peterstraat 78',
    signaalId: 'f8d64ecf-bc8d-461e-bcb8-34ff86f50605',
    raw: 'Objectinformatie Adres Czaar Peterstraat 78-H 1018PR Amsterdam Rechten & aantekeningen 11-08-2026 Rechten Eigendom (recht van) Aandeel 1/1 Naam Spring Properties F S.à r.l. Adres Rue Henri M. Schnadt 2 L-2530 LUXEMBURG Luxemburg Postbus - Zetel LUXEMBURG KvK-nummer - Gebaseerd op Register Hyp4 Bijzonderheden',
    verwacht: [{ bedrijfsnaam: 'Spring Properties F S.à r.l.', verzendadres: 'Rue Henri M. Schnadt 2\nL-2530 LUXEMBURG\nLuxemburg', rechtType: 'eigendom' }],
  },
  {
    dossier: 'Heemraadssingel 241',
    signaalId: '4144ea5e-d202-4674-b3d5-8eabe1e923be',
    raw: 'Objectinformatie Adres Heemraadssingel 241 3023CD Rotterdam Rechten & aantekeningen 11-08-2026 Rechten Eigendom (recht van) Aandeel 1/2 Naam Willem Jan Christoffel Droog Adres Heemraadssingel 241 3023CD ROTTERDAM Gebaseerd op Register Hyp4 Eigendom (recht van) Aandeel 1/2 Naam Inge Christine Bodmer Adres - Gebaseerd op Register Hyp4 Bijzonderheden',
    verwacht: [{ naam: 'Willem Jan Christoffel Droog', verzendadres: 'Heemraadssingel 241\n3023 CD ROTTERDAM', rechtType: 'eigendom' }],
  },
  {
    dossier: 'Hemonystraat 66',
    signaalId: 'f37dd7c9-bb4e-4d10-b51a-245a07bfc62b',
    raw: 'Objectinformatie Adres Hemonystraat 66-H 1074BT Amsterdam Rechten & aantekeningen 11-08-2026 Rechten Eigendom (recht van) Aandeel 1/1 Naam Spring Properties E S.à r.l. Adres Rue Henri M. Schnadt 2 L-2530 LUXEMBURG Luxemburg Postbus - Zetel LUXEMBURG KvK-nummer - Gebaseerd op Register Hyp4 Bijzonderheden',
    verwacht: [{ bedrijfsnaam: 'Spring Properties E S.à r.l.', verzendadres: 'Rue Henri M. Schnadt 2\nL-2530 LUXEMBURG\nLuxemburg', rechtType: 'eigendom' }],
  },
  {
    dossier: 'Keizersgracht 210-1',
    signaalId: '575cefba-71f6-4f33-b300-92212c23c43b',
    raw: 'Objectinformatie Adres Keizersgracht 210-1 1016DX Amsterdam Rechten & aantekeningen 11-08-2026 Rechten Eigendom (recht van) Aandeel 1/1 Naam Nicolaas Pieter Willem Roijen Geboren afgeschermd te MAARSSEN Adres Am Schlaufenglan 13 D-66606 SANKT WENDEL Bondsrepubliek Duitsland Gebaseerd op Register Hyp4 Bijzonderheden',
    verwacht: [{ naam: 'Nicolaas Pieter Willem Roijen', verzendadres: 'Am Schlaufenglan 13\nD-66606 SANKT WENDEL\nBondsrepubliek Duitsland', rechtType: 'eigendom' }],
  },
  {
    dossier: 'Leimuidenstraat 35-H',
    signaalId: '372d1dc9-9f61-40f5-ada3-61684f59d480',
    raw: 'Objectinformatie Adres Leimuidenstraat 35-2 1059EE Amsterdam Rechten & aantekeningen 03-07-2026 Rechten Eigendom (recht van) Aandeel 1/1 Naam Dionysius Egbertus Willibrordus Riet Adres - Gebaseerd op Register Hyp4 Bijzonderheden',
    verwacht: [],
  },
  {
    dossier: 'Middenweg 145-H',
    signaalId: '1e1c1fa9-e12a-4a9b-a626-dcec15922e1f',
    raw: 'Objectinformatie Adres Middenweg 145-H 1098AL Amsterdam Rechten & aantekeningen 11-08-2026 Rechten Eigendom (recht van) Aandeel 1/1 Naam Elisabeth Wilhelmina Cleef Adres - Gebaseerd op Register Hyp4 Bijzonderheden',
    verwacht: [],
  },
  {
    dossier: 'Nassaukade 9-2',
    signaalId: '782a556c-7c8d-4158-9859-154d08dafc59',
    raw: 'Objectinformatie Adres Nassaukade 9-2 1052CE Amsterdam Rechten & aantekeningen 11-08-2026 Rechten Eigendom (recht van) Aandeel 1/1 Naam Marsel Zijden Adres - Gebaseerd op Register Hyp4 Bijzonderheden',
    verwacht: [],
  },
  {
    dossier: 'Nieuwezijds Voorburgwal 260-3',
    signaalId: 'f489d27d-5312-497f-96dc-a44af4dafece',
    raw: 'Objectinformatie Adres Nieuwezijds Voorburgwal 260-3 1012RS Amsterdam Rechten & aantekeningen 31-07-2026 Rechten Eigendom (recht van) Aandeel 1/1 Naam Stichting Hestia Adres Vogelenzangseweg 41-B 2114BB VOGELENZANG Postbus - Zetel BLOEMENDAAL KvK-nummer 41227124 Gebaseerd op Register Hyp4 Bijzonderheden',
    verwacht: [{ bedrijfsnaam: 'Stichting Hestia', verzendadres: 'Vogelenzangseweg 41-B\n2114 BB VOGELENZANG', rechtType: 'eigendom' }],
  },
  {
    dossier: 'Zieseniskade 12',
    signaalId: '00dc5620-3aa5-4d57-b9de-59d6e26db705',
    raw: 'Objectinformatie Adres Zieseniskade 12-1 1017RS Amsterdam Rechten & aantekeningen 31-07-2026 Rechten Eigendom (recht van) Aandeel 1/1 Naam Mighty Foong Holdings Limited Adres PO Box 850 OFFSHORE INCORPORATION CENTRE Anguilla Postbus - Zetel ANGUILLA KvK-nummer - Gebaseerd op Register Hyp4 Bijzonderheden',
    verwacht: [{ bedrijfsnaam: 'Mighty Foong Holdings Limited', verzendadres: 'PO Box 850\nOFFSHORE INCORPORATION CENTRE\nAnguilla', rechtType: 'eigendom' }],
  },
];

describe('BUILD A + A.1 — regressie voor de 10 dossiers uit issue #442', () => {
  it.each(dossiers)('$dossier ($signaalId)', ({ raw, verwacht }) => {
    expect(raw).not.toContain('\n');

    const genormaliseerd = normaliseerKadasterPdfTekst(raw);
    expect(genormaliseerd.split('\n')).toContain('Rechten');

    const voorstellen = extractKadasterAdresVoorstellenUitTekst(genormaliseerd);
    expect(voorstellen).toHaveLength(verwacht.length);
    verwacht.forEach((verwachtVoorstel, index) => {
      expect(voorstellen[index]).toEqual(expect.objectContaining(verwachtVoorstel));
    });
  });
});
