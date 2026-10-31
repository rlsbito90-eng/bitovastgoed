/**
 * Fase A6: opt-in, standaard UIT. Alleen een preview: schrijft nooit zelf data weg.
 * Afwezig in Vercel Production -> false, dus huidige CRM-selectie is ongewijzigd.
 */
export const MATCH_R2_PREVIEW_ENABLED = import.meta.env.VITE_CRM_MATCH_R2_PREVIEW === 'true';