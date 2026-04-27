// src/components/pdf/ObjectBrochurePDF.tsx
//
// Investment Memorandum (IM) voor Bito Vastgoed — vaste 18-sectie volgorde.
// Filosofie:
//   - Lege secties worden NOOIT getoond. Geen placeholders, geen "—", geen lege ruimte.
//   - Per sectie kan de gebruiker via `imSectiesZichtbaar` expliciet uitzetten.
//   - Documentatietabel is uitzondering: toont status (Beschikbaar / Op aanvraag / Na NDA),
//     maar alleen als sectie actief is ingeschakeld.
//   - Foto's: 1 hero op voorblad full-width, max 2 grote foto's per pagina in beeldmateriaal,
//     plattegronden krijgen eigen sectie groot weergegeven.
//   - Document past zich aan aan wat ingevuld is. Crasht nooit op ontbrekende foto's.

import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import {
  colors, spacing, typography, pageStyles,
  formatEuro, formatM2, formatPercent, formatDate, formatDateShort,
} from '@/lib/pdf/theme';
import { PageHeader, PageFooter, SectionTitle, InfoRow } from '@/components/pdf/PdfShared';
import { BITO_LOGO_URL } from '@/lib/pdf/logo';
import type { ObjectVastgoed, ObjectHuurder } from '@/data/mock-data';
import {
  ASSET_CLASS_LABELS, ONDERHOUDSSTAAT_LABELS, DOCUMENT_TYPE_LABELS,
} from '@/data/mock-data';

interface FotoRef { url: string; bijschrift?: string }

interface Props {
  object: ObjectVastgoed;
  hoofdfotoUrl?: string;
  fotoUrls?: FotoRef[];           // Beeldmateriaal (excl. hoofdfoto, excl. plattegronden)
  plattegrondUrls?: FotoRef[];    // Plattegronden
  huurders?: ObjectHuurder[];
  marktwaardeMediaan?: number;
  walt?: number | null;
  walb?: number | null;
  totaleJaarhuur?: number | null;
  subcategorieLabel?: string;
}

const VERHUUR_LABEL: Record<string, string> = {
  verhuurd: 'Verhuurd',
  leeg: 'Leegstand',
  gedeeltelijk: 'Gedeeltelijk verhuurd',
};

const DOC_STATUS_LABEL: Record<string, string> = {
  beschikbaar: 'Beschikbaar',
  op_aanvraag: 'Op aanvraag',
  na_nda: 'Na NDA',
};

const styles = StyleSheet.create({
  // === COVER ===
  cover: { flex: 1, backgroundColor: colors.primary, position: 'relative' },
  coverImage: { width: '100%', height: '60%', objectFit: 'cover' },
  coverImageOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '60%',
    backgroundColor: 'rgba(7, 36, 56, 0.45)',
  },
  coverImagePlaceholder: { width: '100%', height: '60%', backgroundColor: colors.primaryDark },
  coverContent: {
    flex: 1,
    paddingHorizontal: spacing.page,
    paddingTop: spacing.section + 4,
    paddingBottom: spacing.page,
    justifyContent: 'space-between',
  },
  coverLogo: {
    position: 'absolute', top: spacing.page, left: spacing.page,
    width: 130, height: 'auto',
  },
  coverDocLabel: {
    position: 'absolute', top: spacing.page + 6, right: spacing.page,
    fontFamily: 'Inter', fontSize: 8, fontWeight: 600, color: colors.accent,
    textTransform: 'uppercase', letterSpacing: 2.5,
  },
  coverAccentRule: { width: 40, height: 2.5, backgroundColor: colors.accent, marginBottom: spacing.lg + 2 },
  coverTitle: {
    fontFamily: 'Playfair Display', fontSize: 42, fontWeight: 700,
    color: colors.white, letterSpacing: -1.2, lineHeight: 1.05, maxWidth: '85%',
  },
  coverLocation: {
    fontFamily: 'Inter', fontSize: 13, color: colors.accentLight,
    marginTop: spacing.md + 2, letterSpacing: 0.5,
  },
  coverFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },

  // === BODY ===
  body: {
    paddingHorizontal: spacing.page,
    paddingTop: spacing.section,
    paddingBottom: 70,
  },
  paragraph: {
    fontFamily: 'Inter', fontSize: 9.5, lineHeight: 1.65,
    color: colors.text, marginBottom: spacing.md,
  },
  bullet: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm + 1 },
  bulletDot: { fontFamily: 'Inter', fontSize: 9, color: colors.accent, marginRight: 7, lineHeight: 1.65 },
  bulletText: { fontFamily: 'Inter', fontSize: 9.5, color: colors.text, lineHeight: 1.6, flex: 1 },

  twoColumn: { flexDirection: 'row', gap: spacing.section + 4 },
  column: { flex: 1 },

  // === HUURDER TABLE ===
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: spacing.sm + 1,
    borderBottomWidth: 1, borderBottomColor: colors.primary,
    marginBottom: spacing.xs,
  },
  tableHeaderCell: {
    fontFamily: 'Inter', fontSize: 7.5, fontWeight: 600,
    color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.8,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: spacing.md - 1,
    borderBottomWidth: 0.5, borderBottomColor: colors.borderSubtle,
  },

  // === MARKTWAARDE BANNER ===
  marktwaardeBanner: {
    paddingHorizontal: spacing.lg + 4, paddingVertical: spacing.lg + 2,
    borderWidth: 1, borderColor: colors.accent,
    backgroundColor: colors.accentSoft, marginTop: spacing.md,
  },

  // === FOTO BLOK (2 grote per pagina) ===
  fotoGroot: {
    width: '100%', height: 240,
    objectFit: 'cover', marginBottom: spacing.md,
  },
  fotoCaption: {
    fontFamily: 'Inter', fontSize: 8, color: colors.textMuted,
    fontStyle: 'italic', marginTop: -spacing.sm, marginBottom: spacing.lg,
  },

  // === DISCLAIMER BOX ===
  disclaimerBox: {
    paddingHorizontal: spacing.lg + 4, paddingVertical: spacing.lg + 2,
    backgroundColor: colors.dragerSubtle,
    borderLeftWidth: 2.5, borderLeftColor: colors.accent,
  },
  disclaimerText: {
    fontFamily: 'Inter', fontSize: 8, color: colors.textMuted, lineHeight: 1.55,
  },

  // === CONTACT BLOK ===
  contactBlok: {
    paddingHorizontal: spacing.lg + 4, paddingVertical: spacing.lg + 2,
    backgroundColor: colors.primary,
    borderLeftWidth: 2.5, borderLeftColor: colors.accent,
    marginTop: spacing.lg,
  },
  contactNaam: { fontFamily: 'Inter', fontSize: 12, fontWeight: 600, color: colors.white },
  contactRegel: { fontFamily: 'Inter', fontSize: 9.5, color: colors.accentLight, marginTop: 3 },
});

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

function splitBullets(s?: string): string[] {
  if (!s) return [];
  return s.split('\n').map(l => l.replace(/^[-•·*]\s*/, '').trim()).filter(Boolean);
}

function paraGraph(s?: string): string[] {
  if (!s?.trim()) return [];
  return s.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
}

/** Sectie tonen? Default JA als content aanwezig; kan via toggle uitgezet worden. */
function show(toggles: Record<string, boolean> | undefined, key: string, hasContent: boolean): boolean {
  if (!hasContent) return false;
  if (toggles && toggles[key] === false) return false;
  return true;
}

// ---------------------------------------------------------------------
// IM-component
// ---------------------------------------------------------------------

export default function ObjectBrochurePDF({
  object, hoofdfotoUrl, fotoUrls = [], plattegrondUrls = [], huurders = [],
  marktwaardeMediaan, walt, walb, totaleJaarhuur, subcategorieLabel,
}: Props) {
  const t = object.imSectiesZichtbaar;

  // === Display helpers ===
  const locatieDisplay = object.anoniem
    ? (object.publiekeRegio ?? object.provincie ?? '')
    : [object.plaats, object.provincie].filter(Boolean).join(', ');
  const titelDisplay = object.anoniem && object.publiekeNaam ? object.publiekeNaam : object.titel;

  const m2 = object.oppervlakteVvo ?? object.oppervlakte;
  const huurPerM2 = object.huurPerM2 ?? (object.huurinkomsten && m2 ? Math.round(object.huurinkomsten / m2) : null);
  const bar = object.brutoAanvangsrendement ?? (
    object.huurinkomsten && object.vraagprijs ? (object.huurinkomsten / object.vraagprijs) * 100 : null
  );
  const factor = (object.huurinkomsten && object.vraagprijs)
    ? object.vraagprijs / object.huurinkomsten
    : null;

  const datum = formatDate(new Date().toISOString());
  const fullAssetLabel = subcategorieLabel
    ? `${ASSET_CLASS_LABELS[object.type]} · ${subcategorieLabel}`
    : ASSET_CLASS_LABELS[object.type];

  // === Sectie-content: bepaal of er iets te tonen valt ===
  const heeftSamenvatting = !!object.samenvatting?.trim();
  const heeftPropositie = !!object.propositie?.trim();
  const heeftObjectomschrijving = !!object.objectomschrijving?.trim();
  const heeftLocatie = !!object.locatieOmschrijving?.trim();
  const theseBullets = splitBullets(object.investeringsthese);
  const risicoBullets = splitBullets(object.risicos);
  const onderscheidendBullets = splitBullets(object.onderscheidendeKenmerken);

  // Kerngegevens-rijen — alleen wat data heeft
  const kernRows: Array<{ label: string; value: string; isData?: boolean }> = [];
  if (object.vraagprijs != null) kernRows.push({ label: 'Vraagprijs', value: formatEuro(object.vraagprijs), isData: true });
  else if (object.prijsindicatie) kernRows.push({ label: 'Prijsindicatie', value: object.prijsindicatie });
  if (object.oppervlakteGbo != null) kernRows.push({ label: 'GBO', value: formatM2(object.oppervlakteGbo), isData: true });
  else if (object.oppervlakte != null) kernRows.push({ label: 'Oppervlakte', value: formatM2(object.oppervlakte), isData: true });
  if (object.bouwjaar != null) kernRows.push({ label: 'Bouwjaar', value: String(object.bouwjaar), isData: true });
  if (object.eigendomssituatie) kernRows.push({ label: 'Eigendom', value: object.eigendomssituatie });
  if (object.verhuurStatus) kernRows.push({ label: 'Verhuursituatie', value: VERHUUR_LABEL[object.verhuurStatus] ?? String(object.verhuurStatus) });
  if (bar != null) kernRows.push({ label: 'BAR', value: formatPercent(bar), isData: true });

  // Kerngegevens kolom-2 (uitgebreide pand-info)
  const pandRows: Array<{ label: string; value: string; isData?: boolean }> = [];
  if (object.oppervlakteVvo != null) pandRows.push({ label: 'VVO', value: formatM2(object.oppervlakteVvo), isData: true });
  if (object.oppervlakteBvo != null) pandRows.push({ label: 'BVO', value: formatM2(object.oppervlakteBvo), isData: true });
  if (object.perceelOppervlakte != null) pandRows.push({ label: 'Perceel', value: formatM2(object.perceelOppervlakte), isData: true });
  if (object.aantalVerdiepingen != null) pandRows.push({ label: 'Verdiepingen', value: String(object.aantalVerdiepingen), isData: true });
  if (object.aantalUnits != null) pandRows.push({ label: 'Units', value: String(object.aantalUnits), isData: true });
  if (object.energielabelV2) pandRows.push({ label: 'Energielabel', value: object.energielabelV2 });
  if (object.onderhoudsstaatNiveau) pandRows.push({ label: 'Onderhoudsstaat', value: ONDERHOUDSSTAAT_LABELS[object.onderhoudsstaatNiveau] });
  if (object.huidigGebruik) pandRows.push({ label: 'Huidig gebruik', value: object.huidigGebruik });

  // Oppervlakten per verdieping
  const oppRijen = (object.oppervlaktenPerVerdieping ?? []).filter(r => r && r.verdieping);

  // Huur
  const heeftHuurders = huurders.length > 0;
  const heeftHuurInfo = heeftHuurders || totaleJaarhuur != null || object.huurinkomsten != null;

  // Financieel
  const finRows: Array<{ label: string; value: string }> = [];
  if (object.huurinkomsten != null) finRows.push({ label: 'Huurinkomsten / jr', value: formatEuro(object.huurinkomsten) });
  if (object.servicekostenJaar != null) finRows.push({ label: 'Servicekosten / jr', value: formatEuro(object.servicekostenJaar) });
  if (object.noi != null) finRows.push({ label: 'NOI / jr', value: formatEuro(object.noi) });
  if (bar != null) finRows.push({ label: 'BAR', value: formatPercent(bar) });
  if (object.nettoAanvangsrendement != null) finRows.push({ label: 'NAR', value: formatPercent(object.nettoAanvangsrendement) });
  if (huurPerM2 != null) finRows.push({ label: 'Huur / m² / jr', value: `€ ${huurPerM2.toLocaleString('nl-NL')}` });
  if (factor != null) finRows.push({ label: 'Factor', value: `${factor.toFixed(1)}x` });
  if (object.wozWaarde != null) finRows.push({ label: `WOZ${object.wozPeildatum ? ` (${formatDateShort(object.wozPeildatum)})` : ''}`, value: formatEuro(object.wozWaarde) });
  if (object.taxatiewaarde != null) finRows.push({ label: `Taxatie${object.taxatiedatum ? ` (${formatDateShort(object.taxatiedatum)})` : ''}`, value: formatEuro(object.taxatiewaarde) });

  const fs = object.financieleScenarios ?? {};
  const heeftScenarios = !!(fs.huidig || fs.marktconform || fs.naRenovatie);

  // Juridisch
  const jurRows: Array<{ label: string; value: string }> = [];
  if (object.eigendomssituatie) jurRows.push({ label: 'Eigendomssituatie', value: object.eigendomssituatie });
  if (object.erfpachtinformatie) jurRows.push({ label: 'Erfpacht', value: object.erfpachtinformatie });
  if (object.kadastraleGemeente || object.kadastraleSectie || object.kadastraalNummer) {
    jurRows.push({
      label: 'Kadaster',
      value: [object.kadastraleGemeente, object.kadastraleSectie, object.kadastraalNummer].filter(Boolean).join(' · '),
    });
  }

  // Bestemming
  const heeftBestemming = !!(object.bestemmingsinformatie?.trim());

  // Technische staat
  const techRijen: Array<{ label: string; value: string }> = [];
  if (object.onderhoudsstaatNiveau) techRijen.push({ label: 'Onderhoudsniveau', value: ONDERHOUDSSTAAT_LABELS[object.onderhoudsstaatNiveau] });
  if (object.recenteInvesteringen) techRijen.push({ label: 'Recente investeringen', value: object.recenteInvesteringen });
  if (object.achterstalligOnderhoud) techRijen.push({ label: 'Achterstallig onderhoud', value: object.achterstalligOnderhoud });
  if (object.asbestinventarisatieAanwezig != null) techRijen.push({ label: 'Asbestinventarisatie', value: object.asbestinventarisatieAanwezig ? 'Aanwezig' : 'Niet aanwezig' });
  const techVrijTekst = object.technischeStaatOmschrijving?.trim();

  // Documentatiestatus tabel
  const docStatus = object.documentatieStatus ?? {};
  const docStatusEntries = Object.entries(docStatus).filter(([, v]) => !!v);
  // Toggle-only sectie: vereist expliciet AAN
  const toonDocTabel = (t?.documentatie === true) && docStatusEntries.length > 0;

  // Proces & voorwaarden
  const heeftProces = !!object.procesVoorwaarden?.trim();

  // Contact
  const contactNaam = object.contactNaam?.trim() || object.verkoperNaam?.trim();
  const contactFunctie = object.contactFunctie?.trim() || object.verkoperRol?.trim();
  const contactTelefoon = object.contactTelefoon?.trim() || object.verkoperTelefoon?.trim();
  const contactEmail = object.contactEmail?.trim() || object.verkoperEmail?.trim();
  const heeftContact = !!(contactNaam || contactTelefoon || contactEmail);

  // Marktwaarde (handmatig of mediaan)
  const marktwaarde = object.marktwaardeIndicatie ?? marktwaardeMediaan ?? null;
  const marktwaardeBron = object.marktwaardeBron?.trim();

  // ---------------------------------------------------------------
  // Render — pagina-grenzen volgen content. React-PDF wikkelt automatisch.
  // We groeperen secties in logische pagina-blokken zodat content netjes valt.
  // ---------------------------------------------------------------

  return (
    <Document
      title={`Bito Vastgoed — Investment Memorandum — ${titelDisplay}`}
      author="Bito Vastgoed"
      subject="Investment Memorandum"
    >
      {/* ============================== */}
      {/* 1. VOORBLAD                    */}
      {/* ============================== */}
      <Page size="A4" style={pageStyles.pageDark}>
        <View style={styles.cover}>
          {hoofdfotoUrl ? (
            <>
              <Image src={hoofdfotoUrl} style={styles.coverImage} />
              <View style={styles.coverImageOverlay} />
            </>
          ) : (
            <View style={styles.coverImagePlaceholder} />
          )}

          <Image src={BITO_LOGO_URL} style={styles.coverLogo} />
          <Text style={styles.coverDocLabel}>Investment Memorandum</Text>

          <View style={styles.coverContent}>
            <View>
              <View style={styles.coverAccentRule} />
              <Text style={styles.coverTitle}>{titelDisplay}</Text>
              {locatieDisplay && <Text style={styles.coverLocation}>{locatieDisplay}</Text>}
            </View>

            <View style={styles.coverFooter}>
              <View>
                <Text style={typography.labelOnDark}>Asset class</Text>
                <Text style={[typography.body, { color: colors.white, fontSize: 11, marginTop: 3 }]}>
                  {fullAssetLabel}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={typography.labelOnDark}>Datum</Text>
                <Text style={[typography.body, { color: colors.white, fontSize: 11, marginTop: 3, fontFamily: 'IBM Plex Mono' }]}>
                  {datum}
                </Text>
                {object.internReferentienummer && (
                  <Text style={[typography.body, { color: colors.accentLight, fontSize: 9, marginTop: 6, fontFamily: 'IBM Plex Mono' }]}>
                    Ref. {object.internReferentienummer}
                  </Text>
                )}
              </View>
            </View>
          </View>
        </View>
      </Page>

      {/* ============================== */}
      {/* PAGINA — Samenvatting tot Kerngegevens */}
      {/* ============================== */}
      <Page size="A4" style={pageStyles.page}>
        <PageHeader refNummer={object.internReferentienummer} datum={datum} logoUri={BITO_LOGO_URL} />
        <View style={styles.body}>

          {/* 2. SAMENVATTING */}
          {show(t, 'samenvatting', heeftSamenvatting) && (
            <View style={{ marginBottom: spacing.lg }}>
              <SectionTitle>Samenvatting</SectionTitle>
              {paraGraph(object.samenvatting).map((p, i) => (
                <Text key={i} style={styles.paragraph}>{p}</Text>
              ))}
            </View>
          )}

          {/* 3. PROPOSITIE */}
          {show(t, 'propositie', heeftPropositie || theseBullets.length > 0) && (
            <View style={{ marginBottom: spacing.lg }} wrap={false}>
              <SectionTitle>Propositie</SectionTitle>
              {object.propositie && paraGraph(object.propositie).map((p, i) => (
                <Text key={`p-${i}`} style={styles.paragraph}>{p}</Text>
              ))}
              {theseBullets.map((b, i) => (
                <View key={`b-${i}`} style={styles.bullet}>
                  <Text style={styles.bulletDot}>▸</Text>
                  <Text style={styles.bulletText}>{b}</Text>
                </View>
              ))}
              {onderscheidendBullets.length > 0 && (
                <View style={{ marginTop: spacing.sm }}>
                  <Text style={[typography.label, { marginBottom: spacing.sm }]}>Onderscheidende kenmerken</Text>
                  {onderscheidendBullets.map((b, i) => (
                    <View key={`o-${i}`} style={styles.bullet}>
                      <Text style={styles.bulletDot}>▸</Text>
                      <Text style={styles.bulletText}>{b}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* 4. KERNGEGEVENS */}
          {show(t, 'kerngegevens', kernRows.length > 0 || pandRows.length > 0) && (
            <View style={{ marginBottom: spacing.lg }} wrap={false}>
              <SectionTitle>Kerngegevens</SectionTitle>
              <View style={styles.twoColumn}>
                {kernRows.length > 0 && (
                  <View style={styles.column}>
                    {kernRows.map((r, i) => (
                      <InfoRow key={i} label={r.label} value={r.value} isData={r.isData} last={i === kernRows.length - 1} />
                    ))}
                  </View>
                )}
                {pandRows.length > 0 && (
                  <View style={styles.column}>
                    {pandRows.map((r, i) => (
                      <InfoRow key={i} label={r.label} value={r.value} isData={r.isData} last={i === pandRows.length - 1} />
                    ))}
                  </View>
                )}
              </View>
            </View>
          )}

          {/* 5. OBJECTOMSCHRIJVING */}
          {show(t, 'objectomschrijving', heeftObjectomschrijving) && (
            <View style={{ marginBottom: spacing.lg }}>
              <SectionTitle>Objectomschrijving</SectionTitle>
              {paraGraph(object.objectomschrijving).map((p, i) => (
                <Text key={i} style={styles.paragraph}>{p}</Text>
              ))}
            </View>
          )}

          {/* 6. LOCATIE & OMGEVING */}
          {show(t, 'locatie', heeftLocatie) && (
            <View style={{ marginBottom: spacing.lg }}>
              <SectionTitle>Locatie en omgeving</SectionTitle>
              {paraGraph(object.locatieOmschrijving).map((p, i) => (
                <Text key={i} style={styles.paragraph}>{p}</Text>
              ))}
            </View>
          )}

        </View>
        <PageFooter />
      </Page>

      {/* ============================== */}
      {/* 7. BEELDMATERIAAL — max 2 grote foto's per pagina */}
      {/* ============================== */}
      {show(t, 'beeldmateriaal', fotoUrls.length > 0) && (
        <Page size="A4" style={pageStyles.page}>
          <PageHeader refNummer={object.internReferentienummer} datum={datum} logoUri={BITO_LOGO_URL} />
          <View style={styles.body}>
            <SectionTitle>Beeldmateriaal</SectionTitle>
            {fotoUrls.map((f, i) => (
              <View key={i} wrap={false}>
                <Image src={f.url} style={styles.fotoGroot} />
                {f.bijschrift && <Text style={styles.fotoCaption}>{f.bijschrift}</Text>}
              </View>
            ))}
          </View>
          <PageFooter />
        </Page>
      )}

      {/* ============================== */}
      {/* 8. PLATTEGRONDEN — eigen sectie, groot weergegeven */}
      {/* ============================== */}
      {show(t, 'plattegronden', plattegrondUrls.length > 0) && (
        <Page size="A4" style={pageStyles.page}>
          <PageHeader refNummer={object.internReferentienummer} datum={datum} logoUri={BITO_LOGO_URL} />
          <View style={styles.body}>
            <SectionTitle>Plattegronden</SectionTitle>
            {plattegrondUrls.map((f, i) => (
              <View key={i} wrap={false}>
                <Image src={f.url} style={[styles.fotoGroot, { height: 320, objectFit: 'contain' }]} />
                {f.bijschrift && <Text style={styles.fotoCaption}>{f.bijschrift}</Text>}
              </View>
            ))}
          </View>
          <PageFooter />
        </Page>
      )}

      {/* ============================== */}
      {/* PAGINA — Oppervlakten + Huur + Financieel */}
      {/* ============================== */}
      {(show(t, 'oppervlakten', oppRijen.length > 0)
        || show(t, 'huur', heeftHuurInfo)
        || show(t, 'financieel', finRows.length > 0 || marktwaarde != null || heeftScenarios)) && (
        <Page size="A4" style={pageStyles.page}>
          <PageHeader refNummer={object.internReferentienummer} datum={datum} logoUri={BITO_LOGO_URL} />
          <View style={styles.body}>

            {/* 9. OPPERVLAKTEN */}
            {show(t, 'oppervlakten', oppRijen.length > 0) && (
              <View style={{ marginBottom: spacing.lg }} wrap={false}>
                <SectionTitle>Oppervlakten per verdieping</SectionTitle>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Verdieping</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>VVO</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>BVO</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Bestemming</Text>
                </View>
                {oppRijen.map((r, i) => (
                  <View key={i} style={styles.tableRow}>
                    <Text style={{ flex: 2, fontFamily: 'Inter', fontSize: 9 }}>{r.verdieping}</Text>
                    <Text style={{ flex: 1, fontFamily: 'IBM Plex Mono', fontSize: 8.5, textAlign: 'right' }}>
                      {r.vvo != null ? formatM2(r.vvo) : ''}
                    </Text>
                    <Text style={{ flex: 1, fontFamily: 'IBM Plex Mono', fontSize: 8.5, textAlign: 'right' }}>
                      {r.bvo != null ? formatM2(r.bvo) : ''}
                    </Text>
                    <Text style={{ flex: 2, fontFamily: 'Inter', fontSize: 9, color: colors.textMuted }}>{r.bestemming ?? ''}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* 10. HUURINFORMATIE */}
            {show(t, 'huur', heeftHuurInfo) && (
              <View style={{ marginBottom: spacing.lg }}>
                <SectionTitle>Huurinformatie</SectionTitle>
                {(walt != null || walb != null || totaleJaarhuur != null || huurders.length > 0) && (
                  <View style={{ flexDirection: 'row', gap: spacing.lg, marginBottom: spacing.md }}>
                    {huurders.length > 0 && (
                      <View style={{ flex: 1 }}><InfoRow label="Aantal huurders" value={String(huurders.length)} isData last /></View>
                    )}
                    {totaleJaarhuur != null && (
                      <View style={{ flex: 1 }}><InfoRow label="Totale jaarhuur" value={formatEuro(totaleJaarhuur, true)} isData last /></View>
                    )}
                    {walt != null && (
                      <View style={{ flex: 1 }}><InfoRow label="WALT" value={`${walt} jr`} isData last /></View>
                    )}
                    {walb != null && (
                      <View style={{ flex: 1 }}><InfoRow label="WALB" value={`${walb} jr`} isData last /></View>
                    )}
                  </View>
                )}

                {heeftHuurders && (
                  <>
                    <View style={styles.tableHeader}>
                      <Text style={[styles.tableHeaderCell, { flex: 2.5 }]}>Huurder</Text>
                      <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>m²</Text>
                      <Text style={[styles.tableHeaderCell, { flex: 1.5, textAlign: 'right' }]}>Huur / jr</Text>
                      <Text style={[styles.tableHeaderCell, { flex: 1.2, textAlign: 'right' }]}>Einde</Text>
                    </View>
                    {huurders.map((h, i) => (
                      <View key={i} style={styles.tableRow}>
                        <Text style={{ flex: 2.5, fontFamily: 'Inter', fontSize: 9 }}>{h.huurderNaam}</Text>
                        <Text style={{ flex: 1, fontFamily: 'IBM Plex Mono', fontSize: 8.5, textAlign: 'right' }}>
                          {h.oppervlakteM2 != null ? formatM2(h.oppervlakteM2) : ''}
                        </Text>
                        <Text style={{ flex: 1.5, fontFamily: 'IBM Plex Mono', fontSize: 8.5, textAlign: 'right' }}>
                          {h.jaarhuur != null ? formatEuro(h.jaarhuur) : ''}
                        </Text>
                        <Text style={{ flex: 1.2, fontFamily: 'Inter', fontSize: 8.5, color: colors.textMuted, textAlign: 'right' }}>
                          {h.einddatum ? formatDateShort(h.einddatum) : ''}
                        </Text>
                      </View>
                    ))}
                  </>
                )}
              </View>
            )}

            {/* 11. FINANCIEEL OVERZICHT */}
            {show(t, 'financieel', finRows.length > 0 || marktwaarde != null || heeftScenarios) && (
              <View style={{ marginBottom: spacing.lg }} wrap={false}>
                <SectionTitle>Financieel overzicht</SectionTitle>
                {finRows.map((r, i) => (
                  <InfoRow key={i} label={r.label} value={r.value} isData last={i === finRows.length - 1} />
                ))}

                {marktwaarde != null && (
                  <View style={styles.marktwaardeBanner}>
                    <Text style={typography.labelAccent}>Indicatieve marktwaarde</Text>
                    <Text style={[typography.dataXL, { marginTop: 4 }]}>{formatEuro(marktwaarde)}</Text>
                    <Text style={[typography.bodySmall, { marginTop: 6, fontStyle: 'italic' }]}>
                      {marktwaardeBron || 'Mediaanwaarde op basis van vergelijkbare referentieobjecten — geen vervanging voor een formele taxatie.'}
                    </Text>
                  </View>
                )}

                {heeftScenarios && (
                  <View style={{ marginTop: spacing.md }}>
                    <Text style={[typography.label, { marginBottom: spacing.sm }]}>Scenario's</Text>
                    {(['huidig', 'marktconform', 'naRenovatie'] as const).map(key => {
                      const s = fs[key];
                      if (!s) return null;
                      const label = key === 'huidig' ? 'Huidig' : key === 'marktconform' ? 'Marktconform' : 'Na renovatie';
                      const parts: string[] = [];
                      if (s.jaarhuur != null) parts.push(`Huur: ${formatEuro(s.jaarhuur)}`);
                      if (s.bar != null) parts.push(`BAR: ${formatPercent(s.bar)}`);
                      if (s.noi != null) parts.push(`NOI: ${formatEuro(s.noi)}`);
                      if (parts.length === 0 && !s.opmerking) return null;
                      return (
                        <View key={key} style={{ marginBottom: spacing.sm }}>
                          <Text style={{ fontFamily: 'Inter', fontSize: 9, fontWeight: 600, color: colors.primary }}>{label}</Text>
                          {parts.length > 0 && (
                            <Text style={{ fontFamily: 'IBM Plex Mono', fontSize: 8.5, color: colors.text, marginTop: 2 }}>
                              {parts.join('   ·   ')}
                            </Text>
                          )}
                          {s.opmerking && (
                            <Text style={{ fontFamily: 'Inter', fontSize: 8.5, color: colors.textMuted, fontStyle: 'italic', marginTop: 2 }}>
                              {s.opmerking}
                            </Text>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

          </View>
          <PageFooter />
        </Page>
      )}

      {/* ============================== */}
      {/* PAGINA — Juridisch / Bestemming / Technisch / Documentatie / Risico's */}
      {/* ============================== */}
      {(show(t, 'juridisch', jurRows.length > 0)
        || show(t, 'bestemming', heeftBestemming)
        || show(t, 'technisch', techRijen.length > 0 || !!techVrijTekst)
        || toonDocTabel
        || show(t, 'risicos', risicoBullets.length > 0)) && (
        <Page size="A4" style={pageStyles.page}>
          <PageHeader refNummer={object.internReferentienummer} datum={datum} logoUri={BITO_LOGO_URL} />
          <View style={styles.body}>

            {/* 12. JURIDISCHE STATUS */}
            {show(t, 'juridisch', jurRows.length > 0) && (
              <View style={{ marginBottom: spacing.lg }} wrap={false}>
                <SectionTitle>Juridische status</SectionTitle>
                {jurRows.map((r, i) => (
                  <InfoRow key={i} label={r.label} value={r.value} last={i === jurRows.length - 1} />
                ))}
              </View>
            )}

            {/* 13. BESTEMMING / GEBRUIK */}
            {show(t, 'bestemming', heeftBestemming) && (
              <View style={{ marginBottom: spacing.lg }}>
                <SectionTitle>Bestemming en gebruik</SectionTitle>
                {paraGraph(object.bestemmingsinformatie).map((p, i) => (
                  <Text key={i} style={styles.paragraph}>{p}</Text>
                ))}
              </View>
            )}

            {/* 14. TECHNISCHE STAAT */}
            {show(t, 'technisch', techRijen.length > 0 || !!techVrijTekst) && (
              <View style={{ marginBottom: spacing.lg }} wrap={false}>
                <SectionTitle>Technische staat</SectionTitle>
                {techVrijTekst && paraGraph(techVrijTekst).map((p, i) => (
                  <Text key={`tv-${i}`} style={styles.paragraph}>{p}</Text>
                ))}
                {techRijen.map((r, i) => (
                  <InfoRow key={i} label={r.label} value={r.value} last={i === techRijen.length - 1} />
                ))}
              </View>
            )}

            {/* 15. BESCHIKBARE DOCUMENTATIE — toggle-only */}
            {toonDocTabel && (
              <View style={{ marginBottom: spacing.lg }} wrap={false}>
                <SectionTitle>Beschikbare documentatie</SectionTitle>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Document</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.5, textAlign: 'right' }]}>Status</Text>
                </View>
                {docStatusEntries.map(([type, status], i) => {
                  const label = (DOCUMENT_TYPE_LABELS as any)?.[type] ?? type;
                  return (
                    <View key={i} style={styles.tableRow}>
                      <Text style={{ flex: 3, fontFamily: 'Inter', fontSize: 9 }}>{label}</Text>
                      <Text style={{ flex: 1.5, fontFamily: 'Inter', fontSize: 9, color: colors.primary, textAlign: 'right', fontWeight: 600 }}>
                        {DOC_STATUS_LABEL[status as string] ?? String(status)}
                      </Text>
                    </View>
                  );
                })}
                {object.dataroomUrl && (
                  <Text style={{ fontFamily: 'Inter', fontSize: 8.5, color: colors.textMuted, marginTop: spacing.md, fontStyle: 'italic' }}>
                    Dataroom beschikbaar via: {object.dataroomUrl}
                  </Text>
                )}
              </View>
            )}

            {/* Risico's / aandachtspunten — onderdeel van Propositie maar visueel hier ook */}
            {show(t, 'risicos', risicoBullets.length > 0) && (
              <View style={{ marginBottom: spacing.lg }} wrap={false}>
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
      )}

      {/* ============================== */}
      {/* LAATSTE PAGINA — Proces & voorwaarden + Contact + Disclaimer */}
      {/* ============================== */}
      {(show(t, 'proces', heeftProces) || heeftContact) && (
        <Page size="A4" style={pageStyles.page}>
          <PageHeader refNummer={object.internReferentienummer} datum={datum} logoUri={BITO_LOGO_URL} />
          <View style={styles.body}>

            {/* 16. PROCES & VOORWAARDEN */}
            {show(t, 'proces', heeftProces) && (
              <View style={{ marginBottom: spacing.lg }}>
                <SectionTitle>Proces en voorwaarden</SectionTitle>
                {paraGraph(object.procesVoorwaarden).map((p, i) => (
                  <Text key={i} style={styles.paragraph}>{p}</Text>
                ))}
              </View>
            )}

            {/* 17. CONTACT */}
            {heeftContact && (
              <View>
                <SectionTitle>Contact</SectionTitle>
                <View style={styles.contactBlok}>
                  <Text style={[typography.labelOnDark, { color: colors.accent }]}>Voor meer informatie</Text>
                  {contactNaam && <Text style={[styles.contactNaam, { marginTop: 6 }]}>{contactNaam}</Text>}
                  {contactFunctie && <Text style={styles.contactRegel}>{contactFunctie}</Text>}
                  {(contactTelefoon || contactEmail) && (
                    <Text style={[styles.contactRegel, { color: colors.white, marginTop: 6 }]}>
                      {[contactTelefoon, contactEmail].filter(Boolean).join('   ·   ')}
                    </Text>
                  )}
                </View>
              </View>
            )}

            {/* 18. DISCLAIMER */}
            <View style={[styles.disclaimerBox, { marginTop: spacing.lg }]}>
              <Text style={[typography.label, { marginBottom: 6 }]}>Disclaimer</Text>
              <Text style={styles.disclaimerText}>
                Dit Investment Memorandum is opgesteld door Bito Vastgoed op basis van door derden verstrekte
                en in eigen beheer verzamelde informatie. Aan de inhoud kunnen geen rechten worden ontleend.
                Bito Vastgoed aanvaardt geen aansprakelijkheid voor onvolledigheid of onjuistheid. Voor
                aankoopadvies en due diligence wordt verwezen naar een formele taxatie en juridisch onderzoek.
                Dit document is vertrouwelijk en uitsluitend bestemd voor de geadresseerde.
              </Text>
            </View>

          </View>
          <PageFooter />
        </Page>
      )}
    </Document>
  );
}
