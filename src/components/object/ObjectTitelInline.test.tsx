// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ObjectVastgoed } from '@/data/mock-data';
import ObjectTitelInline from './ObjectTitelInline';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const basis = { id: 'obj-1', titel: 'Bestaande objectnaam' } as ObjectVastgoed;
const renderTitel = (onSave = vi.fn().mockResolvedValue(undefined), object = basis) =>
  render(<ObjectTitelInline object={object} onSave={onSave} />);

describe('ObjectTitelInline: direct aanpassen zonder uitgebreid formulier', () => {
  it('opent vanuit de hele objectnaam en bewaart uitsluitend de titel met Enter', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    renderTitel(save);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Bestaande objectnaam');
    fireEvent.click(screen.getByRole('button', { name: 'Wijzig objectnaam' }));
    const input = screen.getByRole('textbox', { name: 'Objectnaam' });
    fireEvent.change(input, { target: { value: 'Nieuwe objectnaam' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(save).toHaveBeenCalledWith({ titel: 'Nieuwe objectnaam' }));
    expect(save).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Wijzig objectnaam' })).toBeInTheDocument());
  });

  it('slaat bij verlaten van het veld op en verwijdert alleen randschaduwwitruimte', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    renderTitel(save);
    fireEvent.click(screen.getByRole('button', { name: 'Wijzig objectnaam' }));
    const input = screen.getByRole('textbox', { name: 'Objectnaam' });
    fireEvent.change(input, { target: { value: '  Geuzenweg 22A & 22B  ' } });
    fireEvent.blur(input);
    await waitFor(() => expect(save).toHaveBeenCalledWith({ titel: 'Geuzenweg 22A & 22B' }));
  });

  it('annuleert met Escape zonder het dossier te wijzigen', () => {
    const save = vi.fn().mockResolvedValue(undefined);
    renderTitel(save);
    fireEvent.click(screen.getByRole('button', { name: 'Wijzig objectnaam' }));
    const input = screen.getByRole('textbox', { name: 'Objectnaam' });
    fireEvent.change(input, { target: { value: 'Niet opslaan' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Wijzig objectnaam' })).toHaveTextContent('Bestaande objectnaam');
  });

  it('weigert een lege objectnaam zonder een opslagverzoek', () => {
    const save = vi.fn().mockResolvedValue(undefined);
    renderTitel(save);
    fireEvent.click(screen.getByRole('button', { name: 'Wijzig objectnaam' }));
    const input = screen.getByRole('textbox', { name: 'Objectnaam' });
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('mag niet leeg');
    expect(input).toBeInTheDocument();
  });

  it('doet niets wanneer de objectnaam gelijk blijft', () => {
    const save = vi.fn().mockResolvedValue(undefined);
    renderTitel(save);
    fireEvent.click(screen.getByRole('button', { name: 'Wijzig objectnaam' }));
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Objectnaam' }), { key: 'Enter' });
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Wijzig objectnaam' })).toBeInTheDocument();
  });

  it('beschermt tegen het overschrijven van een elders gewijzigde objectnaam', () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderTitel(save);
    fireEvent.click(screen.getByRole('button', { name: 'Wijzig objectnaam' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Objectnaam' }), {
      target: { value: 'Mijn lokale versie' },
    });
    rerender(<ObjectTitelInline object={{ ...basis, titel: 'Van andere sessie' }} onSave={save} />);
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Objectnaam' }), { key: 'Enter' });
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('inmiddels gewijzigd');
  });

  it('laat invoer staan bij opslagfout en kan het opnieuw proberen', async () => {
    const save = vi.fn()
      .mockRejectedValueOnce(new Error('Verbinding mislukt'))
      .mockResolvedValueOnce(undefined);
    renderTitel(save);
    fireEvent.click(screen.getByRole('button', { name: 'Wijzig objectnaam' }));
    const input = screen.getByRole('textbox', { name: 'Objectnaam' });
    fireEvent.change(input, { target: { value: 'Correcte titel' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Verbinding mislukt'));
    expect(input).toHaveValue('Correcte titel');
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  });

  it('verwisselt geen concepttitels wanneer een ander object geopend wordt', () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderTitel(save);
    fireEvent.click(screen.getByRole('button', { name: 'Wijzig objectnaam' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Objectnaam' }), {
      target: { value: 'Concept van eerste object' },
    });
    rerender(<ObjectTitelInline object={{ ...basis, id: 'obj-2', titel: 'Ander object' }} onSave={save} />);
    expect(screen.getByRole('button', { name: 'Wijzig objectnaam' })).toHaveTextContent('Ander object');
    expect(save).not.toHaveBeenCalled();
  });
});
