import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractKadasterAdresVoorstellenUitTekst } from '../../../supabase/functions/_shared/kadasterPdfAdresParser';
import { normaliseerKadasterPdfTekst } from '../../../supabase/functions/_shared/kadasterPdfTekstNormalisatie';

const root = process.cwd();
const edgeBron = fs.readFileSync(
  path.join(root, 'supabase/functions/offmarket-kadaster-pdf-eigenaar-extractie/index.ts'),
  'utf8',
);

describe('Off-Market — adresherstel uit bestaand Kadasterbericht', () => {
  it('houdt Geboren/te buiten de eigenaarnaam en leest het adres uit hetzelfde rechtenblok', () => {
    const text = normaliseerKadasterPdfTekst([
      'Objectinformatie',
      'Nassaukade 9-2',
      '1052 CG AMSTERDAM',
      'Rechten',
      'Eigendom (recht van)',
      'Aandeel 1/1',
      'Naam Marsel Zijden',
      'Geboren 26-10-1965',
      'te BANJUWANGI',
      'Adres Voorbeeldstraat 12',
      '1234 AB UTRECHT',
      'Bijzonderheden',
    ].join('\n'));

    expect(extractKadasterAdresVoorstellenUitTekst(text)).toEqual([
      expect.objectContaining({
        naam: 'Marsel Zijden',
        verzendadres: 'Voorbeeldstraat 12\n1234 AB UTRECHT',
      }),
    ]);
  });

  it('gebruikt de bewezen shared parser en bestaande raw_limited-rechten, zonder nieuwe Kadastercall', () => {
    expect(edgeBron).toContain("extractKadasterAdresVoorstellenUitTekst");
    expect(edgeBron).toContain('normaliseerKadasterPdfTekst');
    expect(edgeBron).toContain('kandidatenUitBestaandeRechten');
    expect(edgeBron).toContain('combineerKandidaten');
    expect(edgeBron).toContain(".download(document.storage_path)");
    expect(edgeBron).toContain('mergePages: true');
    expect(edgeBron).not.toContain('KADASTER_OBJECTINFORMATIE_API_KEY');
    expect(edgeBron).not.toContain('kadatawebservice');
    expect(edgeBron).not.toMatch(/tesseract|google vision|document ai|ocr\.space/i);
  });

  it('herstelt oude automatisch vervuilde namen alleen binnen Kadaster-herstelcontext', () => {
    expect(edgeBron).toContain("replace(/\\s+Geboren\\s+\\d{1,2}-\\d{1,2}-\\d{4}\\s+te\\s+.+$/i, '')");
    expect(edgeBron).toContain("huidig.eigenaar_controle_nodig === true");
    expect(edgeBron).toContain("eigenaarbron: 'kadaster'");
  });
});
