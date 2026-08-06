import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import SelecteerbareDossierRij from './SelecteerbareDossierRij';

function renderRij(onToggle = vi.fn(), geselecteerd = false) {
  render(
    <ul>
      <SelecteerbareDossierRij geselecteerd={geselecteerd} onToggle={onToggle}>
        <span>Vrije ruimte</span>
        <button type="button">Actie</button>
      </SelecteerbareDossierRij>
    </ul>,
  );
  return { onToggle, rij: screen.getByRole('checkbox') };
}

describe('SelecteerbareDossierRij', () => {
  it('wisselt selectie bij klikken op vrije rijruimte', () => {
    const { onToggle } = renderRij();

    fireEvent.click(screen.getByText('Vrije ruimte'));

    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('laat interactieve bediening ongemoeid', () => {
    const { onToggle } = renderRij();

    fireEvent.click(screen.getByRole('button', { name: 'Actie' }));
    fireEvent.keyDown(screen.getByRole('button', { name: 'Actie' }), { key: 'Enter' });

    expect(onToggle).not.toHaveBeenCalled();
  });

  it('ondersteunt Enter en spatie op de gefocuste rij', () => {
    const { onToggle, rij } = renderRij();

    fireEvent.keyDown(rij, { key: 'Enter' });
    fireEvent.keyDown(rij, { key: ' ' });

    expect(onToggle).toHaveBeenCalledTimes(2);
  });

  it('maakt de geselecteerde toestand toegankelijk en zichtbaar', () => {
    const { rij } = renderRij(vi.fn(), true);

    expect(rij).toHaveAttribute('aria-checked', 'true');
    expect(rij).toHaveAttribute('data-selected', 'true');
    expect(rij.className).toContain('bg-accent/10');
  });
});
