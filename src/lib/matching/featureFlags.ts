/**
 * Fase A12: tab zichtbaar maar bestaande selectie blijft de standaard.
 * Noodschakelaar: VITE_CRM_MATCH_R2_PREVIEW=false verbergt de R2-tab.
 * Kandidaten toevoegen vereist een expliciete gebruikersklik.
 */
export const MATCH_R2_PREVIEW_ENABLED = import.meta.env.VITE_CRM_MATCH_R2_PREVIEW !== 'false';