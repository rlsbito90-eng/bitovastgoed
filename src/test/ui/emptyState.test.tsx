import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import EmptyState from '@/components/ui/empty-state';

describe('EmptyState', () => {
  it('rendert titel en beschrijving', () => {
    render(<EmptyState title="Geen resultaten" description="Pas filters aan." />);
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByText('Geen resultaten')).toBeInTheDocument();
    expect(screen.getByText('Pas filters aan.')).toBeInTheDocument();
  });

  it('rendert optionele actie', () => {
    render(
      <EmptyState
        title="Leeg"
        action={<button type="button">Nieuw item</button>}
      />,
    );
    expect(screen.getByRole('button', { name: 'Nieuw item' })).toBeInTheDocument();
  });

  it('rendert geen description als die ontbreekt', () => {
    render(<EmptyState title="Alleen titel" />);
    expect(screen.getByText('Alleen titel')).toBeInTheDocument();
  });
});
