import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PlainLanguageHelp from '@/components/vastgoedrekenen/PlainLanguageHelp';

const helpProps = {
  title: 'Uitleg testonderdeel',
  what: 'Dit is de uitleg van het begrip.',
  why: 'Hierdoor begrijp je waarom het belangrijk is.',
  action: 'Vul de gegevens bewust in.',
  example: 'Bijvoorbeeld € 100.000 vandaag.',
  warning: 'Controleer de aannames.',
};

describe('PlainLanguageHelp', () => {
  it('toont de uitleg standaard open in Begeleid-modus', () => {
    render(<PlainLanguageHelp {...helpProps} viewMode="begeleid" />);

    expect(screen.getByRole('region', { name: 'Uitleg testonderdeel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /uitleg testonderdeel/i })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Wat betekent dit?')).toBeInTheDocument();
    expect(screen.getByText(/€ 100\.000 vandaag/i)).toBeInTheDocument();
    expect(screen.getByText(/controleer de aannames/i)).toBeInTheDocument();
  });

  it('staat standaard dicht in Compact-modus maar blijft direct bereikbaar', () => {
    render(<PlainLanguageHelp {...helpProps} viewMode="compact" />);

    const trigger = screen.getByRole('button', { name: /uitleg testonderdeel/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Wat betekent dit?')).not.toBeInTheDocument();

    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Wat betekent dit?')).toBeInTheDocument();
  });

  it('verbergt hulp niet volledig in Expert-modus', () => {
    render(<PlainLanguageHelp {...helpProps} viewMode="expert" />);

    const trigger = screen.getByRole('button', { name: /uitleg testonderdeel/i });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(trigger);
    expect(screen.getByText(/dit is de uitleg van het begrip/i)).toBeInTheDocument();
  });
});
