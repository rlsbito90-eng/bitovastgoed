// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import InlineObjectField from './InlineObjectField';

describe('Inline objectvelden', () => {
  it('Enter slaat het veld op zonder extra bevestiging', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    render(<InlineObjectField label="Objectnaam" value="Oud" required onSave={save} />);
    fireEvent.click(screen.getByRole('button', { name: 'Objectnaam direct wijzigen' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Objectnaam' }), { target: { value: 'Nieuw' } });
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Objectnaam' }), { key: 'Enter' });
    await waitFor(() => expect(save).toHaveBeenCalledWith('Nieuw'));
    expect(screen.getByRole('status').textContent).toContain('Opgeslagen');
  });
  it('Escape herstelt zonder opslaan', () => {
    const save = vi.fn();
    render(<InlineObjectField label="Objectnaam" value="Oud" onSave={save} />);
    fireEvent.click(screen.getByRole('button', { name: 'Objectnaam direct wijzigen' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Objectnaam' }), { target: { value: 'Fout' } });
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Objectnaam' }), { key: 'Escape' });
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Objectnaam direct wijzigen' }).textContent).toContain('Oud');
  });
  it('slaat op bij focusverlies en weigert een negatief bedrag', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    render(<InlineObjectField label="Vraagprijs" value={1900000} kind="number" onSave={save} />);
    fireEvent.click(screen.getByRole('button', { name: 'Vraagprijs direct wijzigen' }));
    const input = screen.getByRole('spinbutton', { name: 'Vraagprijs' });
    fireEvent.change(input, { target: { value: '-1' } });
    fireEvent.blur(input);
    expect(screen.getByRole('alert').textContent).toContain('niet-negatief');
    expect(save).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: '1850000' } });
    fireEvent.blur(input);
    await waitFor(() => expect(save).toHaveBeenCalledWith(1850000));
  });
  it('houdt invoer intact bij een opslagfout', async () => {
    const save = vi.fn().mockRejectedValue(new Error('Netwerkprobleem'));
    render(<InlineObjectField label="Objectnaam" value="Oud" onSave={save} />);
    fireEvent.click(screen.getByRole('button', { name: 'Objectnaam direct wijzigen' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Objectnaam' }), { target: { value: 'Nieuw' } });
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Objectnaam' }), { key: 'Enter' });
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Netwerkprobleem'));
    expect((screen.getByRole('textbox', { name: 'Objectnaam' }) as HTMLInputElement).value).toBe('Nieuw');
  });
});
