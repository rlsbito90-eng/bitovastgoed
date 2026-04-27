// src/components/pdf/PdfShared.tsx
//
// Gedeelde React-PDF componenten voor Bito documents.
// Batch 8b: rijker, meer karakter.

import { View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { colors, typography, spacing } from '@/lib/pdf/theme';

const sharedStyles = StyleSheet.create({
  // === PAGE HEADER ===
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.page,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  headerLogoText: {
    fontFamily: 'Playfair Display',
    fontSize: 11,
    fontWeight: 600,
    color: colors.primary,
    letterSpacing: 1,
  },
  headerLogoImg: {
    width: 90,
    height: 'auto',
  },
  headerMeta: {
    alignItems: 'flex-end',
  },
  headerMetaLabel: {
    fontFamily: 'Inter',
    fontSize: 6.5,
    color: colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  headerMetaValue: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 9,
    color: colors.primary,
    marginTop: 2,
  },

  // === PAGE FOOTER ===
  pageFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.page,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  // Decoratieve gouden lijn onder de top-border
  pageFooterAccent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 2,
    width: 32,
    backgroundColor: colors.accent,
    marginLeft: spacing.page,
  },
  footerLeft: {
    flexDirection: 'column',
  },
  footerCompany: {
    fontFamily: 'Playfair Display',
    fontSize: 8,
    fontWeight: 600,
    color: colors.primary,
    letterSpacing: 1,
  },
  footerContact: {
    fontFamily: 'Inter',
    fontSize: 7,
    color: colors.textMuted,
    marginTop: 2,
  },
  footerPage: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 7,
    color: colors.textLight,
  },

  // === SECTION TITLE ===
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md + 2,
  },
  sectionTitleAccent: {
    width: 20,
    height: 2,
    backgroundColor: colors.accent,
    marginRight: spacing.md + 2,
  },

  // === STAT TILE ===
  statTile: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md + 2,
    paddingBottom: spacing.md + 2,
    backgroundColor: colors.dragerSubtle,
    borderTopWidth: 1.5,
    borderTopColor: colors.accent,
    minHeight: 64,
  },
  statTileAccent: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md + 2,
    paddingBottom: spacing.md + 2,
    backgroundColor: colors.primary,
    borderTopWidth: 1.5,
    borderTopColor: colors.accent,
    minHeight: 64,
  },
  statTileWide: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md + 2,
    paddingBottom: spacing.md + 2,
    backgroundColor: colors.dragerSubtle,
    borderTopWidth: 1.5,
    borderTopColor: colors.accent,
  },

  // === INFO ROW ===
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.md - 2,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.borderSubtle,
  },
  infoRowLabel: {
    fontFamily: 'Inter',
    fontSize: 9,
    color: colors.textMuted,
    flex: 1,
  },
  infoRowValue: {
    fontFamily: 'Inter',
    fontSize: 9,
    fontWeight: 500,
    color: colors.text,
    textAlign: 'right',
  },
  infoRowValueData: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 9,
    fontWeight: 500,
    color: colors.text,
    textAlign: 'right',
  },

  // === DIVIDERS ===
  divider: {
    height: 0.5,
    backgroundColor: colors.border,
    marginVertical: spacing.lg,
  },
  dividerAccent: {
    height: 1.5,
    backgroundColor: colors.accent,
    marginVertical: spacing.lg,
    width: '20%',
  },
  dividerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  dividerCenterLine: {
    flex: 1,
    height: 0.5,
    backgroundColor: colors.border,
  },
  dividerCenterDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
    marginHorizontal: spacing.md,
  },
});


// =====================================================================
// PageHeader
// =====================================================================

export function PageHeader({
  refNummer,
  datum,
  logoUri,
}: {
  refNummer?: string;
  datum?: string;
  logoUri?: string;
}) {
  return (
    <View style={sharedStyles.pageHeader} fixed>
      {logoUri ? (
        <Image src={logoUri} style={sharedStyles.headerLogoImg} />
      ) : (
        <Text style={sharedStyles.headerLogoText}>BITO VASTGOED</Text>
      )}
      {(refNummer || datum) && (
        <View style={sharedStyles.headerMeta}>
          {refNummer && (
            <>
              <Text style={sharedStyles.headerMetaLabel}>Referentie</Text>
              <Text style={sharedStyles.headerMetaValue}>{refNummer}</Text>
            </>
          )}
          {datum && (
            <>
              <Text style={[sharedStyles.headerMetaLabel, { marginTop: refNummer ? 4 : 0 }]}>Datum</Text>
              <Text style={sharedStyles.headerMetaValue}>{datum}</Text>
            </>
          )}
        </View>
      )}
    </View>
  );
}


// =====================================================================
// PageFooter — verfijnd: contact + paginanummer + decoratieve accent-streep
// =====================================================================

export function PageFooter() {
  return (
    <View style={sharedStyles.pageFooter} fixed>
      {/* Decoratieve gouden hoek-streep */}
      <View style={{
        position: 'absolute',
        top: 0,
        left: spacing.page,
        height: 2,
        width: 32,
        backgroundColor: colors.accent,
      }} />

      <View style={sharedStyles.footerLeft}>
        <Text style={sharedStyles.footerCompany}>BITO VASTGOED</Text>
        <Text style={sharedStyles.footerContact}>info@bitovastgoed.nl  ·  bitovastgoed.nl</Text>
      </View>
      <Text
        style={sharedStyles.footerPage}
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      />
    </View>
  );
}


// =====================================================================
// SectionTitle
// =====================================================================

export function SectionTitle({ children }: { children: string }) {
  return (
    <View style={sharedStyles.sectionTitleRow}>
      <View style={sharedStyles.sectionTitleAccent} />
      <Text style={typography.h3}>{children}</Text>
    </View>
  );
}


// =====================================================================
// StatTile
// =====================================================================

export function StatTile({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <View style={accent ? sharedStyles.statTileAccent : sharedStyles.statTile}>
      <Text style={[
        typography.label,
        accent ? { color: colors.accentLight } : {},
      ]}>{label}</Text>
      <Text style={[
        typography.dataLarge,
        accent ? { color: colors.white } : {},
        { marginTop: 4 },
      ]}>{value}</Text>
    </View>
  );
}


// =====================================================================
// InfoRow
// =====================================================================

export function InfoRow({
  label,
  value,
  isData = false,
  last = false,
}: {
  label: string;
  value: string;
  isData?: boolean;
  last?: boolean;
}) {
  return (
    <View style={[
      sharedStyles.infoRow,
      last ? { borderBottomWidth: 0 } : {},
    ]}>
      <Text style={sharedStyles.infoRowLabel}>{label}</Text>
      <Text style={isData ? sharedStyles.infoRowValueData : sharedStyles.infoRowValue}>
        {value}
      </Text>
    </View>
  );
}


// =====================================================================
// Dividers — drie smaken
// =====================================================================

export function Divider() {
  return <View style={sharedStyles.divider} />;
}

export function AccentDivider() {
  return <View style={sharedStyles.dividerAccent} />;
}

/**
 * Decoratieve "gouden punt tussen lijnen" — voor elegante sectiescheidingen
 * tussen body-blokken in een brochure.
 */
export function CenterDivider() {
  return (
    <View style={sharedStyles.dividerCenter}>
      <View style={sharedStyles.dividerCenterLine} />
      <View style={sharedStyles.dividerCenterDot} />
      <View style={sharedStyles.dividerCenterLine} />
    </View>
  );
}
