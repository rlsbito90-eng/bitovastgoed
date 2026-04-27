// src/components/pdf/ObjectOnepagerPDF.tsx
//
// Eén-pagina PDF voor cold outreach. Batch 8b: visueel rijker.
//   - Groter hero-blok met betere typografie
//   - Stats-band met dunne accentlijnen (geen losse tegels meer)
//   - Investeringsthese met meer ademruimte
//   - Decoratieve gouden hairlines tussen secties
//   - Marktwaarde-indicatie default zichtbaar (uit object-niveau referenties)

import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import {
  colors, spacing, typography, pageStyles,
  formatEuro, formatM2, formatPercent, formatDate,
} from '@/lib/pdf/theme';
import {
  PageHeader, PageFooter, SectionTitle, CenterDivider,
} from '@/components/pdf/PdfShared';
import { BITO_LOGO_URL } from '@/lib/pdf/logo';
import type { ObjectVastgoed } from '@/data/mock-data';
import { ASSET_CLASS_LABELS } from '@/data/mock-data';

interface Props {
  object: ObjectVastgoed;
  hoofdfotoUrl?: string;
  marktwaardeMediaan?: number;
  subcategorieLabel?: string;
}

const styles = StyleSheet.create({
  // === HERO ===
  hero: {
    height: 320,
    backgroundColor: colors.primary,
    position: 'relative',
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: 320,
    objectFit: 'cover',
  },
  heroOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(7, 36, 56, 0.55)',
  },
  heroNoImage: {
    position: 'absolute',
    inset: 0,
    backgroundColor: colors.primary,
  },
  // Sub-pattern voor extra texture op de overlay
  heroPattern: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 90,
    backgroundColor: 'rgba(7, 36, 56, 0.35)',
  },
  heroAccentRule: {
    position: 'absolute',
    bottom: 110,
    left: spacing.page,
    width: 40,
    height: 2,
    backgroundColor: colors.accent,
  },
  heroLabel: {
    position: 'absolute',
    bottom: 80,
    left: spacing.page,
    fontFamily: 'Inter',
    fontSize: 8,
    fontWeight: 600,
    color: colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  heroTitle: {
    position: 'absolute',
    bottom: spacing.page,
    left: spacing.page,
    right: spacing.page,
    fontFamily: 'Playfair Display',
    fontSize: 32,
    fontWeight: 700,
    color: colors.white,
    letterSpacing: -0.7,
    lineHeight: 1.1,
  },
  heroLocatie: {
    position: 'absolute',
    bottom: 22,
    left: spacing.page,
    fontFamily: 'Inter',
    fontSize: 11,
    color: colors.accentLight,
    letterSpacing: 0.5,
  },

  // === STATS BAND (geen tegels — doorlopende band met lijntjes) ===
  statsBand: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderTopWidth: 2,
    borderTopColor: colors.accent,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  statsBandItem: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg + 2,
    borderRightWidth: 0.5,
    borderRightColor: colors.borderSubtle,
  },
  statsBandItemLast: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg + 2,
  },

  // === BODY ===
  body: {
    paddingHorizontal: spacing.page,
    paddingTop: spacing.section,
    paddingBottom: 64,
  },
  twoColumn: {
    flexDirection: 'row',
    gap: spacing.section + 4,
  },
  column: {
    flex: 1,
  },
  paragraph: {
    fontFamily: 'Inter',
    fontSize: 9.5,
    lineHeight: 1.6,
    color: colors.text,
  },
  bullet: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm + 1,
  },
  bulletDot: {
    fontFamily: 'Inter',
    fontSize: 9,
    color: colors.accent,
    marginRight: 7,
    lineHeight: 1.6,
  },
  bulletText: {
    fontFamily: 'Inter',
    fontSize: 9.5,
    color: colors.text,
    lineHeight: 1.55,
    flex: 1,
  },

  // === MARKTWAARDE ACCENT BLOK ===
  marktwaardeBlok: {
    paddingHorizontal: spacing.lg + 4,
    paddingVertical: spacing.lg + 2,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 2,
    backgroundColor: colors.accentSoft,
    marginTop: spacing.lg,
  },
  marktwaardeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  marktwaardeNote: {
    fontFamily: 'Inter',
    fontSize: 7.5,
    color: colors.textMuted,
    marginTop: 6,
    fontStyle: 'italic',
    lineHeight: 1.4,
  },

  // === RISICO CHIPS ===
  risicoChip: {
    fontFamily: 'Inter',
    fontSize: 8.5,
    color: colors.text,
    backgroundColor: colors.dragerSubtle,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 2,
    borderLeftWidth: 1.5,
    borderLeftColor: colors.warning,
  },

  // === DISCLAIMER ===
  disclaimer: {
    fontFamily: 'Inter',
    fontSize: 7,
    color: colors.textLight,
    marginTop: spacing.lg,
    fontStyle: 'italic',
    lineHeight: 1.5,
  },
});


export default function ObjectOnepagerPDF({
  object, hoofdfotoUrl, marktwaardeMediaan, subcategorieLabel,
}: Props) {
  // Locatie respecteert anonimiteit
  const locatieDisplay = object.anoniem
    ? (object.publiekeRegio ?? object.provincie ?? '—')
    : `${object.plaats}${object.provincie ? ', ' + object.provincie : ''}`;

  const titelDisplay = object.anoniem && object.publiekeNaam
    ? object.publiekeNaam
    : object.titel;

  const m2VoorBerekening = object.oppervlakteVvo ?? object.oppervlakte;
  const huurPerM2 = object.huurPerM2 ?? (
    object.huurinkomsten && m2VoorBerekening
      ? Math.round(object.huurinkomsten / m2VoorBerekening)
      : null
  );

  const bar = object.brutoAanvangsrendement ?? (
    object.huurinkomsten && object.vraagprijs
      ? (object.huurinkomsten / object.vraagprijs) * 100
      : null
  );

  const theseBullets = (object.investeringsthese ?? '')
    .split('\n')
    .map(l => l.replace(/^[-•·*]\s*/, '').trim())
    .filter(Boolean);

  const risicoBullets = (object.risicos ?? '')
    .split('\n')
    .map(l => l.replace(/^[-•·*]\s*/, '').trim())
    .filter(Boolean);

  const datum = formatDate(new Date().toISOString());
  const assetLabel = ASSET_CLASS_LABELS[object.type];
  const fullAssetLabel = subcategorieLabel
    ? `${assetLabel} · ${subcategorieLabel}`
    : assetLabel;

  return (
    <Document
      title={`Bito Vastgoed — ${titelDisplay}`}
      author="Bito Vastgoed"
      subject="Investeringsobject"
    >
      <Page size="A4" style={pageStyles.page}>
        <PageHeader refNummer={object.internReferentienummer} datum={datum} logoUri={BITO_LOGO_URL} />

        {/* === HERO === */}
        <View style={styles.hero}>
          {hoofdfotoUrl ? (
            <>
              <Image src={hoofdfotoUrl} style={styles.heroImage} />
              <View style={styles.heroOverlay} />
              <View style={styles.heroPattern} />
            </>
          ) : (
            <View style={styles.heroNoImage} />
          )}
          <View style={styles.heroAccentRule} />
          <Text style={styles.heroLabel}>
            {fullAssetLabel}{object.exclusief ? '   ·   Exclusief Aanbod' : ''}
          </Text>
          <Text style={styles.heroTitle}>{titelDisplay}</Text>
          <Text style={styles.heroLocatie}>{locatieDisplay}</Text>
        </View>

        {/* === STATS BAND === */}
        <View style={styles.statsBand}>
          <View style={styles.statsBandItem}>
            <Text style={typography.label}>Vraagprijs</Text>
            <Text style={[typography.dataLarge, { marginTop: 4, color: colors.accent }]}>
              {object.vraagprijs ? formatEuro(object.vraagprijs, true) : (object.prijsindicatie ?? 'Op aanvraag')}
            </Text>
          </View>
          <View style={styles.statsBandItem}>
            <Text style={typography.label}>Oppervlakte</Text>
            <Text style={[typography.dataLarge, { marginTop: 4 }]}>
              {object.oppervlakte ? formatM2(object.oppervlakte) : '—'}
            </Text>
          </View>
          <View style={styles.statsBandItem}>
            <Text style={typography.label}>BAR</Text>
            <Text style={[typography.dataLarge, { marginTop: 4 }]}>
              {bar != null ? formatPercent(bar) : '—'}
            </Text>
          </View>
          <View style={styles.statsBandItemLast}>
            <Text style={typography.label}>Bouwjaar</Text>
            <Text style={[typography.dataLarge, { marginTop: 4 }]}>
              {object.bouwjaar ?? '—'}
            </Text>
          </View>
        </View>

        {/* === BODY === */}
        <View style={styles.body}>
          {/* Samenvatting */}
          {object.samenvatting && (
            <View style={{ marginBottom: spacing.lg }}>
              <SectionTitle>Samenvatting</SectionTitle>
              <Text style={styles.paragraph}>{object.samenvatting}</Text>
            </View>
          )}

          {/* Twee-koloms: thesis + extra info */}
          <View style={styles.twoColumn}>
            {theseBullets.length > 0 && (
              <View style={styles.column}>
                <SectionTitle>Investeringsthese</SectionTitle>
                {theseBullets.slice(0, 5).map((b, i) => (
                  <View key={i} style={styles.bullet}>
                    <Text style={styles.bulletDot}>▸</Text>
                    <Text style={styles.bulletText}>{b}</Text>
                  </View>
                ))}
              </View>
            )}

            {risicoBullets.length > 0 && (
              <View style={styles.column}>
                <SectionTitle>Aandachtspunten</SectionTitle>
                <View style={{ flexDirection: 'column', gap: 6 }}>
                  {risicoBullets.slice(0, 4).map((r, i) => (
                    <Text key={i} style={styles.risicoChip}>{r}</Text>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* Marktwaarde-blok (optioneel) */}
          {marktwaardeMediaan != null && (
            <View style={styles.marktwaardeBlok}>
              <View style={styles.marktwaardeRow}>
                <View>
                  <Text style={typography.labelAccent}>Indicatieve marktwaarde</Text>
                  <Text style={[typography.dataXL, { marginTop: 4 }]}>
                    {formatEuro(marktwaardeMediaan)}
                  </Text>
                </View>
              </View>
              <Text style={styles.marktwaardeNote}>
                Mediaanwaarde op basis van vergelijkbare referentieobjecten — geen vervanging voor een formele taxatie.
              </Text>
            </View>
          )}

          {/* Decoratieve scheiding */}
          <CenterDivider />

          {/* Disclaimer */}
          <Text style={styles.disclaimer}>
            Deze samenvatting is opgesteld door Bito Vastgoed op basis van beschikbare informatie en is uitsluitend bedoeld
            ter oriëntatie. Aan de inhoud kunnen geen rechten worden ontleend. Voor aankoopadvies en due diligence verwijzen
            wij u naar een formele taxatie en juridisch onderzoek.
          </Text>
        </View>

        <PageFooter />
      </Page>
    </Document>
  );
}
