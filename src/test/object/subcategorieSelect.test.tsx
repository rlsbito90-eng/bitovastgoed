// src/test/object/subcategorieSelect.test.tsx
//
// Fase 1A.3 — SubcategorieSelect gebruikt Popover + Command.
// - toont "Kies subcategorie" placeholder;
// - opent popover met asset-class-afhankelijke opties;
// - "Geen specifieke subcategorie" roept onChange(undefined) aan;
// - selectie roept onChange(id) aan;
// - zoeken filtert opties.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import SubcategorieSelect from '@/components/object/SubcategorieSelect';
import type { ObjectSubcategorie } from '@/data/mock-data';

const opties: ObjectSubcategorie[] = [
  { id: 'k1', assetClass: 'kantoren', subcategorieKey: 'kantoorpand', label: 'Kantoorpand', volgorde: 10, actief: true },
  { id: 'k2', assetClass: 'kantoren', subcategorieKey: 'kantoorgebouw', label: 'Kantoorgebouw', volgorde: 15, actief: true },
  { id: 'k3', assetClass: 'kantoren', subcategorieKey: 'multi_tenant_kantoor', label: 'Multi-tenant kantoor', volgorde: 25, actief: true },
];

vi.mock('@/hooks/useSubcategorieen', () => ({
  useSubcategorieen: () => ({
    all: opties,
    loading: false,
    forAssetClass: (ac: string) => opties.filter((o) => o.assetClass === ac),
    byId: (id: string) => opties.find((o) => o.id === id),
    labelFor: (id?: string | null) => opties.find((o) => o.id === id)?.label ?? '',
  }),
}));

describe('SubcategorieSelect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('toont placeholder wanneer geen waarde is gekozen', () => {
    render(<SubcategorieSelect assetClass="kantoren" onChange={() => {}} />);
    expect(screen.getByRole('combobox', { name: /subcategorie/i })).toHaveTextContent(/kies subcategorie/i);
  });

  it('toont asset-class-afhankelijke opties in popover', async () => {
    const user = userEvent.setup();
    render(<SubcategorieSelect assetClass="kantoren" onChange={() => {}} />);
    await user.click(screen.getByRole('combobox', { name: /subcategorie/i }));
    await waitFor(() => expect(screen.getByPlaceholderText(/zoek subcategorie/i)).toBeInTheDocument());
    expect(screen.getByText('Kantoorpand')).toBeInTheDocument();
    expect(screen.getByText('Kantoorgebouw')).toBeInTheDocument();
    expect(screen.getByText('Multi-tenant kantoor')).toBeInTheDocument();
    expect(screen.getByText(/Geen specifieke subcategorie/i)).toBeInTheDocument();
  });

  it('selecteren roept onChange met id', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SubcategorieSelect assetClass="kantoren" onChange={onChange} />);
    await user.click(screen.getByRole('combobox', { name: /subcategorie/i }));
    await user.click(await screen.findByText('Kantoorgebouw'));
    expect(onChange).toHaveBeenCalledWith('k2');
  });

  it('lege optie roept onChange(undefined)', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SubcategorieSelect assetClass="kantoren" value="k1" onChange={onChange} />);
    await user.click(screen.getByRole('combobox', { name: /subcategorie/i }));
    await user.click(await screen.findByText(/Geen specifieke subcategorie/i));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('zoeken filtert opties', async () => {
    const user = userEvent.setup();
    render(<SubcategorieSelect assetClass="kantoren" onChange={() => {}} />);
    await user.click(screen.getByRole('combobox', { name: /subcategorie/i }));
    const input = await screen.findByPlaceholderText(/zoek subcategorie/i);
    await user.type(input, 'multi');
    await waitFor(() => {
      expect(screen.getByText('Multi-tenant kantoor')).toBeInTheDocument();
      expect(screen.queryByText('Kantoorpand')).not.toBeInTheDocument();
    });
  });
});
