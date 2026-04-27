// src/lib/pdf/theme.ts
//
// Centrale plek voor alle Bito-huisstijl waarden gebruikt in PDFs.
// Batch 8b: visueel rijker — meer gouden accenten, betere typografie,
// decoratieve elementen.

import { Font, StyleSheet } from '@react-pdf/renderer';

// =====================================================================
// FONTS — Playfair Display (headlines) + Inter (body)
// =====================================================================

Font.register({
  family: 'Playfair Display',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/playfairdisplay/v37/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvUDQ.ttf', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/playfairdisplay/v37/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvkDQ.ttf', fontWeight: 600 },
    { src: 'https://fonts.gstatic.com/s/playfairdisplay/v37/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvMDQ.ttf', fontWeight: 700 },
  ],
});

Font.register({
  family: 'Inter',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50ojIw2boKoduKmMEVuLyfMZg.ttf', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50ojIw2boKoduKmMEVuI6fMZg.ttf', fontWeight: 500 },
    { src: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50ojIw2boKoduKmMEVuGKYMZg.ttf', fontWeight: 600 },
    { src: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50ojIw2boKoduKmMEVuFuYMZg.ttf', fontWeight: 700 },
  ],
});

Font.register({
  family: 'IBM Plex Mono',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/ibmplexmono/v19/-F63fjptAgt5VM-kVkqdyU8n5igg1l9kn-s.ttf', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/ibmplexmono/v19/-F6sfjptAgt5VM-kVkqdyU8n3uwS6Wcr3PqdrA.ttf', fontWeight: 500 },
    { src: 'https://fonts.gstatic.com/s/ibmplexmono/v19/-F6sfjptAgt5VM-kVkqdyU8n3vAP6Wcr3PqdrA.ttf', fontWeight: 600 },
  ],
});

// =====================================================================
// COLORS — Bito huisstijl
// =====================================================================

export const colors = {
  primary: '#072438',
  primaryDark: '#051a2a',
  primarySoft: '#0E3551',     // iets lichter primary voor subtiele blokken
  secondary: '#C89C69',
  accent: '#D4A24C',
  accentLight: '#E8C893',
  accentSoft: '#F5E5C8',      // heel lichte accent voor backgrounds
  drager: '#F5F1EC',
  dragerSubtle: '#FAF8F5',
  text: '#1F2933',
  textMuted: '#5C6773',
  textLight: '#9BA4B0',
  white: '#FFFFFF',
  border: '#E5DFD5',
  borderSubtle: '#EFE9DD',
  success: '#2D7A52',
  warning: '#B8860B',
};

// =====================================================================
// SPACING
// =====================================================================

export const spacing = {
  xs: 2,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  xxxl: 32,
  page: 40,
  section: 20,
};

// =====================================================================
// TYPOGRAPHY
// =====================================================================

export const typography = StyleSheet.create({
  // Display / hero
  hero: {
    fontFamily: 'Playfair Display',
    fontSize: 36,
    fontWeight: 700,
    letterSpacing: -1,
    color: colors.primary,
    lineHeight: 1.1,
  },
  heroOnDark: {
    fontFamily: 'Playfair Display',
    fontSize: 42,
    fontWeight: 700,
    letterSpacing: -1.2,
    color: colors.white,
    lineHeight: 1.05,
  },
  // Page-level headers
  h1: {
    fontFamily: 'Playfair Display',
    fontSize: 28,
    fontWeight: 700,
    letterSpacing: -0.5,
    color: colors.primary,
    lineHeight: 1.2,
  },
  // Section headers
  h2: {
    fontFamily: 'Playfair Display',
    fontSize: 18,
    fontWeight: 600,
    color: colors.primary,
    letterSpacing: -0.3,
  },
  // Sub-section / label headers (small caps style)
  h3: {
    fontFamily: 'Inter',
    fontSize: 11,
    fontWeight: 600,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  // Body text
  body: {
    fontFamily: 'Inter',
    fontSize: 10,
    fontWeight: 400,
    color: colors.text,
    lineHeight: 1.55,
  },
  bodyLarge: {
    fontFamily: 'Inter',
    fontSize: 11,
    fontWeight: 400,
    color: colors.text,
    lineHeight: 1.6,
  },
  bodySmall: {
    fontFamily: 'Inter',
    fontSize: 9,
    color: colors.textMuted,
    lineHeight: 1.5,
  },
  // Quote / italic accent (boutique feel)
  quote: {
    fontFamily: 'Playfair Display',
    fontSize: 12,
    fontStyle: 'italic',
    color: colors.textMuted,
    lineHeight: 1.5,
    letterSpacing: 0.2,
  },
  // Labels
  label: {
    fontFamily: 'Inter',
    fontSize: 7.5,
    fontWeight: 600,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  labelOnDark: {
    fontFamily: 'Inter',
    fontSize: 7.5,
    fontWeight: 600,
    color: colors.accentLight,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  labelAccent: {
    fontFamily: 'Inter',
    fontSize: 7.5,
    fontWeight: 600,
    color: colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  // Data
  data: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 11,
    fontWeight: 500,
    color: colors.text,
  },
  dataLarge: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 18,
    fontWeight: 600,
    color: colors.primary,
    letterSpacing: -0.3,
  },
  dataXL: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 24,
    fontWeight: 600,
    color: colors.primary,
    letterSpacing: -0.5,
  },
  // Caption / footnote
  caption: {
    fontFamily: 'Inter',
    fontSize: 7,
    color: colors.textLight,
    letterSpacing: 0.4,
  },
});

// =====================================================================
// PAGE STYLES
// =====================================================================

export const pageStyles = StyleSheet.create({
  page: {
    backgroundColor: colors.white,
    padding: 0,
    fontFamily: 'Inter',
    fontSize: 10,
    color: colors.text,
  },
  pageDark: {
    backgroundColor: colors.primary,
    padding: 0,
    fontFamily: 'Inter',
    fontSize: 10,
    color: colors.white,
  },
  pageDrager: {
    backgroundColor: colors.dragerSubtle,
    padding: 0,
    fontFamily: 'Inter',
    fontSize: 10,
    color: colors.text,
  },
  content: {
    paddingHorizontal: spacing.page,
    paddingTop: spacing.page - 8,
    paddingBottom: 64,
  },
});

// =====================================================================
// FORMATTERS
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
