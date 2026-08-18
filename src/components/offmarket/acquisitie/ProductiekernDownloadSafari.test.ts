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
const apiBron = readFileSync(
  resolve(process.cwd(), 'api/productiekern-bat-download.ts'),
  'utf8',
);

describe('Productiekern downloadcontract voor Safari/WebKit', () => {
  it('klikt nooit programmatisch en gebruikt geen blob/ObjectURL als primaire pakketdownload', () => {
    expect(downloadBron).not.toContain('link.click()');
    expect(downloadBron).not.toContain('downloadBlob(');
    expect(downloadBron).not.toContain('URL.createObjectURL');
    expect(downloadBron).not.toContain('blob:');
    expect(vastlegBron).not.toContain('downloadProductiekernBestand');
  });

  it('bereidt signed links voor en laat de expliciete klik via een echte same-origin HTTPS response downloaden', () => {
    expect(downloadBron).toContain('Productiepakket voorbereiden');
    expect(downloadBron).toContain('action="/api/productiekern-bat-download"');
    expect(downloadBron).toContain('method="post"');
    expect(downloadBron).toContain('Productiebestanden downloaden (4)');
    expect(apiBron).toContain("Content-Type', 'application/zip'");
    expect(apiBron).toContain("Content-Disposition', `attachment;");
    expect(apiBron).toContain('bouwProductiekernZip(zipBestanden)');
  });

  it('begrenst de serverdownload tot exact vier signed bestanden uit de formele productiebucket', () => {
    expect(apiBron).toContain('parsed.bestanden.length !== 4');
    expect(apiBron).toContain("/storage/v1/object/sign/off-market-productie/");
    expect(apiBron).toContain("url.searchParams.get('token')");
    expect(apiBron).toContain("'-voorblad.pdf'");
    expect(apiBron).toContain("'-controlelijst.pdf'");
    expect(apiBron).toContain("'-brieven.pdf'");
    expect(apiBron).toContain("'-adreslabels.csv'");
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
