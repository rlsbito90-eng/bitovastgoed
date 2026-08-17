import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const downloadBron = readFileSync(
  resolve(process.cwd(), 'src/components/offmarket/acquisitie/ProductiekernVastgelegdeDocumentenDownload.tsx'),
  'utf8',
);
const storageBron = readFileSync(
  resolve(process.cwd(), 'src/lib/offMarket/acquisitie/productiekernBrowserStorage.ts'),
  'utf8',
);
const vastlegBron = readFileSync(
  resolve(process.cwd(), 'src/components/offmarket/acquisitie/ProductiekernProductiepakketVastleggen.tsx'),
  'utf8',
);

describe('Productiekern downloadcontract voor Safari/WebKit', () => {
  it('downloadt niet programmatisch na een async Storage-fetch', () => {
    expect(downloadBron).not.toContain('link.click()');
    expect(downloadBron).not.toContain('downloadBlob(');
    expect(downloadBron).not.toContain('URL.createObjectURL');
    expect(vastlegBron).not.toContain('downloadProductiekernBestand');
  });

  it('maakt voor geregistreerde private objecten kortlevende signed HTTPS-downloadlinks', () => {
    expect(storageBron).toContain('.createSignedUrl(veiligPad, verlooptNaSeconden, { download: true })');
    expect(downloadBron).toContain('maakProductiekernSignedDownloadUrl(pad)');
    expect(downloadBron).toContain('href={bestand.url}');
    expect(downloadBron).toContain('target="_blank"');
    expect(downloadBron).toContain('rel="noopener noreferrer"');
    expect(downloadBron).toContain('Tijdelijke downloadlinks maken');
    expect(downloadBron).not.toContain('download={bestand.bestandsnaam}');
  });

  it('houdt servervastlegging en lokale download als twee afzonderlijke read/write stappen', () => {
    expect(vastlegBron).toContain('Productiepakket vastleggen');
    expect(vastlegBron).toContain('Downloaden is nu afzonderlijk beschikbaar.');
    expect(vastlegBron).not.toContain('vastgelegd en gedownload');
  });
});
