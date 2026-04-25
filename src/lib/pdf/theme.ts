// src/lib/pdf/theme.ts
//
// Centrale plek voor alle Bito-huisstijl waarden gebruikt in PDFs.
// Eén bestand om aan te passen — wijzigingen propageren naar alle docs.

import { StyleSheet } from '@react-pdf/renderer';

// =====================================================================
// FONTS — uitsluitend ingebouwde PDF-fonts
// =====================================================================
// Geen externe font-URLs: client-side PDF-rendering mag niet afhankelijk zijn
// van Google Fonts/CORS/cache. React-PDF heeft deze fonts standaard ingebouwd.

export const pdfFonts = {
  heading: 'Times-Roman',
  body: 'Helvetica',
  mono: 'Courier',
} as const;

// =====================================================================
// COLORS — exact uit Bito huisstijl-board
// =====================================================================

export const colors = {
  primary: '#072438',      // navigatie, headers, hoofdtekst
  primaryDark: '#051a2a',  // iets donkerder voor cover gradients
  secondary: '#C89C69',    // subtiele accenten, borders
  accent: '#D4A24C',       // CTA's, highlights
  accentLight: '#E8C893',  // licht accent voor borders/hairlines
  drager: '#F5F1EC',       // pagina-achtergrond
  dragerSubtle: '#FAF8F5', // iets lichter voor zebra-rijen
  text: '#1F2933',         // body tekst
  textMuted: '#5C6773',    // muted/secundaire tekst
  textLight: '#9BA4B0',    // labels, footnotes
  white: '#FFFFFF',
  border: '#E5DFD5',       // rules, dividers
  success: '#2D7A52',      // positieve hightlights (rendement etc)
  warning: '#B8860B',      // attention zonder alarm
};

// =====================================================================
// SPACING — schaal in PDF "points" (1 pt ≈ 0.35 mm)
// =====================================================================

export const spacing = {
  xs: 2,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  xxxl: 32,
  page: 40,         // page padding
  section: 20,      // tussen secties
};

// =====================================================================
// TYPOGRAPHY — vooraf gedefinieerde tekst-stijlen
// =====================================================================

export const typography = StyleSheet.create({
  h1: {
    fontFamily: 'Times-Roman',
    fontSize: 28,
    fontWeight: 700,
    letterSpacing: -0.5,
    color: colors.primary,
    lineHeight: 1.2,
  },
  h1OnDark: {
    fontFamily: 'Times-Roman',
    fontSize: 32,
    fontWeight: 700,
    letterSpacing: -0.5,
    color: colors.white,
    lineHeight: 1.2,
  },
  h2: {
    fontFamily: 'Times-Roman',
    fontSize: 18,
    fontWeight: 600,
    color: colors.primary,
    letterSpacing: -0.3,
  },
  h3: {
    fontFamily: 'Helvetica',
    fontSize: 11,
    fontWeight: 600,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  body: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    fontWeight: 400,
    color: colors.text,
    lineHeight: 1.5,
  },
  bodySmall: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: colors.textMuted,
    lineHeight: 1.4,
  },
  label: {
    fontFamily: 'Helvetica',
    fontSize: 8,
    fontWeight: 500,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  data: {
    fontFamily: 'Courier',
    fontSize: 11,
    fontWeight: 500,
    color: colors.text,
  },
  dataLarge: {
    fontFamily: 'Courier',
    fontSize: 16,
    fontWeight: 600,
    color: colors.primary,
  },
  dataXL: {
    fontFamily: 'Courier',
    fontSize: 22,
    fontWeight: 600,
    color: colors.primary,
  },
  caption: {
    fontFamily: 'Helvetica',
    fontSize: 7,
    color: colors.textLight,
    letterSpacing: 0.4,
  },
  taglineDark: {
    fontFamily: 'Times-Roman',
    fontSize: 12,
    fontWeight: 400,
    fontStyle: 'italic',
    color: colors.accentLight,
    letterSpacing: 1.5,
  },
});

// =====================================================================
// PAGE STYLES — gedeelde layout
// =====================================================================

export const pageStyles = StyleSheet.create({
  // Standaard A4 pagina met witte achtergrond
  page: {
    backgroundColor: colors.white,
    padding: 0,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: colors.text,
  },
  // Cover-pagina: donkerblauwe achtergrond voor brochure cover
  pageDark: {
    backgroundColor: colors.primary,
    padding: 0,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: colors.white,
  },
  // Inhoud-padding (gebruikt door alle content-secties)
  content: {
    paddingHorizontal: spacing.page,
    paddingTop: spacing.page - 8,
    paddingBottom: 64, // ruimte voor footer
  },
});

// =====================================================================
// HELPERS — voor formatteren in PDF context
// =====================================================================

export function formatEuro(amount: number | null | undefined, compact = false): string {
  if (amount == null || isNaN(amount)) return '—';
  if (compact && amount >= 1_000_000) {
    return `€ ${(amount / 1_000_000).toFixed(amount % 1_000_000 === 0 ? 0 : 1)}M`;
  }
  if (compact && amount >= 1_000) {
    return `€ ${(amount / 1_000).toFixed(0)}K`;
  }
  return `€ ${amount.toLocaleString('nl-NL')}`;
}

export function formatM2(m2: number | null | undefined): string {
  if (m2 == null || isNaN(m2)) return '—';
  return `${m2.toLocaleString('nl-NL')} m²`;
}

export function formatPercent(pct: number | null | undefined, digits = 2): string {
  if (pct == null || isNaN(pct)) return '—';
  return `${pct.toFixed(digits)}%`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('nl-NL', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return '—';
  }
}

export function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return '—';
  }
}
