// src/components/pdf/DealStatusPDF.tsx
//
// Deal-status PDF voor investeerders die actief in een deal zitten.
// Toont waar we staan, wat er gebeurd is, wat er nog moet gebeuren.
// Compact: 1-2 pagina's. Marktwaarde-indicatie meeneembaar via prop.
//
// Wat NIET in dit document komt:
// - Commissie-percentage of fee-structuur (gevoelig — alleen intern)
// - Interne notities of afwijzingsredenen
// - Gegevens over andere kandidaten in de deal

import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import {
  colors, spacing, typography, pageStyles,
  formatEuro, formatM2, formatDate, formatDateShort,
} from '@/lib/pdf/theme';
import {
  PageHeader, PageFooter, SectionTitle, InfoRow,
} from '@/components/pdf/PdfShared';
import { BITO_LOGO_URL } from '@/lib/pdf/logo';
import type { Deal, ObjectVastgoed, Relatie, DealFase } from '@/data/mock-data';
import {
  ASSET_CLASS_LABELS, DEAL_FASE_LABELS, DD_STATUS_LABELS,
} from '@/data/mock-data';

interface Props {
  deal: Deal;
  object: ObjectVastgoed;
  relatie: Relatie;
  marktwaardeMediaan?: number;
  // Optioneel: gebruiker wil bod tonen aan investeerder
  toonBod?: boolean;
}

const DEAL_FASE_VOLGORDE: DealFase[] = [
  'lead', 'introductie', 'interesse', 'bezichtiging',
  'bieding', 'onderhandeling', 'closing', 'afgerond',
];

const styles = StyleSheet.create({
  // === HEADER BLOK ===
  topBlok: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.page,
    paddingVertical: spacing.section,
  },
  topBlokLabel: {
    fontFamily: 'Inter',
    fontSize: 8,
    color: colors.accentLight,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  topBlokTitel: {
    fontFamily: 'Playfair Display',
    fontSize: 22,
    fontWeight: 700,
    color: colors.white,
    letterSpacing: -0.4,
    lineHeight: 1.2,
  },
  topBlokMeta: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    gap: spacing.section,
  },
  topBlokMetaItem: {
    flex: 1,
  },
  topBlokMetaLabel: {
    fontFamily: 'Inter',
    fontSize: 7,
    color: colors.accentLight,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  topBlokMetaValue: {
    fontFamily: 'Inter',
    fontSize: 10,
    fontWeight: 500,
    color: colors.white,
    marginTop: 2,
  },

  // === BODY ===
  body: {
    paddingHorizontal: spacing.page,
    paddingTop: spacing.section,
    paddingBottom: 64,
  },

  // === FASE PROGRESS BAR ===
  faseTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  faseStep: {
    flex: 1,
    alignItems: 'center',
  },
  faseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginBottom: 6,
  },
  faseDotDone: {
    backgroundColor: colors.accent,
  },
  faseDotCurrent: {
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.primary,
    width: 14,
    height: 14,
    borderRadius: 7,
    marginBottom: 4,
  },
  faseDotPending: {
    backgroundColor: colors.border,
  },
  faseLine: {
    position: 'absolute',
    top: 4,
    left: '50%',
    right: '-50%',
    height: 1.5,
    backgroundColor: colors.border,
    zIndex: -1,
  },
  faseLineDone: {
    backgroundColor: colors.accent,
  },
  faseLabel: {
    fontFamily: 'Inter',
    fontSize: 7,
    color: colors.textMuted,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  faseLabelCurrent: {
    color: colors.primary,
    fontWeight: 600,
  },

  // === TWO COLUMN ===
  twoColumn: {
    flexDirection: 'row',
    gap: spacing.section,
    marginTop: spacing.lg,
  },
  column: {
    flex: 1,
  },

  // === BANNERS ===
  marktwaardeBanner: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: '#FAF6EE',
    borderRadius: 4,
    marginTop: spacing.section,
  },
  successBanner: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    backgroundColor: '#E8F5EC',
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: colors.success,
    marginTop: spacing.section,
  },

  // === DISCLAIMER ===
  disclaimer: {
    fontFamily: 'Inter',
    fontSize: 7.5,
    color: colors.textLight,
    fontStyle: 'italic',
    lineHeight: 1.4,
    marginTop: spacing.section,
  },
});


function FaseProgress({ huidigeFase }: { huidigeFase: DealFase }) {
  const huidigIndex = DEAL_FASE_VOLGORDE.indexOf(huidigeFase);

  return (
    <View style={styles.faseTrack}>
      {DEAL_FASE_VOLGORDE.map((fase, i) => {
        const isDone = i < huidigIndex;
        const isCurrent = i === huidigIndex;
        const isLast = i === DEAL_FASE_VOLGORDE.length - 1;
        const dotStyle = isCurrent
          ? styles.faseDotCurrent
          : isDone
            ? styles.faseDotDone
            : styles.faseDotPending;

        return (
          <View key={fase} style={styles.faseStep}>
            {!isLast && (
              <View style={[styles.faseLine, isDone ? styles.faseLineDone : {}]} />
            )}
            <View style={dotStyle} />
            <Text style={[styles.faseLabel, isCurrent ? styles.faseLabelCurrent : {}]}>
              {DEAL_FASE_LABELS[fase].slice(0, 8)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}


export default function DealStatusPDF({
  deal, object, relatie, marktwaardeMediaan, toonBod = false,
}: Props) {
  const titelDisplay = object.anoniem && object.publiekeNaam
    ? object.publiekeNaam
    : object.titel;

  const locatieDisplay = object.anoniem
    ? (object.publiekeRegio ?? object.provincie ?? '—')
    : `${object.plaats}${object.provincie ? ', ' + object.provincie : ''}`;

  const datum = formatDate(new Date().toISOString());
  const isAfgerond = deal.fase === 'afgerond';
  const isAfgevallen = deal.fase === 'afgevallen';

  return (
    <Document
      title={`Bito Vastgoed — Deal Status — ${titelDisplay}`}
      author="Bito Vastgoed"
      subject="Deal Status Update"
    >
      <Page size="A4" style={pageStyles.page}>
        <PageHeader refNummer={object.internReferentienummer} datum={datum} logoUri={BITO_LOGO_URL} />

        {/* === TOP BLOK === */}
        <View style={styles.topBlok}>
          <Text style={styles.topBlokLabel}>Deal Status</Text>
          <Text style={styles.topBlokTitel}>{titelDisplay}</Text>

          <View style={styles.topBlokMeta}>
            <View style={styles.topBlokMetaItem}>
              <Text style={styles.topBlokMetaLabel}>Locatie</Text>
              <Text style={styles.topBlokMetaValue}>{locatieDisplay}</Text>
            </View>
            <View style={styles.topBlokMetaItem}>
              <Text style={styles.topBlokMetaLabel}>Asset class</Text>
              <Text style={styles.topBlokMetaValue}>{ASSET_CLASS_LABELS[object.type]}</Text>
            </View>
            <View style={styles.topBlokMetaItem}>
              <Text style={styles.topBlokMetaLabel}>Voor</Text>
              <Text style={styles.topBlokMetaValue}>{relatie.bedrijfsnaam}</Text>
            </View>
          </View>
        </View>

        <View style={styles.body}>
          {/* === FASE-PROGRESS (alleen bij actieve deals) === */}
          {!isAfgevallen && (
            <View>
              <SectionTitle>Voortgang</SectionTitle>
              <FaseProgress huidigeFase={deal.fase} />
              <Text style={[typography.bodySmall, { textAlign: 'center', marginTop: -4 }]}>
                Huidige fase: <Text style={{ fontWeight: 600, color: colors.primary }}>{DEAL_FASE_LABELS[deal.fase]}</Text>
              </Text>
            </View>
          )}

          {/* === STATUSBANNERS === */}
          {isAfgerond && (
            <View style={styles.successBanner}>
              <Text style={[typography.label, { color: colors.success }]}>Deal afgerond</Text>
              <Text style={[typography.body, { marginTop: 4, color: colors.text }]}>
                Deze transactie is succesvol afgerond. Bito Vastgoed dankt u voor het vertrouwen.
              </Text>
            </View>
          )}

          {isAfgevallen && (
            <View style={{
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.lg,
              backgroundColor: colors.dragerSubtle,
              borderRadius: 4,
              borderLeftWidth: 3,
              borderLeftColor: colors.textMuted,
              marginTop: spacing.lg,
            }}>
              <Text style={[typography.label]}>Deal niet doorgegaan</Text>
              <Text style={[typography.bodySmall, { marginTop: 4 }]}>
                Deze deal is niet doorgegaan. Wij blijven openstaan voor passende vervolgmogelijkheden.
              </Text>
            </View>
          )}

          {/* === DETAILS - twee kolommen === */}
          <View style={styles.twoColumn}>
            <View style={styles.column}>
              <SectionTitle>Object</SectionTitle>
              {object.vraagprijs != null && (
                <InfoRow label="Vraagprijs" value={formatEuro(object.vraagprijs)} isData />
              )}
              {object.oppervlakte != null && (
                <InfoRow label="Oppervlakte" value={formatM2(object.oppervlakte)} isData />
              )}
              {object.bouwjaar != null && (
                <InfoRow label="Bouwjaar" value={String(object.bouwjaar)} isData />
              )}
              {object.energielabelV2 && (
                <InfoRow label="Energielabel" value={object.energielabelV2} last />
              )}
            </View>

            <View style={styles.column}>
              <SectionTitle>Tijdlijn</SectionTitle>
              {deal.datumEersteContact && (
                <InfoRow label="Eerste contact" value={formatDateShort(deal.datumEersteContact)} isData />
              )}
              {deal.bezichtigingGepland && (
                <InfoRow label="Bezichtiging" value={formatDateShort(deal.bezichtigingGepland)} isData />
              )}
              {deal.verwachteClosingdatum && (
                <InfoRow
                  label={isAfgerond ? 'Closing' : 'Verwachte closing'}
                  value={formatDateShort(deal.verwachteClosingdatum)}
                  isData
                />
              )}
              {toonBod && deal.indicatiefBod != null && (
                <InfoRow
                  label="Indicatief bod"
                  value={formatEuro(deal.indicatiefBod)}
                  isData
                  last
                />
              )}
            </View>
          </View>

          {/* === MARKTWAARDE-INDICATIE (optioneel) === */}
          {marktwaardeMediaan != null && (
            <View style={styles.marktwaardeBanner}>
              <Text style={[typography.label, { color: colors.accent }]}>Indicatieve marktwaarde</Text>
              <Text style={[typography.dataXL, { marginTop: 4 }]}>{formatEuro(marktwaardeMediaan)}</Text>
              <Text style={[typography.bodySmall, { marginTop: 4, fontStyle: 'italic' }]}>
                Mediaanwaarde op basis van vergelijkbare referentieobjecten in de markt — geen vervanging
                voor een formele taxatie.
              </Text>
            </View>
          )}

          {/* === DUE DILIGENCE STATUS (alleen als gestart) === */}
          {deal.ddStatus && deal.ddStatus !== 'niet_gestart' && (
            <View style={{ marginTop: spacing.section }}>
              <SectionTitle>Due Diligence</SectionTitle>
              <InfoRow label="Status" value={DD_STATUS_LABELS[deal.ddStatus]} />
              {deal.notaris && <InfoRow label="Notaris" value={deal.notaris} />}
              {deal.bank && <InfoRow label="Financiering" value={deal.bank} last />}
            </View>
          )}

          {/* === DISCLAIMER === */}
          <Text style={styles.disclaimer}>
            Dit document is een statusupdate en is uitsluitend bedoeld voor de geadresseerde. De inhoud is
            strikt vertrouwelijk en mag niet zonder voorafgaande schriftelijke toestemming van Bito Vastgoed
            worden gedeeld of openbaar gemaakt. Aan deze update kunnen geen rechten worden ontleend; alle
            transactiegerelateerde afspraken worden vastgelegd in de daarvoor bestemde formele documenten.
          </Text>
        </View>

        <PageFooter />
      </Page>
    </Document>
  );
}
