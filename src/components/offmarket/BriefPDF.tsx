// src/components/offmarket/BriefPDF.tsx
//
// Echte PDF-render van de Bito Vastgoed outreach-brief via @react-pdf/renderer.
// Vervangt de eerdere iframe/window.print() flow. Een compacte
// éénpagina A4-brief, zonder browserheaders en zonder about:srcdoc.

import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { BITO_ICON_URL } from '@/lib/pdf/logo';
import type { BriefViewModel } from '@/lib/offMarket/brief';

// Compacte, ingetogen typografie. Bewust géén Playfair (te zwaar voor een brief).
const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 50,
    paddingHorizontal: 56,
    backgroundColor: '#FFFFFF',
    color: '#1A1A1A',
    fontFamily: 'Helvetica',
    fontSize: 10.5,
    lineHeight: 1.4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    marginBottom: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: '#C89C69',
  },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  icon: { width: 42, height: 42, marginRight: 12, objectFit: 'contain' },
  fullLogo: { width: 150, height: 50, objectFit: 'contain' },
  brandTextCol: { flexDirection: 'column' },
  brandName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 14,
    letterSpacing: 1.2,
    color: '#1A1A1A',
  },
  brandTagline: {
    fontSize: 8.5,
    color: '#6B6B6B',
    fontStyle: 'italic',
    marginTop: 2,
    letterSpacing: 0.4,
  },
  taglineUnderLogo: {
    fontSize: 8.5,
    color: '#6B6B6B',
    fontStyle: 'italic',
    marginTop: 4,
    letterSpacing: 0.4,
  },
  datum: { fontSize: 9.5, color: '#1A1A1A' },
  addressee: { marginBottom: 22 },
  addresseeLine: { fontSize: 10.5, lineHeight: 1.4, color: '#1A1A1A' },
  onderwerp: {
    marginBottom: 14,
    fontFamily: 'Helvetica-Bold',
    fontSize: 10.5,
    color: '#1A1A1A',
  },
  paragraph: {
    marginBottom: 8,
    fontSize: 10.5,
    lineHeight: 1.45,
    color: '#1A1A1A',
  },
  signatureParagraph: {
    marginBottom: 7,
    fontSize: 10.2,
    lineHeight: 1.35,
    color: '#1A1A1A',
  },
});

export interface BriefPDFProps {
  vm: BriefViewModel;
  /**
   * Optionele logo-override. Default: icon-only beeldmerk + tekstuele
   * "BITO VASTGOED" lockup. Geef `mode: 'full'` mee om alleen het
   * volledige logo (inclusief bedrijfsnaam) te tonen zonder dubbele tekst.
   */
  logo?:
    | { mode?: 'icon'; url?: string }
    | { mode: 'full'; url: string };
}

export default function BriefPDF({ vm, logo }: BriefPDFProps) {
  const alineas = (vm.brieftekst ?? '')
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean);

  const mode = logo?.mode ?? 'icon';
  const iconSrc = mode === 'icon' ? (logo?.url ?? BITO_ICON_URL) : null;
  const fullSrc = mode === 'full' ? logo!.url : null;

  return (
    <Document title={`Brief — ${vm.contact.bedrijf} — ${vm.onderwerp}`}>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header} fixed>
          <View style={styles.brandRow}>
            {iconSrc ? (
              <>
                <Image src={iconSrc} style={styles.icon} />
                <View style={styles.brandTextCol}>
                  <Text style={styles.brandName}>BITO VASTGOED</Text>
                  <Text style={styles.brandTagline}>Onafhankelijk. Gericht. Discreet.</Text>
                </View>
              </>
            ) : fullSrc ? (
              <View style={styles.brandTextCol}>
                <Image src={fullSrc} style={styles.fullLogo} />
                <Text style={styles.taglineUnderLogo}>Onafhankelijk. Gericht. Discreet.</Text>
              </View>
            ) : (
              <View style={styles.brandTextCol}>
                <Text style={styles.brandName}>BITO VASTGOED</Text>
                <Text style={styles.brandTagline}>Onafhankelijk. Gericht. Discreet.</Text>
              </View>
            )}
          </View>
          <Text style={styles.datum}>{vm.datum}</Text>
        </View>

        <View style={styles.addressee}>
          {vm.bedrijfsnaam ? <Text style={styles.addresseeLine}>{vm.bedrijfsnaam}</Text> : null}
          {vm.geadresseerdeNaam ? <Text style={styles.addresseeLine}>{vm.geadresseerdeNaam}</Text> : null}
          {vm.verzendadresRegels.map((r, i) => (
            <Text key={i} style={styles.addresseeLine}>{r}</Text>
          ))}
        </View>

        <Text style={styles.onderwerp}>Betreft: {vm.onderwerp}</Text>

        {alineas.map((p, i) => (
          <Text key={i} style={p.includes('\n') ? styles.signatureParagraph : styles.paragraph}>{p}</Text>
        ))}
      </Page>
    </Document>
  );
}
