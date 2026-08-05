import { describe, expect, it, vi } from 'vitest';
import {
  bepaalInitieleSignaalmodus,
  bewaarStandaardSignaalmodus,
  leesStandaardSignaalmodus,
  SIGNAAL_MODUS_VOORKEUR_KEY,
} from './signaalReviewVoorkeur';

describe('signaalreviewvoorkeur', () => {
  it('valt veilig terug op normale modus', () => {
    expect(leesStandaardSignaalmodus(null)).toBe('normaal');
    expect(leesStandaardSignaalmodus({ getItem: () => 'onbekend' })).toBe('normaal');
  });

  it('leest en bewaart een geldige standaardmodus', () => {
    const setItem = vi.fn();
    bewaarStandaardSignaalmodus({ setItem }, 'review');
    expect(setItem).toHaveBeenCalledWith(SIGNAAL_MODUS_VOORKEUR_KEY, 'review');
    expect(leesStandaardSignaalmodus({ getItem: () => 'review' })).toBe('review');
  });

  it('laat een expliciete modus voorgaan en opent gerichte tabs normaal', () => {
    expect(bepaalInitieleSignaalmodus({
      explicieteModus: 'review', gerichteDossierTab: 'brieven', standaardModus: 'normaal',
    })).toBe('review');
    expect(bepaalInitieleSignaalmodus({
      explicieteModus: null, gerichteDossierTab: 'brieven', standaardModus: 'review',
    })).toBe('normaal');
    expect(bepaalInitieleSignaalmodus({
      explicieteModus: null, gerichteDossierTab: null, standaardModus: 'review',
    })).toBe('review');
  });
});
