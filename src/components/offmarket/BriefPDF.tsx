// src/components/offmarket/BriefPDF.tsx
//
// Echte PDF-render van de Bito Vastgoed outreach-brief via @react-pdf/renderer.
// Vervangt de eerdere iframe/window.print() flow. Een compacte
// éénpagina A4-brief, zonder browserheaders en zonder about:srcdoc.

import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { BITO_LOGO_URL } from '@/lib/pdf/logo';
import type { BriefViewModel } from '@/lib/offMarket/brief';

// Compacte, ingetogen typografie. Bewust géén Playfair (te zwaar voor een brief).
const styles = StyleSheet.create({
  page: {
    paddingTop: 48,    // ~17mm
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
  // ~30mm visueel breed op A4 (1mm ≈ 2.835pt) → 85pt
  logo: { width: 85, height: 85, marginRight: 14, objectFit: 'contain' },
  brandTextFallback: { flexDirection: 'column' },
  brandName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 16,
    letterSpacing: 1.2,
    color: '#1A1A1A',
  },
  brandTagline: {
    fontSize: 8.5,
    color: '#6B6B6B',
    fontStyle: 'italic',
    marginTop: 3,
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
  /** Logo URL — defaultet naar de gebundelde Bito asset. */
  logoUrl?: string;
}

export default function BriefPDF({ vm, logoUrl }: BriefPDFProps) {
  // Splits de brieftekst in alinea's (op lege regels) zodat react-pdf
  // alinea-afstand normaal toepast en de tekst niet over één gigantisch
  // tekstblok hoeft te renderen.
  const alineas = (vm.brieftekst ?? '')
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean);

  const src = logoUrl ?? BITO_LOGO_URL;

  return (
    <Document title={`Brief — ${vm.contact.bedrijf} — ${vm.onderwerp}`}>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header} fixed>
          <View style={styles.brandRow}>
            {src ? <Image src={src} style={styles.logo} /> : null}
            <View>
              <Text style={styles.brandName}>BITO VASTGOED</Text>
              <Text style={styles.brandTagline}>Onafhankelijk. Gericht. Discreet.</Text>
            </View>
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
