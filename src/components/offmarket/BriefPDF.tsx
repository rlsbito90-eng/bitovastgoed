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
    paddingTop: 56,    // ~20mm
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
    paddingBottom: 10,
    marginBottom: 22,
    borderBottomWidth: 0.5,
    borderBottomColor: '#C89C69',
  },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 36, height: 36, marginRight: 12 },
  brandName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 12,
    letterSpacing: 2,
    color: '#1A1A1A',
  },
  brandTagline: {
    fontSize: 8,
    color: '#6B6B6B',
    fontStyle: 'italic',
    marginTop: 2,
    letterSpacing: 0.3,
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
  footerRule: {
    position: 'absolute',
    left: 56, right: 56, bottom: 28,
    borderTopWidth: 0.5,
    borderTopColor: '#E7D9C2',
    paddingTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: { fontSize: 7.5, color: '#8A8A8A', letterSpacing: 0.4 },
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
    .map(p => p.replace(/\n/g, ' ').trim())
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
          <Text key={i} style={styles.paragraph}>{p}</Text>
        ))}

        <View style={styles.footerRule} fixed>
          <Text style={styles.footerText}>{vm.contact.bedrijf}</Text>
          <Text style={styles.footerText}>{vm.contact.website}</Text>
        </View>
      </Page>
    </Document>
  );
}
