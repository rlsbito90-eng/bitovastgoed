// src/test/forms/selectorPiiRegressie.test.tsx
//
// Fase 1C-3 — regressietests voor PII-veilige selector-labels.
//
// Reproduceert de item-constructie zoals gebruikt in:
//   - OfferFormDialog        (relatie-selector)
//   - DealFormDialog         (relatie-selector)
//   - KandidaatSelectieDialog (mobiele kaart-label via getRelatieDropdownLabel)
//   - ObjectDetailPage       (gekoppelde-relatie-label, dekking-check)
//
// De tests borgen dat zichtbare labels NOOIT e-mail of telefoon tonen,
// ook wanneer die waarden wel in de searchHaystack (of onderliggende
// relatie) aanwezig zijn.
//
// Test-only: geen productiecode wordt gewijzigd.

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EntityPicker, { type EntityPickerItem } from '@/components/forms/EntityPicker';
import { getRelatieNamen, getRelatieDropdownLabel } from '@/lib/relatieNaam';
import type { Relatie, RelatieContactpersoon } from '@/data/mock-data';

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));

const EMAIL = 'jan.geheim@voorbeeld.nl';
const TEL = '0612345678';

const relatie: Relatie = {
  id: 'rel-1',
  bedrijfsnaam: 'Voorbeeld Invest BV',
  contactpersoon: 'Jan de Vries',
  type: 'belegger',
  telefoon: TEL,
  email: EMAIL,
  leadStatus: 'lauw',
  ndaGetekend: false,
  laatsteContact: '',
} as Relatie;

const contactpersonen: RelatieContactpersoon[] = [];

const norm = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');

async function openPickerMetItems(items: EntityPickerItem[]) {
  const user = userEvent.setup();
  render(
    <EntityPicker
      value=""
      onChange={() => {}}
      items={items}
      label="Relatie"
      pickerTitle="Kies relatie"
    />,
  );
  await user.click(screen.getByRole('button', { name: /Kiezen/i }));
  return user;
}

function assertGeenPii() {
  expect(screen.queryByText(new RegExp(EMAIL, 'i'))).not.toBeInTheDocument();
  expect(screen.queryByText(new RegExp(TEL))).not.toBeInTheDocument();
}

describe('Fase 1C-3 — PII-veilige selector-labels (regressie)', () => {
  it('OfferFormDialog relatie-selector: naam/bedrijf zichtbaar, e-mail/telefoon niet', async () => {
    // Reproduceert OfferFormDialog:159-165
    const { primair, secundair } = getRelatieNamen(relatie, contactpersonen);
    const items: EntityPickerItem[] = [{
      id: relatie.id,
      primair,
      secundair,
      searchHaystack: norm(
        [primair, secundair, relatie.bedrijfsnaam, relatie.contactpersoon, relatie.email]
          .filter(Boolean).join(' '),
      ),
    }];
    await openPickerMetItems(items);
    expect(await screen.findByText('Jan de Vries')).toBeInTheDocument();
    expect(screen.getByText('Voorbeeld Invest BV')).toBeInTheDocument();
    assertGeenPii();
  });

  it('DealFormDialog relatie-selector: naam/bedrijf zichtbaar, e-mail/telefoon niet', async () => {
    // Reproduceert DealFormDialog:136-146
    const { primair, secundair } = getRelatieNamen(relatie, contactpersonen);
    const haystack = norm(
      [primair, secundair, relatie.bedrijfsnaam, relatie.contactpersoon, relatie.email, relatie.telefoon]
        .filter(Boolean).join(' '),
    );
    const items: EntityPickerItem[] = [{
      id: relatie.id, primair, secundair, searchHaystack: haystack,
    }];
    await openPickerMetItems(items);
    expect(await screen.findByText('Jan de Vries')).toBeInTheDocument();
    expect(screen.getByText('Voorbeeld Invest BV')).toBeInTheDocument();
    assertGeenPii();
  });

  it('DealFormDialog relatie-selector: zoeken op e-mail via haystack lekt geen PII in label', async () => {
    const { primair, secundair } = getRelatieNamen(relatie, contactpersonen);
    const items: EntityPickerItem[] = [{
      id: relatie.id, primair, secundair,
      searchHaystack: norm([primair, secundair, relatie.email, relatie.telefoon].join(' ')),
    }];
    const user = await openPickerMetItems(items);
    await user.type(screen.getByPlaceholderText(/Zoeken/i), 'geheim');
    expect(await screen.findByText('Jan de Vries')).toBeInTheDocument();
    assertGeenPii();
  });

  it('KandidaatSelectieDialog mobiele kaart: getRelatieDropdownLabel bevat geen e-mail/telefoon', () => {
    // Reproduceert regel 499 in KandidaatSelectieDialog.tsx
    const label = getRelatieDropdownLabel(relatie, contactpersonen);
    expect(label).toContain('Jan de Vries');
    expect(label).toContain('Voorbeeld Invest BV');
    expect(label).not.toContain(EMAIL);
    expect(label).not.toContain(TEL);
  });

  it('KandidaatSelectieDialog mobiele kaart: ook zonder contactpersoon geen PII-fallback', () => {
    const anon: Relatie = { ...relatie, bedrijfsnaam: '', contactpersoon: '' };
    const label = getRelatieDropdownLabel(anon, []);
    expect(label).not.toContain(EMAIL);
    expect(label).not.toContain(TEL);
    expect(label.toLowerCase()).toMatch(/zonder naam/);
  });

  it('ObjectDetailPage gekoppelde-relatie: reeds gedekt door objectDetailGekoppeldeRelatie.test.tsx (sanity)', () => {
    // Deze test dient als expliciete verwijzing/sanity. Het bestaande
    // testbestand valideert dat RelatieNaamDisplay geen e-mail/telefoon toont.
    // Hier borgen we het onderliggende contract nogmaals.
    const { primair, secundair } = getRelatieNamen(relatie, contactpersonen);
    expect(primair).toBe('Jan de Vries');
    expect(secundair).toBe('Voorbeeld Invest BV');
    expect(primair + ' ' + (secundair ?? '')).not.toContain(EMAIL);
    expect(primair + ' ' + (secundair ?? '')).not.toContain(TEL);
  });
});
