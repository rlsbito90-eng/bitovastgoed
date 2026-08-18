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
  it('klikt nooit programmatisch nadat async Storage-fetches zijn afgerond', () => {
    expect(downloadBron).not.toContain('link.click()');
    expect(downloadBron).not.toContain('downloadBlob(');
    expect(vastlegBron).not.toContain('downloadProductiekernBestand');
  });

  it('maakt eerst het ZIP-pakket en laat de uiteindelijke download aan een expliciete ankerclick', () => {
    expect(downloadBron).toContain('Productiepakket voorbereiden');
    expect(downloadBron).toContain('href={pakketUrl}');
    expect(downloadBron).toContain('download={pakketNaam}');
    expect(downloadBron).toContain('Productiebestanden downloaden (4)');
    expect(downloadBron).toContain('bouwProductiekernZip(zipBestanden)');
  });

  it('behoudt voor losse herstelbestanden kortlevende signed HTTPS-downloadlinks', () => {
    expect(storageBron).toContain('.createSignedUrl(veiligPad, verlooptNaSeconden, { download: true })');
    expect(downloadBron).toContain('maakProductiekernSignedDownloadUrl(pad)');
    expect(downloadBron).toContain('href={bestand.url}');
    expect(downloadBron).toContain('target="_blank"');
    expect(downloadBron).toContain('rel="noopener noreferrer"');
    expect(downloadBron).not.toContain('download={bestand.bestandsnaam}');
  });

  it('houdt servervastlegging en lokale download als twee afzonderlijke read/write stappen', () => {
    expect(vastlegBron).toContain('Productiepakket vastleggen');
    expect(vastlegBron).toContain('Downloaden is nu afzonderlijk beschikbaar.');
    expect(vastlegBron).not.toContain('vastgelegd en gedownload');
  });
});
