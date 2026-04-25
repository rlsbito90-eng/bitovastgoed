// src/lib/pdf/theme.ts
//
// Centrale plek voor alle Bito-huisstijl waarden gebruikt in PDFs.
// Eén bestand om aan te passen — wijzigingen propageren naar alle docs.

import { Font, StyleSheet } from '@react-pdf/renderer';

// =====================================================================
// FONTS — Playfair Display (headlines) + Inter (body)
// =====================================================================
// Inter ipv Montserrat omdat Inter veel betere PDF-rendering heeft en
// ook al in een serif/sans combinatie werkt zoals Montserrat in de
// merkidentiteit. Visueel verschil minimaal voor PDF.

Font.register({
  family: 'Playfair Display',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/playfairdisplay/v40/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvUDQ.ttf', fontWeight: 400, fontStyle: 'normal' },
    { src: 'https://fonts.gstatic.com/s/playfairdisplay/v40/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKebukDQ.ttf', fontWeight: 600, fontStyle: 'normal' },
    { src: 'https://fonts.gstatic.com/s/playfairdisplay/v40/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKeiukDQ.ttf', fontWeight: 700, fontStyle: 'normal' },
    { src: 'https://fonts.gstatic.com/s/playfairdisplay/v40/nuFRD-vYSZviVYUb_rj3ij__anPXDTnCjmHKM4nYO7KN_qiTbtY.ttf', fontWeight: 400, fontStyle: 'italic' },
  ],
});

Font.register({
  family: 'Inter',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf', fontWeight: 400, fontStyle: 'normal' },
    { src: 'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuI6fMZg.ttf', fontWeight: 500, fontStyle: 'normal' },
    { src: 'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuGKYMZg.ttf', fontWeight: 600, fontStyle: 'normal' },
    { src: 'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZg.ttf', fontWeight: 700, fontStyle: 'normal' },
    { src: 'https://fonts.gstatic.com/s/inter/v20/UcCM3FwrK3iLTcvneQg7Ca725JhhKnNqk4j1ebLhAm8SrXTc2dthjQ.ttf', fontWeight: 400, fontStyle: 'italic' },
  ],
});

// IBM Plex Mono voor cijfers — past bij de app
Font.register({
  family: 'IBM Plex Mono',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/ibmplexmono/v20/-F63fjptAgt5VM-kVkqdyU8n5ig.ttf', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/ibmplexmono/v20/-F6qfjptAgt5VM-kVkqdyU8n3twJ8lc.ttf', fontWeight: 500 },
    { src: 'https://fonts.gstatic.com/s/ibmplexmono/v20/-F6qfjptAgt5VM-kVkqdyU8n3vAO8lc.ttf', fontWeight: 600 },
  ],
});

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
    fontFamily: 'Playfair Display',
    fontSize: 28,
    fontWeight: 700,
    letterSpacing: -0.5,
    color: colors.primary,
    lineHeight: 1.2,
  },
  h1OnDark: {
    fontFamily: 'Playfair Display',
    fontSize: 32,
    fontWeight: 700,
    letterSpacing: -0.5,
    color: colors.white,
    lineHeight: 1.2,
  },
  h2: {
    fontFamily: 'Playfair Display',
    fontSize: 18,
    fontWeight: 600,
    color: colors.primary,
    letterSpacing: -0.3,
  },
  h3: {
    fontFamily: 'Inter',
    fontSize: 11,
    fontWeight: 600,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  body: {
    fontFamily: 'Inter',
    fontSize: 10,
    fontWeight: 400,
    color: colors.text,
    lineHeight: 1.5,
  },
  bodySmall: {
    fontFamily: 'Inter',
    fontSize: 9,
    color: colors.textMuted,
    lineHeight: 1.4,
  },
  label: {
    fontFamily: 'Inter',
    fontSize: 8,
    fontWeight: 500,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  data: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 11,
    fontWeight: 500,
    color: colors.text,
  },
  dataLarge: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 16,
    fontWeight: 600,
    color: colors.primary,
  },
  dataXL: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 22,
    fontWeight: 600,
    color: colors.primary,
  },
  caption: {
    fontFamily: 'Inter',
    fontSize: 7,
    color: colors.textLight,
    letterSpacing: 0.4,
  },
  taglineDark: {
    fontFamily: 'Playfair Display',
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
    fontFamily: 'Inter',
    fontSize: 10,
    color: colors.text,
  },
  // Cover-pagina: donkerblauwe achtergrond voor brochure cover
  pageDark: {
    backgroundColor: colors.primary,
    padding: 0,
    fontFamily: 'Inter',
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
