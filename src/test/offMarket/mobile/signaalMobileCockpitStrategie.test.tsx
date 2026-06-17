// Verifieert dat de cockpit lange strategieteksten verkort tot 1 regel.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import SignaalMobileCockpit from '@/components/offmarket/mobile/SignaalMobileCockpit';
import { maakTestSignaal } from './_fixture';

vi.mock('@/hooks/useDataStore', () => ({
  useDataStore: () => ({ getRelatieById: () => null }),
}));

describe('SignaalMobileCockpit — strategie compact', () => {
  it('toont een korte strategielabel in plaats van lange paragraaf', () => {
    const lang = 'Focus op advisering bij exit-strategie: uitpond-scenario (verkoop per appartementsrecht) versus integrale verkoop aan een belegger.';
    render(
      <MemoryRouter>
        <SignaalMobileCockpit
          signaal={maakTestSignaal({ ai_strategie_suggestie: lang, potentiele_strategie: null } as any)}
          taken={[]}
          briefStatus="geen"
        />
      </MemoryRouter>,
    );
    // De volledige paragraaf mag niet verschijnen
    expect(screen.queryByText(lang)).toBeNull();
    // De cel moet line-clamp-1 hebben
    const cockpit = screen.getByTestId('signaal-mobile-cockpit');
    const clamped = cockpit.querySelector('.line-clamp-1');
    expect(clamped).not.toBeNull();
  });

  it('toont "Nog te bepalen" wanneer er geen strategie is', () => {
    render(
      <MemoryRouter>
        <SignaalMobileCockpit
          signaal={maakTestSignaal({ potentiele_strategie: null, ai_strategie_suggestie: null } as any)}
          taken={[]}
          briefStatus="geen"
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('Nog te bepalen')).toBeInTheDocument();
  });
});
