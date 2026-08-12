import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const page = readFileSync(resolve(process.cwd(), 'src/pages/VastgoedkansenVindenPage.tsx'), 'utf8');
const component = readFileSync(resolve(process.cwd(), 'src/components/bag/BagServicePandenlijst.tsx'), 'utf8');
const review = readFileSync(resolve(process.cwd(), 'src/components/bag/BagSelectieReview.tsx'), 'utf8');
const dialog = readFileSync(resolve(process.cwd(), 'src/components/bag/BagHandmatigePromotieDialog.tsx'), 'utf8');

describe('BAG Pandenverkenner 2.0 lijst-/filterinterface', () => {
  it('is standaard uit en vereist een expliciete niet-geheime featureflag', () => {
    expect(page).toContain("VITE_BAG_QUERY_SERVICE_ENABLED === 'true'");
    expect(page).toContain('<BagServicePandenlijst scopeCode={BAG_SERVICE_SCOPE}');
    expect(page).toContain('useOffMarketSignalenAlle');
    expect(page).not.toContain('service_role');
  });

  it('gebruikt alleen de geauthenticeerde v4-transportadapter en houdt v2/v3 buiten de UI', () => {
    expect(component).toContain("from '@/lib/bag/queryTransport'");
    expect(component).toContain('zoekPandenViaServiceV4');
    expect(component).not.toContain('zoekPandenViaServiceV2');
    expect(component).not.toContain('zoekPandenViaServiceV3');
    expect(component).toContain('vboOppervlakteSomVan');
    expect(component).toContain('statussen: serverFilters.statussen');
    expect(component).toContain('wijkCodes: serverFilters.wijkCodes');
    expect(component).toContain('buurtCodes: serverFilters.buurtCodes');
    expect(component).toContain('gebruiksdoelen: filters.gebruiksdoelen');
    expect(component).not.toContain('createClient');
    expect(component).not.toContain('fetch(');
    expect(component).not.toContain('DATABASE_URL');
  });

  it('bouwt een begrensde server-side zoeklijst zonder automatische opslag', () => {
    expect(component).toContain('const PAGE_SIZE = 100');
    expect(component).toContain('Private BAG-Pandenverkenner 2.0');
    expect(component).toContain('Server-side zoeken in de actieve BAG-index');
    expect(component).toContain('Alleen zonder VBO');
    expect(component).toContain('Selecteer straat');
    expect(component).not.toMatch(/maplibre|react-map/i);
    expect(component).not.toContain('addKans');
  });

  it('gebruikt korte GBO/VBO-labels en echte multiselect voor BAG-status', () => {
    expect(component).toContain('GBO totaal vanaf');
    expect(component).toContain('GBO totaal t/m');
    expect(component).toContain('Grootste VBO vanaf');
    expect(component).toContain('Aantal VBO vanaf');
    expect(component).toContain('Pandstatus');
    expect(component).toContain('toggleStatus');
    expect(component).toContain('serverFilters.statussen.includes(status)');
    expect(component).toContain('Sloopvergunning verleend');
    expect(component).toContain('m² GBO');
    expect(component).not.toContain('m² VBO-som');
  });

  it('maakt gebruiksfunctie en gebiedsfilters multiselect en legt OF/EN-semantiek uit', () => {
    expect(component).toContain('Gebruiksfunctie');
    expect(component).toContain('BagGebiedsfilters');
    expect(component).toContain('previous.gebruiksdoelen.filter');
    expect(component).toContain('[...previous.gebruiksdoelen, functie]');
    expect(component).toContain('Binnen Pandstatus, Wijk, Buurt en Gebruiksfunctie geldt OF; tussen verschillende filtergroepen geldt EN.');
  });

  it('maakt sortering zichtbaar en benoemt dat deze op de geladen pagina werkt', () => {
    expect(component).toContain('Sorteer geladen pagina');
    expect(component).toContain('Bouwjaar oud → nieuw');
    expect(component).toContain('Bouwjaar nieuw → oud');
    expect(component).toContain('GBO groot → klein');
    expect(component).toContain('Aantal VBO hoog → laag');
    expect(component).toContain('Sortering geldt nu voor de geladen pagina.');
  });

  it('wist oude resultaten zodra server-side zoekfilters wijzigen', () => {
    expect(component).toContain('[serverFilters, filters.gebruiksdoelen, filters.alleenGemengd]');
    expect(component).toContain('setPaginas([])');
    expect(component).toContain('setCursor(null)');
  });

  it('toont echte pagina-navigatie en geen steeds langer wordende lijst', () => {
    expect(component).toContain('const [paginas, setPaginas]');
    expect(component).toContain('const [paginaIndex, setPaginaIndex]');
    expect(component).toContain('gaNaarPagina');
    expect(component).toContain('gaNaarVolgende');
    expect(component).toContain('Pagina {paginaIndex + 1}');
    expect(component).toContain('Vorige');
    expect(component).toContain('Volgende');
    expect(component).not.toContain('Volgende 100 laden');
    expect(component).not.toContain('[...previous, ...nieuw]');
  });

  it('nummert panden doorlopend en biedt een naar-bovenactie', () => {
    expect(component).toContain('paginaIndex * PAGE_SIZE + index + 1');
    expect(component).toContain('Volgnummer');
    expect(component).toContain('aria-label="Naar boven"');
    expect(component).toContain("window.scrollTo({ top: 0, behavior: 'smooth' })");
  });

  it('houdt selectie lokaal en vereist een afzonderlijke preflightreview', () => {
    expect(component).toContain('beoordeelBagSelectie');
    expect(component).toContain('Controleer selectie');
    expect(component).toContain('BagSelectieReview');
    expect(review).toContain('Er is nog niets opgeslagen.');
    expect(component).toContain('maximaalAantal: 250');
    expect(component).not.toContain('addKans');
  });

  it('promoveert alleen na groene preflight en een afzonderlijke dialoog', () => {
    expect(component).toContain("if (!preflight?.toegestaan) return");
    expect(component).toContain('BagHandmatigePromotieDialog');
    expect(review).toContain('Toevoegen aan Vastgoedkansen');
    expect(page).toContain('onHandmatigPromoveren={promoveerPrivateBagPanden}');
  });

  it('gebruikt één expliciete bevestigingsactie zonder dubbele checkbox', () => {
    expect(dialog).toContain('toevoegen aan Vastgoedkansen');
    expect(dialog).toContain('Er worden geen Objecten of Deals gemaakt');
    expect(dialog).not.toContain("from '@/components/ui/checkbox'");
    expect(dialog).not.toContain('groene preflight gecontroleerd');
  });
});

describe('BAG preflightpositie', () => {
  it('toont de review vóór de pandenlijst en scrollt er na controle naartoe', () => {
    const preflightIndex = component.indexOf('{preflight && <div ref={lijstReviewRef}');
    const lijstIndex = component.indexOf('{!panden.length ?');
    const actiesIndex = component.indexOf('Controleer selectie');
    expect(preflightIndex).toBeGreaterThan(-1);
    expect(lijstIndex).toBeGreaterThan(-1);
    expect(actiesIndex).toBeLessThan(preflightIndex);
    expect(preflightIndex).toBeLessThan(lijstIndex);
    expect(component).toContain("reviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })");
    expect(component).toContain("weergave === 'kaart' ? kaartReviewRef : lijstReviewRef");
  });
});
