/**
 * Centrale feature flag voor de zichtbare authenticatie-interface.
 *
 * false = /auth toont uitsluitend een tijdelijke statuspagina.
 * true  = de volledige bestaande loginpagina (e-mail/wachtwoord, Google, Apple,
 *         account aanvragen) wordt weer getoond.
 *
 * Deze vlag beïnvloedt UITSLUITEND de user interface. AuthProvider,
 * ProtectedRoute, sessiebeheer, rollencontrole en RLS blijven onverminderd actief.
 *
 * Optioneel te overschrijven via VITE_AUTH_UI_ENABLED ("true" / "false").
 */
const envWaarde = import.meta.env.VITE_AUTH_UI_ENABLED as string | undefined;

export const AUTH_UI_ENABLED: boolean =
  envWaarde === undefined ? true : envWaarde === 'true';

/**
 * Social login (Google/Apple) is momenteel uitgeschakeld in de backend.
 * De knoppen blijven in de code aanwezig voor later hergebruik.
 */
export const AUTH_SOCIAL_ENABLED = false;

/** Zelfregistratie ("Account aanvragen") is tijdelijk verborgen. */
export const AUTH_SIGNUP_ENABLED = false;
