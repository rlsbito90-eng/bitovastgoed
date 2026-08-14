import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseKadasterPdfOwnerAddresses } from '../../../supabase/functions/_shared/kadasterPdfOwner';

const root = process.cwd();
const edgeBron = fs.readFileSync(path.join(root, 'supabase/functions/kadaster-pdf-eigenaar-extractie/index.ts'), 'utf8');
const textBron = fs.readFileSync(path.join(root, 'supabase/functions/_shared/kadasterPdfText.ts'), 'utf8');
const hookBron = fs.readFileSync(path.join(root, 'src/hooks/useVastgoedkansPdfEigenaarVerrijking.tsx'), 'utf8');

describe('BUILD 2.0B — eigenaaradres uit officieel Kadasterbericht/PDF', () => {
  it('koppelt een adres alleen wanneer de bekende eigenaar in hetzelfde tekstblok voorkomt', () => {
    const text = [
      'Rechthebbende',
      'Albertina Wilhelmina Enthoven',
      'Woonadres',
      'Prinsengracht 123',
      '1015 AB Amsterdam',
    ].join('\n');

    const matches = parseKadasterPdfOwnerAddresses(text, [{
      id: 'e-1',
      naam: 'A.W. Enthoven',
      alternatieveNamen: ['Albertina Wilhelmina Enthoven'],
    }]);

    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      ownerId: 'e-1',
      adres: 'Prinsengracht 123',
      postcode: '1015AB',
      plaats: 'Amsterdam',
    });
    expect(matches[0].confidence).toBeGreaterThanOrEqual(68);
  });

  it('neemt een los adres zonder eigenaarcontext niet over', () => {
    const text = ['Objectadres', 'Singel 150-1', '1015 AG Amsterdam'].join('\n');
    const matches = parseKadasterPdfOwnerAddresses(text, [{ id: 'e-1', naam: 'A.W. Enthoven' }]);
    expect(matches).toEqual([]);
  });

  it('houdt PDF-tekst in memory, gebruikt geen OCR-service en doet geen betaalde Kadastercall', () => {
    expect(textBron).toContain("from 'npm:unpdf@1.6.2'");
    expect(textBron).toContain('mergePages: true');
    expect(edgeBron).toContain("source: 'kadasterbericht_pdf'");
    expect(edgeBron).toContain(".download(document.storage_path)");
    expect(edgeBron).not.toContain('KADASTER_OBJECTINFORMATIE_API_KEY');
    expect(edgeBron).not.toContain('kadatawebservice');
    expect(edgeBron).not.toMatch(/tesseract|google vision|document ai|ocr\.space/i);
    expect(edgeBron).not.toContain("from('relaties')");
    expect(edgeBron).not.toContain('console.log(text');
  });

  it('vult alleen ontbrekende eigenaarvelden aan en markeert de gebruikte PDF-bron', () => {
    expect(edgeBron).toContain('if (!eigenaar.adres) patch.adres = match.adres');
    expect(edgeBron).toContain('if (!eigenaar.postcode) patch.postcode = match.postcode');
    expect(edgeBron).toContain('if (!eigenaar.plaats) patch.plaats = match.plaats');
    expect(edgeBron).toContain('details.pdf_adres_extractie');
    expect(edgeBron).toContain("status: match ? 'matched' : 'no_match'");
  });

  it('verrijkt automatisch alleen wanneer een nieuwe Rechten-PDF nog niet voor die eigenaar is verwerkt', () => {
    expect(hookBron).toContain("includes('rechten')");
    expect(hookBron).toContain("extractieMeta(k)?.document_id !== laatsteRechtenPdf.id");
    expect(hookBron).toContain("supabase.functions.invoke('kadaster-pdf-eigenaar-extractie'");
    expect(hookBron).toContain("queryKey: ['eigenaarsregister', 'vastgoedkans', vastgoedkansId]");
  });
});
