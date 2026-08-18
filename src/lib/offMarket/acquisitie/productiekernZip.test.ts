import { describe, expect, it } from 'vitest';

import { bouwProductiekernZip } from './productiekernZip';

const encoder = new TextEncoder();

function leesBlobAlsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Blob lezen mislukt.'));
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.readAsArrayBuffer(blob);
  });
}

describe('bouwProductiekernZip', () => {
  it('bouwt één ZIP met alle vier formele BAT-bestanden', async () => {
    const namen = [
      'BAT2026081801-v1-voorblad.pdf',
      'BAT2026081801-v1-controlelijst.pdf',
      'BAT2026081801-v1-brieven.pdf',
      'BAT2026081801-v1-adreslabels.csv',
    ];
    const blob = bouwProductiekernZip(
      namen.map((naam, index) => ({ naam, bytes: encoder.encode(`bestand-${index}`) })),
      new Date(2026, 7, 18, 12, 0, 0),
    );

    expect(blob.type).toBe('application/zip');
    const bytes = new Uint8Array(await leesBlobAlsArrayBuffer(blob));
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const tekst = new TextDecoder().decode(bytes);
    for (const naam of namen) expect(tekst).toContain(naam);
    expect(Array.from(bytes.slice(-22, -18))).toEqual([0x50, 0x4b, 0x05, 0x06]);
  });

  it('weigert dubbele en onveilige bestandsnamen', () => {
    const bytes = encoder.encode('x');
    expect(() => bouwProductiekernZip([
      { naam: 'zelfde.pdf', bytes },
      { naam: 'zelfde.pdf', bytes },
    ])).toThrow('dubbele bestandsnaam');
    expect(() => bouwProductiekernZip([{ naam: '../verboden.pdf', bytes }])).toThrow('ongeldige bestandsnaam');
  });
});
