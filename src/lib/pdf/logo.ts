// src/lib/pdf/logo.ts
//
// Bito Vastgoed logo assets voor PDF-rendering.
//
// - BITO_ICON_URL: icon-only beeldmerk (huis met B). Te combineren met
//   een tekstuele "BITO VASTGOED" lockup in de PDF-header.
// - BITO_LOGO_URL: volledige logo dat de bedrijfsnaam al bevat
//   (fallback wanneer alleen de tekstuele variant niet gewenst is).

import bitoLogo from '@/assets/bito-logo.png';
import bitoIcon from '@/assets/bito-icon.png.asset.json';

export const BITO_LOGO_URL = bitoLogo;
export const BITO_ICON_URL = bitoIcon.url;
