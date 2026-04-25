// src/lib/pdf/logo.ts
//
// Het Bito logo (PNG, transparant) als asset import. React-PDF accepteert
// zowel een URL als een data URI. We importeren het PNG-bestand zodat Vite
// de juiste asset URL of data URI inlined.
//
// Het logo-bestand staat in src/assets/bito-logo.png — Vite/Lovable lossen
// dat automatisch op tot een werkende URL bij build.

import bitoLogo from '@/assets/bito-logo.png';

export const BITO_LOGO_URL = bitoLogo;
