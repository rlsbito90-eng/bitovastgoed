// src/components/pdf/ObjectOnepagerPDF.tsx
//
// Eén-pagina PDF voor cold outreach. Filosofie:
//   - Lege velden = sectie weg. Geen placeholders, geen "—", geen lege ruimte.
//   - Document past zich aan aan wat is ingevuld.
//   - Vaste volgorde: hero → adres/type → kerncijfers → propositie → highlights →
//     verhuur/onderhoud → vervolgstappen + contact → disclaimer.

import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import {
  colors, spacing, typography, pageStyles,
  formatEuro, formatM2, formatPercent, formatDate,
} from '@/lib/pdf/theme';
import { PageHeader, PageFooter, SectionTitle } from '@/components/pdf/PdfShared';
import { BITO_LOGO_URL } from '@/lib/pdf/logo';
import type { ObjectVastgoed } from '@/data/mock-data';
import { ASSET_CLASS_LABELS, ONDERHOUDSSTAAT_LABELS } from '@/data/mock-data';

const VERHUUR_LABEL: Record<string, string> = {
  verhuurd: 'Verhuurd',
  leeg: 'Leegstand',
  gedeeltelijk: 'Gedeeltelijk verhuurd',
};

interface Props {
  object: ObjectVastgoed;
  hoofdfotoUrl?: string;
  marktwaardeMediaan?: number;
  subcategorieLabel?: string;
}

const styles = StyleSheet.create({
  // === HERO ===
  hero: {
    height: 280,
    position: 'relative',
    overflow: 'hidden',
  },
  heroImage: { width: '100%', height: 280, objectFit: 'cover' },
  heroOverlay: {
    position: 'absolute', inset: 0,
    backgroundColor: 'rgba(7, 36, 56, 0.55)',
  },
  heroNoImage: { position: 'absolute', inset: 0, backgroundColor: colors.primary },
  heroAccentRule: {
    position: 'absolute',
    bottom: 96, left: spacing.page,
    width: 36, height: 2,
    backgroundColor: colors.accent,
  },
  heroLabel: {
    position: 'absolute',
    bottom: 70, left: spacing.page,
    fontFamily: 'Inter', fontSize: 8, fontWeight: 600,
    color: colors.accent, textTransform: 'uppercase', letterSpacing: 2,
  },
  heroTitle: {
    position: 'absolute',
    bottom: spacing.page - 6, left: spacing.page, right: spacing.page,
    fontFamily: 'Playfair Display', fontSize: 28, fontWeight: 700,
    color: colors.white, letterSpacing: -0.6, lineHeight: 1.1,
  },
  heroLocatie: {
    position: 'absolute',
    bottom: 18, left: spacing.page,
    fontFamily: 'Inter', fontSize: 11, color: colors.accentLight, letterSpacing: 0.5,
  },

  // === STATS BAND ===
  statsBand: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderTopWidth: 2, borderTopColor: colors.accent,
    borderBottomWidth: 0.5, borderBottomColor: colors.border,
  },
  statItem: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderRightWidth: 0.5, borderRightColor: colors.borderSubtle,
  },
  statItemLast: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },

  body: {
    paddingHorizontal: spacing.page,
    paddingTop: spacing.lg + 4,
    paddingBottom: 70,
  },
  paragraph: {
    fontFamily: 'Inter', fontSize: 9.5,
    lineHeight: 1.6, color: colors.text,
  },
  bullet: {
    flexDirection: 'row', alignItems: 'flex-start',
    marginBottom: spacing.sm + 1,
  },
  bulletDot: {
    fontFamily: 'Inter', fontSize: 9, color: colors.accent,
    marginRight: 7, lineHeight: 1.6,
  },
  bulletText: {
    fontFamily: 'Inter', fontSize: 9.5, color: colors.text,
    lineHeight: 1.55, flex: 1,
  },

  twoColumn: {
    flexDirection: 'row',
    gap: spacing.section,
  },
  column: { flex: 1 },

  // === CONTACT BLOK (donkerblauw, goud accent) ===
  contactBlok: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg + 2,
    paddingVertical: spacing.lg,
    backgroundColor: colors.primary,
    borderLeftWidth: 2, borderLeftColor: colors.accent,
  },
  contactNaam: {
    fontFamily: 'Inter', fontSize: 11, fontWeight: 600,
    color: colors.white,
  },
  contactRegel: {
    fontFamily: 'Inter', fontSize: 9, color: colors.accentLight, marginTop: 2,
  },

  marktwaardeBlok: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md + 2,
    borderWidth: 1, borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
    marginTop: spacing.md,
  },

  disclaimer: {
    fontFamily: 'Inter', fontSize: 7,
    color: colors.textLight, marginTop: spacing.lg,
    fontStyle: 'italic', lineHeight: 1.5,
  },
});

// Splits multiline tekst in bullets (lege regels eruit)
function splitBullets(s?: string): string[] {
  if (!s) return [];
  return s.split('\n').map(l => l.replace(/^[-•·*]\s*/, '').trim()).filter(Boolean);
}

export default function ObjectOnepagerPDF({
  object, hoofdfotoUrl, marktwaardeMediaan, subcategorieLabel,
}: Props) {
  // === Berekende basisvelden ===
  const locatieDisplay = object.anoniem
    ? (object.publiekeRegio ?? object.provincie ?? '')
    : [object.plaats, object.provincie].filter(Boolean).join(', ');
  const titelDisplay = object.anoniem && object.publiekeNaam
    ? object.publiekeNaam
    : object.titel;

  const m2 = object.oppervlakteVvo ?? object.oppervlakte;
  const huurPerM2 = object.huurPerM2 ?? (
    object.huurinkomsten && m2 ? Math.round(object.huurinkomsten / m2) : null
  );
  const bar = object.brutoAanvangsrendement ?? (
    object.huurinkomsten && object.vraagprijs
      ? (object.huurinkomsten / object.vraagprijs) * 100
      : null
  );

  // === Stats: alleen items mét waarde tonen ===
  type Stat = { label: string; value: string };
  const stats: Stat[] = [];
  if (object.vraagprijs != null) {
    stats.push({ label: 'Vraagprijs', value: formatEuro(object.vraagprijs, true) });
  } else if (object.prijsindicatie) {
    stats.push({ label: 'Vraagprijs', value: object.prijsindicatie });
  }
  if (object.oppervlakte != null) stats.push({ label: 'Oppervlakte', value: formatM2(object.oppervlakte) });
  if (bar != null) stats.push({ label: 'BAR', value: formatPercent(bar) });
  if (object.huurinkomsten != null) stats.push({ label: 'Huur / jr', value: formatEuro(object.huurinkomsten, true) });
  else if (object.bouwjaar) stats.push({ label: 'Bouwjaar', value: String(object.bouwjaar) });

  const propositie = object.propositie?.trim();
  const highlights = splitBullets(object.onderscheidendeKenmerken).concat(splitBullets(object.investeringsthese)).slice(0, 5);

  // Mini "facts" rechts naast highlights — alleen tonen wat er is
  const facts: Stat[] = [];
  if (object.verhuurStatus) facts.push({ label: 'Verhuursituatie', value: VERHUUR_STATUS_LABELS[object.verhuurStatus] ?? String(object.verhuurStatus) });
  if (object.onderhoudsstaatNiveau) facts.push({ label: 'Onderhoudsstaat', value: ONDERHOUDSSTAAT_LABELS[object.onderhoudsstaatNiveau] });
  if (object.eigendomssituatie) facts.push({ label: 'Eigendom', value: object.eigendomssituatie });
  if (object.energielabelV2) facts.push({ label: 'Energielabel', value: object.energielabelV2 });

  // Contact: gebruik object-niveau, anders verkoper, anders niets
  const contactNaam = object.contactNaam?.trim() || object.verkoperNaam?.trim();
  const contactFunctie = object.contactFunctie?.trim() || object.verkoperRol?.trim();
  const contactTelefoon = object.contactTelefoon?.trim() || object.verkoperTelefoon?.trim();
  const contactEmail = object.contactEmail?.trim() || object.verkoperEmail?.trim();
  const heeftContact = !!(contactNaam || contactTelefoon || contactEmail);

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
            </>
          ) : (
            <View style={styles.heroNoImage} />
          )}
          <View style={styles.heroAccentRule} />
          <Text style={styles.heroLabel}>
            {fullAssetLabel}{object.exclusief ? '   ·   Exclusief Aanbod' : ''}
          </Text>
          <Text style={styles.heroTitle}>{titelDisplay}</Text>
          {locatieDisplay && <Text style={styles.heroLocatie}>{locatieDisplay}</Text>}
        </View>

        {/* === STATS BAND (alleen items met data) === */}
        {stats.length > 0 && (
          <View style={styles.statsBand}>
            {stats.map((s, i) => (
              <View key={i} style={i === stats.length - 1 ? styles.statItemLast : styles.statItem}>
                <Text style={typography.label}>{s.label}</Text>
                <Text style={[typography.dataLarge, { marginTop: 4, color: i === 0 ? colors.accent : colors.primary }]}>
                  {s.value}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.body}>
          {/* Propositie / samenvatting */}
          {(propositie || object.samenvatting) && (
            <View style={{ marginBottom: spacing.md }}>
              <SectionTitle>Propositie</SectionTitle>
              <Text style={styles.paragraph}>{propositie || object.samenvatting}</Text>
            </View>
          )}

          {/* Twee-koloms: highlights + facts */}
          {(highlights.length > 0 || facts.length > 0) && (
            <View style={styles.twoColumn}>
              {highlights.length > 0 && (
                <View style={styles.column}>
                  <SectionTitle>Hoogtepunten</SectionTitle>
                  {highlights.map((b, i) => (
                    <View key={i} style={styles.bullet}>
                      <Text style={styles.bulletDot}>▸</Text>
                      <Text style={styles.bulletText}>{b}</Text>
                    </View>
                  ))}
                </View>
              )}
              {facts.length > 0 && (
                <View style={styles.column}>
                  <SectionTitle>Kort overzicht</SectionTitle>
                  {facts.map((f, i) => (
                    <View key={i} style={{
                      flexDirection: 'row', justifyContent: 'space-between',
                      paddingVertical: spacing.sm + 1,
                      borderBottomWidth: i === facts.length - 1 ? 0 : 0.5,
                      borderBottomColor: colors.borderSubtle,
                    }}>
                      <Text style={{ fontFamily: 'Inter', fontSize: 9, color: colors.textMuted }}>{f.label}</Text>
                      <Text style={{ fontFamily: 'Inter', fontSize: 9, fontWeight: 500, color: colors.text }}>{f.value}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Marktwaarde (handmatig of mediaan) */}
          {(object.marktwaardeIndicatie != null || marktwaardeMediaan != null) && (
            <View style={styles.marktwaardeBlok}>
              <Text style={typography.labelAccent}>Indicatieve marktwaarde</Text>
              <Text style={[typography.dataLarge, { marginTop: 3 }]}>
                {formatEuro(object.marktwaardeIndicatie ?? marktwaardeMediaan!)}
              </Text>
              <Text style={{ fontFamily: 'Inter', fontSize: 7.5, color: colors.textMuted, marginTop: 4, fontStyle: 'italic' }}>
                {object.marktwaardeBron?.trim()
                  ? object.marktwaardeBron
                  : 'Mediaanwaarde op basis van vergelijkbare referentieobjecten — geen vervanging voor een formele taxatie.'}
              </Text>
            </View>
          )}

          {/* Vervolgstappen + contact */}
          {heeftContact && (
            <View style={styles.contactBlok}>
              <Text style={[typography.labelOnDark, { color: colors.accent }]}>Interesse?</Text>
              {contactNaam && <Text style={[styles.contactNaam, { marginTop: 6 }]}>{contactNaam}</Text>}
              {contactFunctie && (
                <Text style={[styles.contactRegel, { color: colors.accentLight }]}>{contactFunctie}</Text>
              )}
              {(contactTelefoon || contactEmail) && (
                <Text style={[styles.contactRegel, { marginTop: 4, color: colors.white }]}>
                  {[contactTelefoon, contactEmail].filter(Boolean).join('   ·   ')}
                </Text>
              )}
            </View>
          )}

          {/* Disclaimer */}
          <Text style={styles.disclaimer}>
            Deze samenvatting is opgesteld door Bito Vastgoed op basis van beschikbare informatie en is uitsluitend bedoeld
            ter oriëntatie. Aan de inhoud kunnen geen rechten worden ontleend.
          </Text>
        </View>

        <PageFooter />
      </Page>
    </Document>
  );
}
