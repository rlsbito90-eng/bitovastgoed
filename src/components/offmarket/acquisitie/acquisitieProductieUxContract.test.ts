import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const selectieBron = readFileSync(
  resolve(process.cwd(), 'src/components/offmarket/acquisitie/AcquisitieSelectieTab.tsx'),
  'utf8',
);
const paginaBron = readFileSync(resolve(process.cwd(), 'src/pages/OffMarketPage.tsx'), 'utf8');
const logoBron = readFileSync(resolve(process.cwd(), 'src/lib/pdf/logo.ts'), 'utf8');
const formeleBriefBron = readFileSync(
  resolve(process.cwd(), 'src/components/offmarket/acquisitie/ProductiekernBrievenPDF.tsx'),
  'utf8',
);
const batchWerkbakBron = readFileSync(
  resolve(process.cwd(), 'src/components/offmarket/acquisitie/ProductiekernPrintbatchWerkbak.tsx'),
  'utf8',
);
const vernieuwBron = readFileSync(
  resolve(process.cwd(), 'src/components/offmarket/acquisitie/ProductiekernBatchDocumentversieVernieuwen.tsx'),
  'utf8',
);
const downloadBron = readFileSync(
  resolve(process.cwd(), 'src/components/offmarket/acquisitie/ProductiekernVastgelegdeDocumentenDownload.tsx'),
  'utf8',
);

describe('Acquisitieselectie productie-UX-contract', () => {
  it('toont geen tweede, concurrerende Productiekern-werkbak onder het hoofdscherm', () => {
    expect(paginaBron).not.toContain('ProductiekernAcquisitieMount');
    expect(selectieBron).toContain('acquisitie-printbatchbeheer');
    expect(selectieBron).toContain("subfilter === 'printen_posten'");
  });

  it('maakt BR en BAT onderdeel van de algemene zoek- en lijstcontext', () => {
    expect(selectieBron).toContain('Zoek adres, eigenaar, BR- of BAT-nummer');
    expect(selectieBron).toContain('productieOverzicht.nummersPerSignaal');
    expect(selectieBron).toContain('acquisitie-rij-briefnummer');
    expect(selectieBron).toContain('acquisitie-rij-batchnummer');
  });

  it('bundelt het gekleurde beeldmerk lokaal en gebruikt één briefkop voor concept en productie', () => {
    expect(logoBron).toContain("import bitoIcon from '@/assets/bito-icon.png'");
    expect(logoBron).not.toContain('bito-icon.png.asset.json');
    expect(formeleBriefBron).not.toContain("mode: 'full'");
    expect(formeleBriefBron).not.toContain('BITO_LOGO_URL');
  });

  it('verbergt productieacties totdat daadwerkelijk dossiers van de betreffende bron zijn geselecteerd', () => {
    expect(selectieBron).toContain('totaalSelectie > 0 && (');
    expect(selectieBron).toContain('bulkSelectie.size > 0 &&');
    expect(selectieBron).toContain('bulkVastgoedkansSelectie.size > 0 &&');
    expect(selectieBron).toContain('Radar-productie');
    expect(selectieBron).toContain('Pandenverkenner-brieven');
    expect(selectieBron).not.toContain('Selecteer alle geschikte');
  });

  it('houdt de volledige selectie-actiebalk sticky en safe-area-aware op mobiel', () => {
    expect(selectieBron).toContain("position: 'sticky'");
    expect(selectieBron).toContain("bottom: 'calc(0.5rem + env(safe-area-inset-bottom))'");
    expect(selectieBron).toContain('grid grid-cols-2 gap-2 sm:flex sm:flex-wrap');
  });

  it('biedt bij een nog niet geprinte BAT een expliciete append-only kleurupgrade', () => {
    expect(batchWerkbakBron).toContain('ProductiekernBatchDocumentversieVernieuwen');
    expect(vernieuwBron).toContain('Nieuwe documentversie maken');
    expect(vernieuwBron).toContain("batch.status !== 'documenten_gegenereerd' || batch.printdatum");
    expect(vernieuwBron).toContain('documentversie: geladen.batch.documentversie + 1');
    expect(vernieuwBron).toContain('vernieuwProductiekernBatchdocumenten');
    expect(vernieuwBron).toContain('De eerdere versie blijft bewaard');
  });

  it('houdt printbatchkoppen en bestandsacties bruikbaar op een smal scherm', () => {
    expect(batchWerkbakBron).toContain('sm:flex-row');
    expect(batchWerkbakBron).toContain('grid-cols-[minmax(0,1fr)_auto]');
    expect(downloadBron).toContain('ZIP-download klaarzetten');
    expect(downloadBron).toContain('w-full min-w-0 justify-center whitespace-normal');
    expect(vernieuwBron).toContain('w-full min-w-0 justify-center whitespace-normal');
    expect(downloadBron).not.toContain('Productiebestanden opnieuw downloaden');
  });
});
