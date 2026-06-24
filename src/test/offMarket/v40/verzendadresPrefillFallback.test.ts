// V40 — Prefill-fallback en placeholderveiligheid voor verzendadres.
//
// Bij heropenen van een bestaande brief (b.v. een e-mailconcept) waarvan
// het opgeslagen verzendadres leeg is, mag een betrouwbare prefillbron
// dienen als initiële waarde. Een niet-lege opgeslagen waarde wordt nooit
// overschreven. De zichtbare placeholder mag nooit als echte data
// worden behandeld door het brief-viewmodel.
import { describe, it, expect } from 'vitest';
import {
  buildBriefViewModel, VERZENDADRES_PLACEHOLDER,
} from '@/lib/offMarket/brief';

function isEchteWaarde(v: string | null | undefined): boolean {
  if (!v) return false;
  const norm = v.replace(/\s+/g, ' ').trim().toLowerCase();
  if (!norm) return false;
  const ph = VERZENDADRES_PLACEHOLDER.replace(/\s+/g, ' ').trim().toLowerCase();
  return norm !== ph;
}

// Helper die exact spiegelt wat de dialog doet bij initialBrief.
function bepaalInitialVerzendadres(
  initialBrief: { verzendadres: string | null },
  prefill: { verzendadres: string },
): string {
  const opgeslagen = (initialBrief.verzendadres ?? '').trim();
  return isEchteWaarde(opgeslagen) ? opgeslagen : (prefill.verzendadres ?? '');
}

describe('verzendadres prefill-fallback bij heropenen', () => {
  it('leeg opgeslagen adres → gebruikt prefill als fallback', () => {
    const v = bepaalInitialVerzendadres(
      { verzendadres: '' },
      { verzendadres: 'Eigenaarstraat 12\n1234 AB Stad' },
    );
    expect(v).toBe('Eigenaarstraat 12\n1234 AB Stad');
  });

  it('null opgeslagen adres → gebruikt prefill als fallback', () => {
    const v = bepaalInitialVerzendadres(
      { verzendadres: null },
      { verzendadres: 'Laan 1\n2000 AA Plaats' },
    );
    expect(v).toBe('Laan 1\n2000 AA Plaats');
  });

  it('placeholder als opgeslagen waarde → behandelt als leeg en gebruikt prefill', () => {
    const v = bepaalInitialVerzendadres(
      { verzendadres: VERZENDADRES_PLACEHOLDER },
      { verzendadres: 'Echtweg 3\n3000 AA Stad' },
    );
    expect(v).toBe('Echtweg 3\n3000 AA Stad');
  });

  it('niet-leeg opgeslagen adres → wordt nooit overschreven door prefill', () => {
    const v = bepaalInitialVerzendadres(
      { verzendadres: 'Handmatig 9\n1000 ZZ Plaats' },
      { verzendadres: 'Andere 1\n2222 BB Anders' },
    );
    expect(v).toBe('Handmatig 9\n1000 ZZ Plaats');
  });

  it('leeg adres én geen prefill → blijft leeg, geen placeholder als waarde', () => {
    const v = bepaalInitialVerzendadres(
      { verzendadres: null },
      { verzendadres: '' },
    );
    expect(v).toBe('');
    expect(isEchteWaarde(v)).toBe(false);
  });
});

describe('placeholder mag nooit als echte adresdata gelden', () => {
  it('viewmodel met placeholder als verzendadres → heeftVerzendadres=false', () => {
    const vm = buildBriefViewModel({
      eigenaarNaam: 'Jan',
      eigenaarBedrijfsnaam: '',
      verzendadres: VERZENDADRES_PLACEHOLDER,
      objectomschrijving: 'Hoofdstraat 1',
      onderwerp: 'Test',
      brieftekst: 'Tekst',
    });
    expect(vm.heeftVerzendadres).toBe(false);
    expect(vm.verzendadresRegels).toEqual([]);
  });

  it('placeholder bevat geen straatnummer/postcodecombi die op echte data lijkt', () => {
    // Regressie: oude placeholder was "Straat 1 / 1234 AB Plaats" en leek
    // verdacht veel op echte adresdata in de preview.
    expect(VERZENDADRES_PLACEHOLDER).not.toMatch(/\b\d{4}\s?[A-Z]{2}\b/);
  });
});
