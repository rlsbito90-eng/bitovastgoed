// src/components/pdf/ObjectBrochurePDF.tsx
//
// Volledige investeringsmemorandum / brochure. 4-6 pagina's:
//   1. Cover (donkerblauw, foto, titel groot)
//   2. Samenvatting + investeringsthese
//   3. Pand & oppervlakten + financieel detail
//   4. Verhuur (huurders, WALT) — alleen indien data
//   5. Juridisch & kadaster — alleen indien data
//   6. Disclaimer & contact
//
// Voor serieuze investeerders die DD doen.

import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import {
  colors, spacing, typography, pageStyles,
  formatEuro, formatM2, formatPercent, formatDate, formatDateShort,
} from '@/lib/pdf/theme';
import {
  PageHeader, PageFooter, SectionTitle, StatTile, InfoRow, Divider,
} from '@/components/pdf/PdfShared';
import { BITO_LOGO_URL } from '@/lib/pdf/logo';
import type {
  ObjectVastgoed, ObjectHuurder, ObjectFoto,
} from '@/data/mock-data';
import {
  ASSET_CLASS_LABELS, ONDERHOUDSSTAAT_LABELS, VERKOPER_VIA_LABELS,
  INDEXATIE_BASIS_LABELS,
} from '@/data/mock-data';

interface Props {
  object: ObjectVastgoed;
  hoofdfotoUrl?: string;
  fotoUrls?: string[];           // extra foto's (max 4 in galerij)
  huurders?: ObjectHuurder[];
  marktwaardeMediaan?: number;
  walt?: number | null;
  walb?: number | null;
  totaleJaarhuur?: number | null;
  subcategorieLabel?: string;
}

const styles = StyleSheet.create({
  // === COVER ===
  cover: {
    flex: 1,
    backgroundColor: colors.primary,
    flexDirection: 'column',
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '60%',
    objectFit: 'cover',
  },
  coverImageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '60%',
    backgroundColor: 'rgba(7, 36, 56, 0.4)',
  },
  coverImagePlaceholder: {
    width: '100%',
    height: '60%',
    backgroundColor: colors.primaryDark,
  },
  coverContent: {
    flex: 1,
    paddingHorizontal: spacing.page,
    paddingTop: spacing.section,
    paddingBottom: spacing.page,
    justifyContent: 'space-between',
  },
  coverLogo: {
    position: 'absolute',
    top: spacing.page,
    left: spacing.page,
    width: 110,
    height: 'auto',
  },
  coverDocLabel: {
    position: 'absolute',
    top: spacing.page + 4,
    right: spacing.page,
    fontFamily: 'Inter',
    fontSize: 8,
    fontWeight: 500,
    color: colors.accentLight,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  coverTitle: {
    fontFamily: 'Playfair Display',
    fontSize: 36,
    fontWeight: 700,
    color: colors.white,
    letterSpacing: -1,
    lineHeight: 1.1,
    maxWidth: '80%',
  },
  coverLocation: {
    fontFamily: 'Inter',
    fontSize: 12,
    color: colors.accentLight,
    marginTop: spacing.md,
    letterSpacing: 0.5,
  },
  coverAccentRule: {
    width: 32,
    height: 2,
    backgroundColor: colors.accent,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  coverFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  coverFooterCol: {
    flexDirection: 'column',
  },

  // === BODY ===
  body: {
    paddingHorizontal: spacing.page,
    paddingTop: spacing.section,
    paddingBottom: 64,
  },
  paragraph: {
    fontFamily: 'Inter',
    fontSize: 9.5,
    lineHeight: 1.6,
    color: colors.text,
    marginBottom: spacing.md,
  },
  bullet: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  bulletDot: {
    fontFamily: 'Inter',
    fontSize: 9,
    color: colors.accent,
    marginRight: 6,
    lineHeight: 1.55,
  },
  bulletText: {
    fontFamily: 'Inter',
    fontSize: 9.5,
    color: colors.text,
    lineHeight: 1.55,
    flex: 1,
  },

  // === STATS GRID (4 columns) ===
  statGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.section,
  },

  // === TWO COLUMN ===
  twoColumn: {
    flexDirection: 'row',
    gap: spacing.section,
    marginBottom: spacing.section,
  },
  column: {
    flex: 1,
  },

  // === HUURDER ROW ===
  huurderRow: {
    flexDirection: 'row',
    paddingVertical: spacing.md - 2,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  huurderCellNaam: { flex: 2.5, fontFamily: 'Inter', fontSize: 9, color: colors.text },
  huurderCellM2: { flex: 1, fontFamily: 'IBM Plex Mono', fontSize: 8.5, color: colors.text, textAlign: 'right' },
  huurderCellHuur: { flex: 1.5, fontFamily: 'IBM Plex Mono', fontSize: 8.5, color: colors.text, textAlign: 'right' },
  huurderCellEinde: { flex: 1.2, fontFamily: 'Inter', fontSize: 8.5, color: colors.textMuted, textAlign: 'right' },
  huurderHeader: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary,
  },
  huurderHeaderCell: {
    fontFamily: 'Inter',
    fontSize: 7.5,
    fontWeight: 600,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  // === MARKTWAARDE BANNER ===
  marktwaardeBanner: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: '#FAF6EE',
    borderRadius: 4,
    marginBottom: spacing.section,
  },

  // === FOTO GRID ===
  fotoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.section,
  },
  fotoTile: {
    width: '48%',
    height: 130,
    objectFit: 'cover',
    borderRadius: 3,
  },

  // === FINAL DISCLAIMER ===
  disclaimerBox: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    backgroundColor: colors.dragerSubtle,
    borderRadius: 4,
    borderLeftWidth: 2,
    borderLeftColor: colors.accent,
  },
  disclaimerText: {
    fontFamily: 'Inter',
    fontSize: 8,
    color: colors.textMuted,
    lineHeight: 1.5,
  },
});


export default function ObjectBrochurePDF({
  object, hoofdfotoUrl, fotoUrls = [], huurders = [],
  marktwaardeMediaan, walt, walb, totaleJaarhuur, subcategorieLabel,
}: Props) {
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
  const heeftHuurInfo = huurders.length > 0 || totaleJaarhuur != null;
  const heeftJuridischInfo = !!(object.eigendomssituatie || object.erfpachtinformatie ||
                                object.bestemmingsinformatie || object.kadastraalNummer);

  return (
    <Document
      title={`Bito Vastgoed — Investment Memorandum — ${titelDisplay}`}
      author="Bito Vastgoed"
      subject="Investment Memorandum"
    >

      {/* ============================== */}
      {/* PAGINA 1 — COVER               */}
      {/* ============================== */}
      <Page size="A4" style={pageStyles.pageDark}>
        <View style={styles.cover}>
          {/* Foto bovenste 60% */}
          {hoofdfotoUrl ? (
            <>
              <Image src={hoofdfotoUrl} style={styles.coverImage} />
              <View style={styles.coverImageOverlay} />
            </>
          ) : (
            <View style={styles.coverImagePlaceholder} />
          )}

          {/* Logo linksboven (op foto) */}
          <Image src={BITO_LOGO_URL} style={styles.coverLogo} />
          <Text style={styles.coverDocLabel}>Investment Memorandum</Text>

          {/* Onderste 40% — donker blok met titel */}
          <View style={styles.coverContent}>
            <View>
              <View style={styles.coverAccentRule} />
              <Text style={styles.coverTitle}>{titelDisplay}</Text>
              <Text style={styles.coverLocation}>{locatieDisplay}</Text>
            </View>

            <View style={styles.coverFooter}>
              <View style={styles.coverFooterCol}>
                <Text style={[typography.label, { color: colors.accentLight }]}>Asset class</Text>
                <Text style={[typography.body, { color: colors.white, fontSize: 11, marginTop: 2 }]}>
                  {ASSET_CLASS_LABELS[object.type]}
                  {subcategorieLabel ? ` · ${subcategorieLabel}` : ''}
                </Text>
              </View>
              <View style={[styles.coverFooterCol, { alignItems: 'flex-end' }]}>
                <Text style={[typography.label, { color: colors.accentLight }]}>Datum</Text>
                <Text style={[typography.body, { color: colors.white, fontSize: 11, marginTop: 2, fontFamily: 'IBM Plex Mono' }]}>
                  {datum}
                </Text>
                {object.internReferentienummer && (
                  <Text style={[typography.body, { color: colors.accentLight, fontSize: 9, marginTop: 4, fontFamily: 'IBM Plex Mono' }]}>
                    {object.internReferentienummer}
                  </Text>
                )}
              </View>
            </View>
          </View>
        </View>
      </Page>


      {/* ============================== */}
      {/* PAGINA 2 — KERNGEGEVENS        */}
      {/* ============================== */}
      <Page size="A4" style={pageStyles.page}>
        <PageHeader refNummer={object.internReferentienummer} datum={datum} logoUri={BITO_LOGO_URL} />

        <View style={styles.body}>
          {/* Stats top */}
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

          {/* Marktwaarde-banner indien aangevraagd */}
          {marktwaardeMediaan != null && (
            <View style={styles.marktwaardeBanner}>
              <Text style={[typography.label, { color: colors.accent }]}>Indicatieve marktwaarde</Text>
              <Text style={[typography.dataXL, { marginTop: 4 }]}>{formatEuro(marktwaardeMediaan)}</Text>
              <Text style={[typography.bodySmall, { marginTop: 4, fontStyle: 'italic' }]}>
                Mediaanwaarde op basis van vergelijkbare referentieobjecten — geen vervanging voor een formele taxatie.
              </Text>
            </View>
          )}

          {/* Samenvatting */}
          {object.samenvatting && (
            <>
              <SectionTitle>Samenvatting</SectionTitle>
              <Text style={styles.paragraph}>{object.samenvatting}</Text>
            </>
          )}

          {/* Investeringsthese */}
          {theseBullets.length > 0 && (
            <View style={{ marginTop: spacing.lg }}>
              <SectionTitle>Investeringsthese</SectionTitle>
              {theseBullets.map((b, i) => (
                <View key={i} style={styles.bullet}>
                  <Text style={styles.bulletDot}>▸</Text>
                  <Text style={styles.bulletText}>{b}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Risico's */}
          {risicoBullets.length > 0 && (
            <View style={{ marginTop: spacing.lg }}>
              <SectionTitle>Aandachtspunten en risico's</SectionTitle>
              {risicoBullets.map((b, i) => (
                <View key={i} style={styles.bullet}>
                  <Text style={[styles.bulletDot, { color: colors.warning }]}>▸</Text>
                  <Text style={styles.bulletText}>{b}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <PageFooter />
      </Page>


      {/* ============================== */}
      {/* PAGINA 3 — PAND & FINANCIEEL   */}
      {/* ============================== */}
      <Page size="A4" style={pageStyles.page}>
        <PageHeader refNummer={object.internReferentienummer} datum={datum} logoUri={BITO_LOGO_URL} />

        <View style={styles.body}>
          <View style={styles.twoColumn}>
            {/* Pand */}
            <View style={styles.column}>
              <SectionTitle>Pand</SectionTitle>
              {object.bouwjaar && <InfoRow label="Bouwjaar" value={String(object.bouwjaar)} isData />}
              {object.energielabelV2 && <InfoRow label="Energielabel" value={object.energielabelV2} />}
              {object.oppervlakte != null && <InfoRow label="Totale oppervlakte" value={formatM2(object.oppervlakte)} isData />}
              {object.oppervlakteVvo != null && <InfoRow label="VVO" value={formatM2(object.oppervlakteVvo)} isData />}
              {object.oppervlakteBvo != null && <InfoRow label="BVO" value={formatM2(object.oppervlakteBvo)} isData />}
              {object.oppervlakteGbo != null && <InfoRow label="GBO" value={formatM2(object.oppervlakteGbo)} isData />}
              {object.perceelOppervlakte != null && <InfoRow label="Perceeloppervlak" value={formatM2(object.perceelOppervlakte)} isData />}
              {object.aantalVerdiepingen != null && <InfoRow label="Verdiepingen" value={String(object.aantalVerdiepingen)} isData />}
              {object.aantalUnits != null && <InfoRow label="Units" value={String(object.aantalUnits)} isData />}
              {object.onderhoudsstaatNiveau && <InfoRow label="Onderhoudsstaat" value={ONDERHOUDSSTAAT_LABELS[object.onderhoudsstaatNiveau]} last />}
            </View>

            {/* Financieel */}
            <View style={styles.column}>
              <SectionTitle>Financieel</SectionTitle>
              {object.vraagprijs != null && <InfoRow label="Vraagprijs" value={formatEuro(object.vraagprijs)} isData />}
              {object.huurinkomsten != null && <InfoRow label="Huurinkomsten / jr" value={formatEuro(object.huurinkomsten)} isData />}
              {object.servicekostenJaar != null && <InfoRow label="Servicekosten / jr" value={formatEuro(object.servicekostenJaar)} isData />}
              {object.noi != null && <InfoRow label="NOI / jr" value={formatEuro(object.noi)} isData />}
              {bar != null && <InfoRow label="BAR" value={formatPercent(bar)} isData />}
              {object.nettoAanvangsrendement != null && <InfoRow label="NAR" value={formatPercent(object.nettoAanvangsrendement)} isData />}
              {huurPerM2 != null && <InfoRow label="Huur / m² / jr" value={`€ ${huurPerM2.toLocaleString('nl-NL')}`} isData />}
              {object.wozWaarde != null && <InfoRow label={`WOZ${object.wozPeildatum ? ` (${formatDateShort(object.wozPeildatum)})` : ''}`} value={formatEuro(object.wozWaarde)} isData />}
              {object.taxatiewaarde != null && <InfoRow label={`Taxatie${object.taxatiedatum ? ` (${formatDateShort(object.taxatiedatum)})` : ''}`} value={formatEuro(object.taxatiewaarde)} isData last />}
            </View>
          </View>

          {/* Foto-galerij indien aanwezig */}
          {fotoUrls.length > 0 && (
            <View style={{ marginTop: spacing.section }}>
              <SectionTitle>Beeldmateriaal</SectionTitle>
              <View style={styles.fotoGrid}>
                {fotoUrls.slice(0, 4).map((url, i) => (
                  <Image key={i} src={url} style={styles.fotoTile} />
                ))}
              </View>
            </View>
          )}
        </View>

        <PageFooter />
      </Page>


      {/* ============================== */}
      {/* PAGINA 4 — VERHUUR (optioneel) */}
      {/* ============================== */}
      {heeftHuurInfo && (
        <Page size="A4" style={pageStyles.page}>
          <PageHeader refNummer={object.internReferentienummer} datum={datum} logoUri={BITO_LOGO_URL} />

          <View style={styles.body}>
            <SectionTitle>Verhuursituatie</SectionTitle>

            {/* WALT/WALB stats indien beschikbaar */}
            {(walt != null || walb != null || totaleJaarhuur != null) && (
              <View style={styles.statGrid}>
                <StatTile label="Aantal huurders" value={huurders.length > 0 ? String(huurders.length) : '—'} />
                <StatTile label="Totale jaarhuur" value={totaleJaarhuur != null ? formatEuro(totaleJaarhuur, true) : '—'} />
                <StatTile label="WALT" value={walt != null ? `${walt} jr` : '—'} />
                <StatTile label="WALB" value={walb != null ? `${walb} jr` : '—'} />
              </View>
            )}

            {/* Huurders tabel */}
            {huurders.length > 0 && (
              <View style={{ marginTop: spacing.lg }}>
                <View style={styles.huurderHeader}>
                  <Text style={[styles.huurderHeaderCell, { flex: 2.5 }]}>Huurder</Text>
                  <Text style={[styles.huurderHeaderCell, { flex: 1, textAlign: 'right' }]}>m²</Text>
                  <Text style={[styles.huurderHeaderCell, { flex: 1.5, textAlign: 'right' }]}>Jaarhuur</Text>
                  <Text style={[styles.huurderHeaderCell, { flex: 1.2, textAlign: 'right' }]}>Einddatum</Text>
                </View>
                {huurders.map(h => (
                  <View key={h.id} style={styles.huurderRow}>
                    <View style={{ flex: 2.5 }}>
                      <Text style={styles.huurderCellNaam}>{h.huurderNaam}</Text>
                      {h.branche && (
                        <Text style={[typography.bodySmall, { fontSize: 7.5 }]}>{h.branche}</Text>
                      )}
                    </View>
                    <Text style={styles.huurderCellM2}>
                      {h.oppervlakteM2 ? formatM2(h.oppervlakteM2) : '—'}
                    </Text>
                    <Text style={styles.huurderCellHuur}>
                      {h.jaarhuur ? formatEuro(h.jaarhuur) : '—'}
                    </Text>
                    <Text style={styles.huurderCellEinde}>
                      {h.einddatum ? formatDateShort(h.einddatum) : '—'}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          <PageFooter />
        </Page>
      )}


      {/* ============================== */}
      {/* PAGINA 5 — JURIDISCH (opt)     */}
      {/* ============================== */}
      {heeftJuridischInfo && (
        <Page size="A4" style={pageStyles.page}>
          <PageHeader refNummer={object.internReferentienummer} datum={datum} logoUri={BITO_LOGO_URL} />

          <View style={styles.body}>
            <SectionTitle>Juridische status</SectionTitle>

            {object.eigendomssituatie && (
              <View style={{ marginBottom: spacing.lg }}>
                <Text style={typography.label}>Eigendomssituatie</Text>
                <Text style={[typography.body, { marginTop: 4 }]}>{object.eigendomssituatie}</Text>
              </View>
            )}

            {object.erfpachtinformatie && (
              <View style={{ marginBottom: spacing.lg }}>
                <Text style={typography.label}>Erfpacht</Text>
                <Text style={[typography.body, { marginTop: 4 }]}>{object.erfpachtinformatie}</Text>
              </View>
            )}

            {object.bestemmingsinformatie && (
              <View style={{ marginBottom: spacing.lg }}>
                <Text style={typography.label}>Bestemmingsplan</Text>
                <Text style={[typography.body, { marginTop: 4 }]}>{object.bestemmingsinformatie}</Text>
              </View>
            )}

            {(object.kadastraleGemeente || object.kadastraleSectie || object.kadastraalNummer) && (
              <View style={{ marginBottom: spacing.lg }}>
                <Text style={typography.label}>Kadastrale gegevens</Text>
                <View style={{ marginTop: 4 }}>
                  {object.kadastraleGemeente && (
                    <InfoRow label="Gemeente" value={object.kadastraleGemeente} />
                  )}
                  {object.kadastraleSectie && (
                    <InfoRow label="Sectie" value={object.kadastraleSectie} />
                  )}
                  {object.kadastraalNummer && (
                    <InfoRow label="Perceelnummer" value={object.kadastraalNummer} last />
                  )}
                </View>
              </View>
            )}

            {object.asbestinventarisatieAanwezig && (
              <View style={{ marginTop: spacing.section }}>
                <Text style={[typography.bodySmall, { fontStyle: 'italic' }]}>
                  ✓ Asbestinventarisatie beschikbaar bij Bito Vastgoed
                </Text>
              </View>
            )}
          </View>

          <PageFooter />
        </Page>
      )}


      {/* ============================== */}
      {/* PAGINA 6 — DISCLAIMER & CONTACT */}
      {/* ============================== */}
      <Page size="A4" style={pageStyles.page}>
        <PageHeader refNummer={object.internReferentienummer} datum={datum} logoUri={BITO_LOGO_URL} />

        <View style={styles.body}>
          <SectionTitle>Vervolgstappen</SectionTitle>
          <Text style={styles.paragraph}>
            Geïnteresseerd in dit object? Wij begeleiden u graag in het verdere traject — van eerste bezichtiging
            tot due diligence en uiteindelijke transactie. Bito Vastgoed werkt off-market en discreet,
            uitsluitend voor serieuze partijen.
          </Text>

          <View style={{ marginTop: spacing.section }}>
            <SectionTitle>Contact</SectionTitle>
            <View style={{ marginTop: spacing.md }}>
              <Text style={[typography.body, { fontSize: 11, fontWeight: 600 }]}>Bito Vastgoed</Text>
              <Text style={[typography.bodySmall, { marginTop: 4 }]}>info@bitovastgoed.nl</Text>
              <Text style={typography.bodySmall}>bitovastgoed.nl</Text>
            </View>
          </View>

          <View style={{ marginTop: spacing.section * 2 }}>
            <View style={styles.disclaimerBox}>
              <Text style={[typography.label, { color: colors.primary, marginBottom: 6 }]}>Disclaimer</Text>
              <Text style={styles.disclaimerText}>
                Dit Investment Memorandum is opgesteld door Bito Vastgoed op basis van informatie ontvangen van de
                verkopende partij en uit publieke bronnen. Hoewel wij de informatie met zorgvuldigheid hebben samengesteld,
                kunnen wij niet instaan voor de volledigheid of juistheid van de gegevens. Aan de inhoud kunnen geen rechten
                worden ontleend.
              </Text>
              <Text style={[styles.disclaimerText, { marginTop: 6 }]}>
                Dit document is uitsluitend bedoeld voor de geadresseerde en is strikt vertrouwelijk. Verspreiding,
                kopiëring of openbaarmaking zonder schriftelijke toestemming van Bito Vastgoed is niet toegestaan.
              </Text>
              <Text style={[styles.disclaimerText, { marginTop: 6 }]}>
                Voor aankoopadvies en due diligence verwijzen wij u naar een formele taxatie en juridisch onderzoek.
                Genoemde rendementen zijn indicatief en gebaseerd op aangenomen huur- en kostenparameters.
              </Text>
            </View>
          </View>
        </View>

        <PageFooter />
      </Page>
    </Document>
  );
}
