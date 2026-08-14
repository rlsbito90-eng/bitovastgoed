import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractKadasterAdresVoorstellenUitTekst } from '../../../supabase/functions/_shared/kadasterPdfAdresParser';
import { normaliseerKadasterPdfTekst } from '../../../supabase/functions/_shared/kadasterPdfTekstNormalisatie';

const root = process.cwd();
const hookBron = fs.readFileSync(path.join(root, 'src/hooks/useVastgoedkansPdfEigenaarVerrijking.tsx'), 'utf8');
const migratieBron = fs.readFileSync(path.join(root, 'supabase/migrations/20260814161000_eigenaar_kadaster_record_idempotentie.sql'), 'utf8');

describe('FIX 2.0B — echte Kadaster-PDF-layout en harde idempotentie', () => {
  it('herkent Naam + Adres + losse postcode/plaats-regels uit het echte Kadasterformat', () => {
    const text = [
      'Objectinformatie',
      'Singel 150-H',
      '1015AG',
      'Amsterdam',
      'Algemeen',
      'Kadastrale kaart',
      'Kadastrale aanduiding Amsterdam M 5368',
      'Adres Singel 150-H',
      '1015AG',
      'Amsterdam',
      'Actualiteitsinformatie',
      'Rechten & aantekeningen 10-08-2026',
      'Rechten',
      'Eigendom (recht van)',
      'Aandeel 1/1',
      'Naam Albertina Wilhelmina Enthoven',
      'Geboren 19-03-1961',
      'te AMSTERDAM',
      'Adres Singel 150-1',
      '1015AG',
      'AMSTERDAM',
      'Gebaseerd op Register Hyp4 Deel 11458 nummer 21',
      'Reeks Amsterdam',
      'Bijzonderheden',
      'Aantekeningen Er zijn geen aantekeningen bekend',
    ].join('\n');

    const voorstellen = extractKadasterAdresVoorstellenUitTekst(normaliseerKadasterPdfTekst(text));
    expect(voorstellen).toHaveLength(1);
    expect(voorstellen[0]).toMatchObject({
      naam: 'Albertina Wilhelmina Enthoven',
      aandeel: '1/1',
      verzendadres: 'Singel 150-1\n1015 AG AMSTERDAM',
      confidence: 'hoog',
      rechtType: 'eigendom',
    });
  });

  it('probeert een eerdere no_match bij een volgende dossieropening opnieuw', () => {
    expect(hookBron).toContain("meta?.status === 'no_match'");
    expect(hookBron).toContain('laatstePoging.current === signature');
  });

  it('dwingt één koppeling af per Vastgoedkans + Kadaster-record', () => {
    expect(migratieBron).toContain('create unique index if not exists eigenaar_koppelingen_vastgoedkans_kadaster_record_unique');
    expect(migratieBron).toContain('(vastgoedkans_id, kadaster_record_id)');
    expect(migratieBron).toContain('kadaster_record_id is not null');
  });
});
