import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const downloadBron = readFileSync(
  resolve(process.cwd(), 'src/components/offmarket/acquisitie/ProductiekernVastgelegdeDocumentenDownload.tsx'),
  'utf8',
);
const vastlegBron = readFileSync(
  resolve(process.cwd(), 'src/components/offmarket/acquisitie/ProductiekernProductiepakketVastleggen.tsx'),
  'utf8',
);

describe('Productiekern downloadcontract voor Safari/WebKit', () => {
  it('downloadt niet meer automatisch na een async Storage-fetch', () => {
    expect(downloadBron).not.toContain('link.click()');
    expect(downloadBron).not.toContain('downloadBlob(');
    expect(vastlegBron).not.toContain('downloadProductiekernBestand');
  });

  it('bereidt geregistreerde Storage-bytes eerst voor en toont daarna vier expliciete downloadlinks', () => {
    expect(downloadBron).toContain('downloadProductiekernStorageObject(pad)');
    expect(downloadBron).toContain('URL.createObjectURL(blob)');
    expect(downloadBron).toContain('href={bestand.url}');
    expect(downloadBron).toContain('download={bestand.bestandsnaam}');
    expect(downloadBron).toContain('Geregistreerde bestanden voorbereiden');
  });

  it('houdt servervastlegging en lokale download als twee afzonderlijke stappen', () => {
    expect(vastlegBron).toContain('Productiepakket vastleggen');
    expect(vastlegBron).toContain('Downloaden is nu afzonderlijk beschikbaar.');
    expect(vastlegBron).not.toContain('vastgelegd en gedownload');
  });
});
