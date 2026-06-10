// Fase 4K.5 — Kadasterbericht/PDF helpers.
// We testen alleen pure helpers uit `_pdf.ts` (geen Deno-runtime nodig):
//   - PDF-extractie herkent base64/pdf payload uit een edge response.
//   - Padbouw/bestandsnaam is veilig (geen rare tekens, .pdf extensie).
import { describe, it, expect } from 'vitest';
import {
  extractPdfFromResponse,
  buildKadasterPdfPad,
} from '../../../supabase/functions/kadaster-objectinformatie/_pdf';

// "%PDF-1.4\n..." base64-prefix → JVBERi (de helper accepteert >=200 chars).
const PDF_B64 =
  'JVBERi0xLjQK' + 'A'.repeat(400);

describe('extractPdfFromResponse', () => {
  it('herkent base64-pdf in een geneste edge response', () => {
    const resp = {
      products: [
        { code: 'rechten', data: { bericht: { pdf: PDF_B64 } } },
      ],
    };
    const hit = extractPdfFromResponse(resp);
    expect(hit).not.toBeNull();
    expect(hit!.base64.startsWith('JVBERi')).toBe(true);
    expect(hit!.bytes).toBeGreaterThan(200);
    // Voorkeurspad bevat een pdf-achtige sleutel.
    expect(hit!.source_key).toMatch(/pdf|bericht/i);
  });

  it('strip data-URL prefix', () => {
    const dataUrl = 'data:application/pdf;base64,' + PDF_B64;
    const hit = extractPdfFromResponse({ kadasterbericht: dataUrl });
    expect(hit).not.toBeNull();
    expect(hit!.base64.startsWith('data:')).toBe(false);
    expect(hit!.base64.startsWith('JVBERi')).toBe(true);
  });

  it('geeft null als er geen pdf in zit', () => {
    expect(extractPdfFromResponse({ foo: 'bar', n: 1 })).toBeNull();
    expect(extractPdfFromResponse(null)).toBeNull();
  });

  it('faalt veilig op te korte/niet-pdf strings', () => {
    expect(extractPdfFromResponse({ pdf: 'JVBERi-short' })).toBeNull();
  });
});

describe('buildKadasterPdfPad', () => {
  it('object-pad gebruikt object_id/kadaster en eindigt op .pdf', () => {
    const { storagePath, bestandsnaam } = buildKadasterPdfPad({
      objectId: 'obj-1',
      signaalId: null,
      zoekadres: '3273AV 9',
      producten: ['rechten'],
      fetchedAt: '2026-06-10T12:34:56Z',
      fileId: 'file-uuid',
    });
    expect(storagePath.startsWith('obj-1/kadaster/')).toBe(true);
    expect(bestandsnaam.endsWith('.pdf')).toBe(true);
    expect(bestandsnaam).toContain('2026-06-10');
    expect(bestandsnaam).toContain('rechten');
  });

  it('signaal-pad gebruikt signaal/<id>/kadaster wanneer object ontbreekt', () => {
    const { storagePath } = buildKadasterPdfPad({
      objectId: null,
      signaalId: 'sig-1',
      zoekadres: '1234AB 5',
      producten: ['waarde'],
      fetchedAt: '2026-06-10T00:00:00Z',
      fileId: 'f2',
    });
    expect(storagePath.startsWith('signaal/sig-1/kadaster/')).toBe(true);
  });

  it('saneert rare tekens uit zoekadres/producten', () => {
    const { storagePath, bestandsnaam } = buildKadasterPdfPad({
      objectId: 'obj-x',
      signaalId: null,
      zoekadres: 'A/B "C" \\D',
      producten: ['rechten', 'waarde'],
      fetchedAt: '2026-01-02T00:00:00Z',
      fileId: 'f3',
    });
    // Geen pad-traversal of quotes terug.
    expect(storagePath).not.toMatch(/["\\]/);
    expect(storagePath).not.toContain('/A/B');
    expect(bestandsnaam).toMatch(/^Kadasterbericht_.+\.pdf$/);
  });
});
