// V3 — PDF voor adreslabels (Brother QL-710W, 90 × 29 mm liggend).
// Eén label per pagina, exact 3 mm veilige marge, links uitgelijnd.
// Geen Avery-grid, A4-vel of meerdere labels per pagina.

import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import {
  LABEL_BREEDTE_PT, LABEL_HOOGTE_PT, VEILIGE_MARGE_PT,
  type AdresLabel,
} from '@/lib/offMarket/acquisitie/adreslabel';

const styles = StyleSheet.create({
  page: {
    width: LABEL_BREEDTE_PT,
    height: LABEL_HOOGTE_PT,
    paddingTop: VEILIGE_MARGE_PT,
    paddingBottom: VEILIGE_MARGE_PT,
    paddingLeft: VEILIGE_MARGE_PT,
    paddingRight: VEILIGE_MARGE_PT,
    backgroundColor: '#FFFFFF',
    color: '#1A1A1A',
    fontFamily: 'Helvetica',
  },
  blok: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    width: '100%',
  },
  naam: { marginBottom: 4 },
  adres: { marginTop: 4 },
});

export interface GecombineerdeAdreslabelsPDFProps {
  labels: AdresLabel[];
  title?: string;
}

export default function GecombineerdeAdreslabelsPDF({
  labels, title,
}: GecombineerdeAdreslabelsPDFProps) {
  return (
    <Document title={title ?? 'Bito Vastgoed — adreslabels'}>
      {labels.map((label) => {
        const fontSize = label.fontPt;
        const lineHeight = 1.2;
        // Persoon: regel 0 = naam, daarna lege ruimte, dan straat + plaats.
        // Bedrijf: regel 0 = bedrijfsnaam, regel 1 = "T.a.v. de directie",
        // daarna ruimte, dan straat + plaats.
        const nameLines = label.variant === 'persoon'
          ? label.regels.slice(0, 1)
          : label.regels.slice(0, 2);
        const addressLines = label.regels.slice(nameLines.length);
        return (
          <Page
            key={label.bron.briefId}
            // Liggend label: 90 mm breed × 29 mm hoog. We geven de
            // eind-dimensies door en laten `orientation` ongezet, zodat
            // react-pdf niet automatisch breedte/hoogte omwisselt.
            size={{ width: LABEL_BREEDTE_PT, height: LABEL_HOOGTE_PT }}
            style={styles.page}
          >
            <View style={styles.blok}>
              <View style={styles.naam}>
                {nameLines.map((r, i) => (
                  <Text key={`n-${i}`} style={{ fontSize, lineHeight }}>
                    {r}
                  </Text>
                ))}
              </View>
              <View style={styles.adres}>
                {addressLines.map((r, i) => (
                  <Text key={`a-${i}`} style={{ fontSize, lineHeight }}>
                    {r}
                  </Text>
                ))}
              </View>
            </View>
          </Page>
        );
      })}
    </Document>
  );
}
