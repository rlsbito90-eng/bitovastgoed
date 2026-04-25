// src/components/pdf/ObjectOnepagerPDF.tsx
//
// Eén-pagina PDF voor cold outreach naar investeerders. Strak, grafisch,
// kerninfo. Anonimiteits-modus wordt gerespecteerd: bij anoniem object
// tonen we alleen publieke naam/regio en NIET het echte adres.

import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import {
  colors, spacing, typography, pageStyles,
  formatEuro, formatM2, formatPercent, formatDate,
} from '@/lib/pdf/theme';
import {
  PageHeader, PageFooter, SectionTitle, StatTile,
} from '@/components/pdf/PdfShared';
import { BITO_LOGO_URL } from '@/lib/pdf/logo';
import type { ObjectVastgoed } from '@/data/mock-data';
import { ASSET_CLASS_LABELS } from '@/data/mock-data';

interface Props {
  object: ObjectVastgoed;
  hoofdfotoUrl?: string;        // signed URL voor hoofdfoto
  marktwaardeMediaan?: number;  // optioneel — als gebruiker dit wil tonen
}

const styles = StyleSheet.create({
  // === HERO BLOK met foto + titel ===
  hero: {
    height: 280,
    backgroundColor: colors.primary,
    position: 'relative',
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: 280,
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
    flexDirection: 'column',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
  },
  heroAccentRule: {
    position: 'absolute',
    bottom: 100,
    left: spacing.page,
    width: 32,
    height: 1.5,
    backgroundColor: colors.accent,
  },
  heroLabel: {
    position: 'absolute',
    bottom: 70,
    left: spacing.page,
    fontFamily: 'Helvetica',
    fontSize: 8,
    fontWeight: 500,
    color: colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  heroTitle: {
    position: 'absolute',
    bottom: spacing.page - 8,
    left: spacing.page,
    right: spacing.page,
    fontFamily: 'Times-Roman',
    fontSize: 26,
    fontWeight: 700,
    color: colors.white,
    letterSpacing: -0.5,
    lineHeight: 1.15,
  },

  // === STAT GRID ===
  statGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.section,
  },

  // === BODY ===
  body: {
    paddingHorizontal: spacing.page,
    paddingTop: spacing.section,
    paddingBottom: 64,
  },
  twoColumn: {
    flexDirection: 'row',
    gap: spacing.section,
    marginTop: spacing.md,
  },
  column: {
    flex: 1,
  },
  paragraph: {
    fontFamily: 'Helvetica',
    fontSize: 9.5,
    lineHeight: 1.55,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  bullet: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm - 1,
  },
  bulletDot: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: colors.accent,
    marginRight: 6,
    lineHeight: 1.5,
  },
  bulletText: {
    fontFamily: 'Helvetica',
    fontSize: 9.5,
    color: colors.text,
    lineHeight: 1.5,
    flex: 1,
  },

  // === MARKTWAARDE ACCENT BLOK ===
  marktwaardeBlok: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 4,
    backgroundColor: '#FAF6EE',
  },
  marktwaardeLabel: {
    fontFamily: 'Helvetica',
    fontSize: 8,
    fontWeight: 500,
    color: colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  marktwaardeValue: {
    fontFamily: 'Courier',
    fontSize: 18,
    fontWeight: 600,
    color: colors.primary,
    marginTop: 2,
  },
  marktwaardeNote: {
    fontFamily: 'Helvetica',
    fontSize: 7.5,
    color: colors.textMuted,
    marginTop: 3,
    fontStyle: 'italic',
  },

  // === DISCLAIMER ===
  disclaimer: {
    fontFamily: 'Helvetica',
    fontSize: 7,
    color: colors.textLight,
    marginTop: spacing.lg,
    fontStyle: 'italic',
    lineHeight: 1.4,
  },
});


export default function ObjectOnepagerPDF({ object, hoofdfotoUrl, marktwaardeMediaan }: Props) {
  // Locatie: respecteer anonimiteit
  const locatieDisplay = object.anoniem
    ? (object.publiekeRegio ?? object.provincie ?? '—')
    : `${object.plaats}${object.provincie ? ', ' + object.provincie : ''}`;

  const titelDisplay = object.anoniem && object.publiekeNaam
    ? object.publiekeNaam
    : object.titel;

  // Bereken huur per m²
  const m2VoorBerekening = object.oppervlakteVvo ?? object.oppervlakte;
  const huurPerM2 = object.huurPerM2 ?? (
    object.huurinkomsten && m2VoorBerekening
      ? Math.round(object.huurinkomsten / m2VoorBerekening)
      : null
  );

  // BAR: gebruik gegeven of bereken uit huurinkomsten/vraagprijs
  const bar = object.brutoAanvangsrendement ?? (
    object.huurinkomsten && object.vraagprijs
      ? (object.huurinkomsten / object.vraagprijs) * 100
      : null
  );

  // Investeringsthese als bullets (één regel per bullet)
  const theseBullets = (object.investeringsthese ?? '')
    .split('\n')
    .map(l => l.replace(/^[-•·*]\s*/, '').trim())
    .filter(Boolean);

  const risicoBullets = (object.risicos ?? '')
    .split('\n')
    .map(l => l.replace(/^[-•·*]\s*/, '').trim())
    .filter(Boolean);

  const datum = formatDate(new Date().toISOString());

  return (
    <Document
      title={`Bito Vastgoed — ${titelDisplay}`}
      author="Bito Vastgoed"
      subject="Investeringsobject"
    >
      <Page size="A4" style={pageStyles.page}>
        <PageHeader refNummer={object.internReferentienummer} datum={datum} logoUri={BITO_LOGO_URL} />

        {/* === HERO BLOK === */}
        <View style={styles.hero}>
          {hoofdfotoUrl ? (
            <>
              <Image src={hoofdfotoUrl} style={styles.heroImage} />
              <View style={styles.heroOverlay} />
            </>
          ) : (
            <View style={styles.heroNoImage} />
          )}
          <View style={styles.heroAccentRule} />
          <Text style={styles.heroLabel}>
            {ASSET_CLASS_LABELS[object.type]}{object.exclusief ? '   ·   Exclusief' : ''}
          </Text>
          <Text style={styles.heroTitle}>{titelDisplay}</Text>
        </View>

        {/* === BODY === */}
        <View style={styles.body}>
          {/* LOCATIE als aparte regel net onder hero */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: spacing.section,
            alignItems: 'flex-end',
          }}>
            <View>
              <Text style={typography.label}>Locatie</Text>
              <Text style={[typography.body, { fontSize: 11, marginTop: 2 }]}>{locatieDisplay}</Text>
            </View>
            {object.bouwjaar && (
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={typography.label}>Bouwjaar</Text>
                <Text style={[typography.data, { fontSize: 11, marginTop: 2 }]}>{object.bouwjaar}</Text>
              </View>
            )}
          </View>

          {/* === STATS GRID === */}
          <View style={styles.statGrid}>
            <StatTile
              label="Vraagprijs"
              value={object.vraagprijs ? formatEuro(object.vraagprijs, true) : (object.prijsindicatie ?? 'Op aanvraag')}
              accent
            />
            <StatTile
              label="Oppervlakte"
              value={object.oppervlakte ? formatM2(object.oppervlakte) : '—'}
            />
            <StatTile
              label="BAR"
              value={bar != null ? formatPercent(bar) : '—'}
            />
            <StatTile
              label="Huur / m² / jr"
              value={huurPerM2 ? `€ ${huurPerM2.toLocaleString('nl-NL')}` : '—'}
            />
          </View>

          {/* === SAMENVATTING + THESIS naast elkaar === */}
          {(object.samenvatting || theseBullets.length > 0) && (
            <View style={styles.twoColumn}>
              {object.samenvatting && (
                <View style={styles.column}>
                  <SectionTitle>Samenvatting</SectionTitle>
                  <Text style={styles.paragraph}>{object.samenvatting}</Text>
                </View>
              )}
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
            </View>
          )}

          {/* === RISICO'S (compact) === */}
          {risicoBullets.length > 0 && (
            <View style={{ marginTop: spacing.lg }}>
              <SectionTitle>Aandachtspunten</SectionTitle>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {risicoBullets.slice(0, 4).map((r, i) => (
                  <Text key={i} style={[
                    styles.paragraph,
                    {
                      fontSize: 8.5,
                      backgroundColor: colors.dragerSubtle,
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 3,
                    },
                  ]}>
                    {r}
                  </Text>
                ))}
              </View>
            </View>
          )}

          {/* === MARKTWAARDE BLOK (optioneel) === */}
          {marktwaardeMediaan != null && (
            <View style={styles.marktwaardeBlok}>
              <Text style={styles.marktwaardeLabel}>Indicatieve marktwaarde</Text>
              <Text style={styles.marktwaardeValue}>{formatEuro(marktwaardeMediaan)}</Text>
              <Text style={styles.marktwaardeNote}>
                Gebaseerd op vergelijkbare referentieobjecten in de markt — geen vervanging voor een formele taxatie.
              </Text>
            </View>
          )}

          {/* === DISCLAIMER === */}
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
