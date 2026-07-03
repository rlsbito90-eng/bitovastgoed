// src/test/forms/entityPickerPiiPolicy.test.tsx
//
// Fase 1C-1 — PII-policy voor EntityPicker.
// Borgt dat zichtbare labels (primair/secundair) nooit e-mail, telefoon
// of adres tonen, ook wanneer die waarden wel in searchHaystack staan.

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EntityPicker, { type EntityPickerItem } from '@/components/forms/EntityPicker';

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));

const EMAIL = 'jan.geheim@voorbeeld.nl';
const TEL = '0612345678';
const ADRES = 'Herengracht 1, 1015 BA Amsterdam';

const items: EntityPickerItem[] = [
  {
    id: 'r-1',
    primair: 'Jan de Vries',
    secundair: 'Voorbeeld BV',
    // Bewust: e-mail, telefoon en adres alleen in de haystack.
    searchHaystack: `jan de vries voorbeeld bv ${EMAIL} ${TEL} ${ADRES}`.toLowerCase(),
  },
];

async function openPicker() {
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
  return screen.getByRole('dialog', { name: /Kies relatie/i });
}

describe('EntityPicker — PII-policy (Fase 1C-1)', () => {
  it('toont naam en bedrijfsnaam in zichtbare labels', async () => {
    const dialog = await openPicker();
    expect(await screen.findByText('Jan de Vries')).toBeInTheDocument();
    expect(screen.getByText('Voorbeeld BV')).toBeInTheDocument();
    // Sanity: rendering vindt plaats binnen de picker-dialog.
    expect(dialog).toBeInTheDocument();
  });

  it('toont GEEN e-mail, telefoon of adres uit searchHaystack als zichtbaar label', async () => {
    await openPicker();
    expect(screen.queryByText(new RegExp(EMAIL, 'i'))).not.toBeInTheDocument();
    expect(screen.queryByText(new RegExp(TEL))).not.toBeInTheDocument();
    expect(screen.queryByText(/Herengracht/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/1015 BA/i)).not.toBeInTheDocument();
  });

  it('zoekt op e-mail via searchHaystack zonder deze te renderen', async () => {
    const user = userEvent.setup();
    await openPicker();
    const zoek = screen.getByPlaceholderText(/Zoeken/i);
    await user.type(zoek, 'geheim');
    // Item wordt gevonden via haystack; label blijft naam/bedrijf.
    expect(await screen.findByText('Jan de Vries')).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(EMAIL, 'i'))).not.toBeInTheDocument();
  });
});
