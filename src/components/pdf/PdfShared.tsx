// src/components/pdf/PdfShared.tsx
//
// Gedeelde React-PDF componenten voor Bito documents:
// - PageHeader: dunne lijn bovenin met logo + ref-nummer + datum
// - PageFooter: contactgegevens + paginanummer + disclaimer
// - SectionTitle: H2 met gouden accent-streep
// - StatTile: kleine tegel voor cijfers (vraagprijs, m², BAR)
// - InfoRow: label + waarde rij voor key-value lijsten
// - Divider: subtiele scheidslijn
// - LogoBlock: logo links/midden/rechts variant

import { View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { colors, typography, spacing } from '@/lib/pdf/theme';

const sharedStyles = StyleSheet.create({
  // === PAGE HEADER ===
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.page,
    paddingVertical: spacing.lg,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    marginBottom: 0,
  },
  headerLogoText: {
    fontFamily: 'Times-Roman',
    fontSize: 11,
    fontWeight: 600,
    color: colors.primary,
    letterSpacing: 1,
  },
  headerLogoTagline: {
    fontFamily: 'Helvetica',
    fontSize: 7,
    color: colors.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 1,
  },
  headerLogoImg: {
    width: 90,
    height: 'auto',
  },
  headerMeta: {
    alignItems: 'flex-end',
  },
  headerMetaLabel: {
    fontFamily: 'Helvetica',
    fontSize: 7,
    color: colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  headerMetaValue: {
    fontFamily: 'Courier',
    fontSize: 10,
    color: colors.primary,
    marginTop: 1,
  },

  // === PAGE FOOTER (absolute, bottom) ===
  pageFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.page,
    paddingVertical: spacing.lg,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerLeft: {
    flexDirection: 'column',
  },
  footerCompany: {
    fontFamily: 'Helvetica',
    fontSize: 7,
    fontWeight: 600,
    color: colors.primary,
    letterSpacing: 0.5,
  },
  footerContact: {
    fontFamily: 'Helvetica',
    fontSize: 7,
    color: colors.textMuted,
    marginTop: 1,
  },
  footerPage: {
    fontFamily: 'Courier',
    fontSize: 7,
    color: colors.textLight,
  },

  // === SECTION TITLE ===
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitleAccent: {
    width: 16,
    height: 1.5,
    backgroundColor: colors.accent,
    marginRight: spacing.md,
  },

  // === STAT TILE (key-cijfer in cards) ===
  statTile: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    backgroundColor: colors.dragerSubtle,
    borderRadius: 4,
    minHeight: 60,
  },
  statTileAccent: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: 4,
    minHeight: 60,
  },

  // === INFO ROW (label : value) ===
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.md - 2,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  infoRowLabel: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: colors.textMuted,
    flex: 1,
  },
  infoRowValue: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    fontWeight: 500,
    color: colors.text,
    textAlign: 'right',
  },
  infoRowValueData: {
    fontFamily: 'Courier',
    fontSize: 9,
    fontWeight: 500,
    color: colors.text,
    textAlign: 'right',
  },

  // === DIVIDER ===
  divider: {
    height: 0.5,
    backgroundColor: colors.border,
    marginVertical: spacing.lg,
  },
  dividerAccent: {
    height: 1,
    backgroundColor: colors.accent,
    marginVertical: spacing.lg,
    width: '20%',
  },
});


// =====================================================================
// PageHeader — bovenaan elke content-pagina
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
        <View>
          <Text style={sharedStyles.headerLogoText}>BITO VASTGOED</Text>
          <Text style={sharedStyles.headerLogoTagline}>Dealmakers in vastgoed</Text>
        </View>
      )}
      {(refNummer || datum) && (
        <View style={sharedStyles.headerMeta}>
          {refNummer && (
            <>
              <Text style={sharedStyles.headerMetaLabel}>Referentie</Text>
              <Text style={sharedStyles.headerMetaValue}>{refNummer}</Text>
            </>
          )}
          {datum && !refNummer && (
            <>
              <Text style={sharedStyles.headerMetaLabel}>Datum</Text>
              <Text style={sharedStyles.headerMetaValue}>{datum}</Text>
            </>
          )}
        </View>
      )}
    </View>
  );
}


// =====================================================================
// PageFooter — onderaan elke pagina (paginanr + contact)
// =====================================================================

export function PageFooter({
  contact = 'info@bitovastgoed.nl  ·  bitovastgoed.nl',
}: { contact?: string }) {
  return (
    <View style={sharedStyles.pageFooter} fixed>
      <View style={sharedStyles.footerLeft}>
        <Text style={sharedStyles.footerCompany}>BITO VASTGOED</Text>
        <Text style={sharedStyles.footerContact}>{contact}</Text>
      </View>
      <Text
        style={sharedStyles.footerPage}
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      />
    </View>
  );
}


// =====================================================================
// SectionTitle — H2 met gouden accent-streep
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
// StatTile — voor key-cijfers
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
// InfoRow — label + waarde
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
// Divider — subtiele lijn
// =====================================================================

export function Divider({ accent = false }: { accent?: boolean }) {
  return <View style={accent ? sharedStyles.dividerAccent : sharedStyles.divider} />;
}
