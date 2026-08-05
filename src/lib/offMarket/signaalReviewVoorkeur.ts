export type SignaalWeergavemodus = 'review' | 'normaal';

export const SIGNAAL_MODUS_VOORKEUR_KEY = 'off-market-signaal:standaardmodus';

export function isSignaalWeergavemodus(value: unknown): value is SignaalWeergavemodus {
  return value === 'review' || value === 'normaal';
}

export function leesStandaardSignaalmodus(
  storage: Pick<Storage, 'getItem'> | null | undefined,
): SignaalWeergavemodus {
  if (!storage) return 'normaal';
  try {
    const value = storage.getItem(SIGNAAL_MODUS_VOORKEUR_KEY);
    return isSignaalWeergavemodus(value) ? value : 'normaal';
  } catch {
    return 'normaal';
  }
}

export function bewaarStandaardSignaalmodus(
  storage: Pick<Storage, 'setItem'> | null | undefined,
  modus: SignaalWeergavemodus,
): void {
  if (!storage) return;
  try {
    storage.setItem(SIGNAAL_MODUS_VOORKEUR_KEY, modus);
  } catch {
    // De modus blijft in de huidige sessie bruikbaar wanneer opslag is geblokkeerd.
  }
}

export function bepaalInitieleSignaalmodus(input: {
  explicieteModus?: string | null;
  gerichteDossierTab?: string | null;
  standaardModus: SignaalWeergavemodus;
}): SignaalWeergavemodus {
  if (isSignaalWeergavemodus(input.explicieteModus)) return input.explicieteModus;
  if (input.gerichteDossierTab) return 'normaal';
  return input.standaardModus;
}
