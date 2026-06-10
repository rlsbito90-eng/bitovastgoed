// src/test/forms/quickCreateRelationDialog.test.tsx
//
// Fase 4A.1 — Tests voor QuickCreateRelationDialog.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { QuickCreateRelationDialog } from '@/components/forms/QuickCreateRelationDialog';
import type { Relatie } from '@/data/mock-data';

const addRelatieMock = vi.fn();
const addContactpersoonMock = vi.fn();
let relatiesMock: Relatie[] = [];

vi.mock('@/hooks/useDataStore', () => ({
  useDataStore: () => ({
    addRelatie: addRelatieMock,
    addContactpersoon: addContactpersoonMock,
    relaties: relatiesMock,
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function renderDialog(props: Partial<React.ComponentProps<typeof QuickCreateRelationDialog>> = {}) {
  const onCreated = vi.fn();
  const onOpenChange = vi.fn();
  const utils = render(
    <QuickCreateRelationDialog
      open={true}
      onOpenChange={onOpenChange}
      onCreated={onCreated}
      {...props}
    />,
  );
  return { ...utils, onCreated, onOpenChange };
}

beforeEach(() => {
  addRelatieMock.mockReset();
  addContactpersoonMock.mockReset();
  relatiesMock = [];
  addRelatieMock.mockImplementation(async (r: any) => ({ id: 'new-1', ...r }));
  addContactpersoonMock.mockResolvedValue({ id: 'cp-1' });
});

describe('QuickCreateRelationDialog', () => {
  it('toont titel en knoppen', () => {
    renderDialog();
    expect(screen.getByText('Nieuwe relatie')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Relatie aanmaken/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Annuleren/i })).toBeInTheDocument();
  });

  it('toont validatiefout bij volledig lege invoer', async () => {
    const user = userEvent.setup();
    const { onCreated } = renderDialog();
    await user.click(screen.getByRole('button', { name: /Relatie aanmaken/i }));
    expect(
      await screen.findByText(/Vul minimaal een naam, bedrijfsnaam, e-mail of telefoonnummer in/i),
    ).toBeInTheDocument();
    expect(addRelatieMock).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('staat opslaan toe met alleen een naam en maakt contactpersoon aan', async () => {
    const user = userEvent.setup();
    const { onCreated, onOpenChange } = renderDialog({ context: 'kandidaat' });
    await user.type(screen.getByLabelText(/Naam \/ contactpersoon/i), 'Alexander');
    await user.click(screen.getByRole('button', { name: /Relatie aanmaken/i }));
    await waitFor(() => expect(addRelatieMock).toHaveBeenCalled());
    const arg = addRelatieMock.mock.calls[0][0];
    expect(arg.contactpersoon).toBe('Alexander');
    expect(arg.type).toBe('belegger'); // default voor kandidaat
    expect(addContactpersoonMock).toHaveBeenCalledWith(
      expect.objectContaining({ naam: 'Alexander', isPrimair: true }),
    );
    expect(onCreated).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('staat opslaan toe met alleen bedrijfsnaam, zonder contactpersoon', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.type(screen.getByLabelText(/Bedrijfsnaam/i), 'J&CB Invest');
    await user.click(screen.getByRole('button', { name: /Relatie aanmaken/i }));
    await waitFor(() => expect(addRelatieMock).toHaveBeenCalled());
    expect(addContactpersoonMock).not.toHaveBeenCalled();
  });

  it('staat opslaan toe met alleen e-mail', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.type(screen.getByLabelText(/E-mail/i), 'a@b.nl');
    await user.click(screen.getByRole('button', { name: /Relatie aanmaken/i }));
    await waitFor(() => expect(addRelatieMock).toHaveBeenCalled());
    expect(addRelatieMock.mock.calls[0][0].email).toBe('a@b.nl');
  });

  it('telt "Onbekend" als leeg en slaat het niet op', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.type(screen.getByLabelText(/Naam \/ contactpersoon/i), 'Onbekend');
    await user.type(screen.getByLabelText(/Bedrijfsnaam/i), '-');
    await user.click(screen.getByRole('button', { name: /Relatie aanmaken/i }));
    expect(
      await screen.findByText(/Vul minimaal een naam, bedrijfsnaam, e-mail of telefoonnummer in/i),
    ).toBeInTheDocument();
    expect(addRelatieMock).not.toHaveBeenCalled();
  });

  it('default partijtype voor context "verkoper" is eigenaar', async () => {
    const user = userEvent.setup();
    renderDialog({ context: 'verkoper' });
    await user.type(screen.getByLabelText(/Bedrijfsnaam/i), 'Eigenaar BV');
    await user.click(screen.getByRole('button', { name: /Relatie aanmaken/i }));
    await waitFor(() => expect(addRelatieMock).toHaveBeenCalled());
    expect(addRelatieMock.mock.calls[0][0].type).toBe('eigenaar');
  });

  it('toont duplicate-hint bij exact e-mailmatch', async () => {
    relatiesMock = [
      {
        id: 'r-1',
        bedrijfsnaam: 'Bestaande',
        contactpersoon: 'Piet',
        type: 'belegger',
        telefoon: '',
        email: 'foo@bar.nl',
        regio: [],
        assetClasses: [],
        ndaGetekend: false,
        leadStatus: 'lauw',
        laatsteContact: '',
      } as Relatie,
    ];
    const user = userEvent.setup();
    renderDialog();
    await user.type(screen.getByLabelText(/E-mail/i), 'FOO@bar.nl');
    expect(await screen.findByText(/Mogelijk bestaat deze relatie al/i)).toBeInTheDocument();
  });

  it('toont duplicate-hint bij telefoonmatch op cijfers', async () => {
    relatiesMock = [
      {
        id: 'r-2',
        bedrijfsnaam: 'Bestaande',
        contactpersoon: '',
        type: 'belegger',
        telefoon: '0612345678',
        email: '',
        regio: [],
        assetClasses: [],
        ndaGetekend: false,
        leadStatus: 'lauw',
        laatsteContact: '',
      } as Relatie,
    ];
    const user = userEvent.setup();
    renderDialog();
    await user.type(screen.getByLabelText(/Telefoon/i), '06-1234 5678');
    expect(await screen.findByText(/Mogelijk bestaat deze relatie al/i)).toBeInTheDocument();
  });

  it('toont geen duplicate-hint bij alleen naam-overlap (V1)', async () => {
    relatiesMock = [
      {
        id: 'r-3',
        bedrijfsnaam: 'Iets',
        contactpersoon: 'Alexander',
        type: 'belegger',
        telefoon: '',
        email: '',
        regio: [],
        assetClasses: [],
        ndaGetekend: false,
        leadStatus: 'lauw',
        laatsteContact: '',
      } as Relatie,
    ];
    const user = userEvent.setup();
    renderDialog();
    await user.type(screen.getByLabelText(/Naam \/ contactpersoon/i), 'Alexander');
    // Geen alert
    expect(screen.queryByText(/Mogelijk bestaat deze relatie al/i)).not.toBeInTheDocument();
  });
});
