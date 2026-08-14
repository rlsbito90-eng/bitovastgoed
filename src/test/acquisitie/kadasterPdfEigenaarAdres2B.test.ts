import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractKadasterAdresVoorstellenUitTekst } from '../../../supabase/functions/_shared/kadasterPdfAdresParser';
import { normaliseerKadasterPdfTekst } from '../../../supabase/functions/_shared/kadasterPdfTekstNormalisatie';

const root = process.cwd();
const edgeBron = fs.readFileSync(path.join(root, 'supabase/functions/kadaster-pdf-eigenaar-extractie/index.ts'), 'utf8');
const hookBron = fs.readFileSync(path.join(root, 'src/hooks/useVastgoedkansPdfEigenaarVerrijking.tsx'), 'utf8');

describe('BUILD 2.0B — eigenaaradres uit officieel Kadasterbericht/PDF', () => {
  it('hergebruikt de bestaande parser om naam en verzendadres uit een eigenaarblok te halen', () => {
    const text = normaliseerKadasterPdfTekst([
      'Objectinformatie',
      'Singel 150-1',
      '1015 AG AMSTERDAM',
      'Rechten',
      'Eigendom (recht van)',
      'Aandeel 1/1',
      'Naam Albertina Wilhelmina Enthoven',
      'Adres Prinsengracht 123',
      '1015 AB AMSTERDAM',
      'Bijzonderheden',
    ].join('\n'));

    const voorstellen = extractKadasterAdresVoorstellenUitTekst(text);
    expect(voorstellen).toHaveLength(1);
    expect(voorstellen[0]).toMatchObject({
      naam: 'Albertina Wilhelmina Enthoven',
      aandeel: '1/1',
      verzendadres: 'Prinsengracht 123\n1015 AB AMSTERDAM',
      confidence: 'hoog',
    });
  });

  it('neemt een los objectadres zonder eigenaar-Adres-veld niet over', () => {
    const text = normaliseerKadasterPdfTekst([
      'Objectinformatie',
      'Singel 150-1',
      '1015 AG AMSTERDAM',
      'Rechten',
      'Eigendom (recht van)',
      'Naam Albertina Wilhelmina Enthoven',
      'Bijzonderheden',
    ].join('\n'));
    expect(extractKadasterAdresVoorstellenUitTekst(text)).toEqual([]);
  });

  it('gebruikt dezelfde bewezen PDF-stack, geen OCR-service en geen betaalde Kadastercall', () => {
    expect(edgeBron).toContain("from 'npm:unpdf@0.12.1'");
    expect(edgeBron).toContain('normaliseerKadasterPdfTekst');
    expect(edgeBron).toContain('extractKadasterAdresVoorstellenUitTekst');
    expect(edgeBron).toContain('mergePages: true');
    expect(edgeBron).toContain("source: 'kadasterbericht_pdf'");
    expect(edgeBron).toContain(".download(document.storage_path)");
    expect(edgeBron).not.toContain('KADASTER_OBJECTINFORMATIE_API_KEY');
    expect(edgeBron).not.toContain('kadatawebservice');
    expect(edgeBron).not.toMatch(/tesseract|google vision|document ai|ocr\.space/i);
    expect(edgeBron).not.toContain("from('relaties')");
    expect(edgeBron).not.toContain('console.log(rawText');
    expect(edgeBron).not.toContain('console.log(normalised');
  });

  it('koppelt alleen een unieke eigenaarnaam en vult alleen ontbrekende velden aan', () => {
    expect(edgeBron).toContain('const kandidaten = eigenaren.filter');
    expect(edgeBron).toContain('if (kandidaten.length !== 1) continue');
    expect(edgeBron).toContain('if (!eigenaar.adres) patch.adres = match.adres.adres');
    expect(edgeBron).toContain('if (!eigenaar.postcode) patch.postcode = match.adres.postcode');
    expect(edgeBron).toContain('if (!eigenaar.plaats) patch.plaats = match.adres.plaats');
    expect(edgeBron).toContain('details.pdf_adres_extractie');
    expect(edgeBron).toContain("status: match ? 'matched' : 'no_match'");
  });

  it('verrijkt een nieuwe Rechten-PDF en probeert een eerdere no_match later veilig opnieuw', () => {
    expect(hookBron).toContain("includes('rechten')");
    expect(hookBron).toContain('meta?.document_id !== laatsteRechtenPdf.id');
    expect(hookBron).toContain("meta?.status === 'no_match'");
    expect(hookBron).toContain('laatstePoging.current === signature');
    expect(hookBron).toContain("supabase.functions.invoke('kadaster-pdf-eigenaar-extractie'");
    expect(hookBron).toContain("queryKey: ['eigenaarsregister', 'vastgoedkans', vastgoedkansId]");
  });
});
