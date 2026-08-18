import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

import type { BatchControlelijst } from '@/lib/offMarket/acquisitie/batchControlelijst';
import type { BatchVoorbladModel } from '@/lib/offMarket/acquisitie/batchVoorblad';
import { BITO_LOGO_URL } from '@/lib/pdf/logo';

const styles = StyleSheet.create({
  pagina: { padding: 36, fontSize: 10, fontFamily: 'Helvetica' },
  logo: { width: 142, height: 46, objectFit: 'contain', marginBottom: 16 },
  titel: { fontSize: 18, marginBottom: 18 },
  subtitel: { fontSize: 11, marginBottom: 6 },
  regel: { marginBottom: 5 },
  waarschuwing: { marginTop: 4, marginBottom: 4 },
  tabelKop: { flexDirection: 'row', borderBottomWidth: 1, paddingBottom: 5, marginTop: 12 },
  tabelRij: { flexDirection: 'row', borderBottomWidth: 0.5, paddingTop: 5, paddingBottom: 5 },
  nr: { width: '7%' },
  brief: { width: '24%' },
  geadresseerde: { width: '31%' },
  plaats: { width: '20%' },
  check: { width: '9%', textAlign: 'center' },
});

function formeleBatchStatus(model: BatchVoorbladModel): string {
  if (model.gereedVoorPrint && (model.status === 'concept' || model.status === 'documenten_gegenereerd')) {
    return 'Printgereed';
  }
  switch (model.status) {
    case 'documenten_gegenereerd': return 'Productiebestanden gereed';
    case 'geprint': return 'Geprint';
    case 'gedeeltelijk_gepost': return 'Gedeeltelijk gepost';
    case 'gepost': return 'Gepost';
    case 'geannuleerd': return 'Geannuleerd';
    case 'concept': return 'Voorbereiding';
  }
}

export function ProductiekernBatchVoorbladPDF({ model }: { model: BatchVoorbladModel }) {
  return (
    <Document title={`Bito Vastgoed — batch ${model.batchnummer}`}>
      <Page size="A4" style={styles.pagina}>
        <Image src={BITO_LOGO_URL} style={styles.logo} />
        <Text style={styles.titel}>Bito Vastgoed — Printbatch</Text>
        <Text style={styles.subtitel}>Batch {model.batchnummer}</Text>
        <Text style={styles.regel}>Documentversie: {model.documentversie}</Text>
        <Text style={styles.regel}>Status: {formeleBatchStatus(model)}</Text>
        <Text style={styles.regel}>Aantal brieven: {model.briefAantal}</Text>
        <Text style={styles.regel}>Niet geverifieerde adressen: {model.nietGeverifieerdeAdressen}</Text>
        <Text style={styles.regel}>Ontbrekende brief-PDF's: {model.ontbrekendePdfs}</Text>
        <Text style={styles.regel}>Printgereed: {model.gereedVoorPrint ? 'JA' : 'NEE'}</Text>
        {model.waarschuwingen.length > 0 && (
          <View>
            <Text style={styles.subtitel}>Waarschuwingen</Text>
            {model.waarschuwingen.map((waarschuwing) => (
              <Text key={waarschuwing} style={styles.waarschuwing}>• {waarschuwing}</Text>
            ))}
          </View>
        )}
      </Page>
    </Document>
  );
}

export function ProductiekernBatchControlelijstPDF({ lijst }: { lijst: BatchControlelijst }) {
  return (
    <Document title={`Bito Vastgoed — controlelijst ${lijst.batchnummer}`}>
      <Page size="A4" style={styles.pagina} wrap>
        <Image src={BITO_LOGO_URL} style={styles.logo} fixed />
        <Text style={styles.titel}>Controlelijst printbatch</Text>
        <Text style={styles.regel}>Batch: {lijst.batchnummer}</Text>
        <Text style={styles.regel}>Documentversie: {lijst.documentversie}</Text>
        <Text style={styles.regel}>Totaal: {lijst.totaal}</Text>
        <Text style={styles.regel}>Adres niet geverifieerd: {lijst.nietGeverifieerd}</Text>
        <Text style={styles.regel}>PDF ontbreekt: {lijst.pdfOntbreekt}</Text>

        <View style={styles.tabelKop} fixed>
          <Text style={styles.nr}>#</Text>
          <Text style={styles.brief}>Briefnummer</Text>
          <Text style={styles.geadresseerde}>Geadresseerde</Text>
          <Text style={styles.plaats}>Plaats</Text>
          <Text style={styles.check}>Adres</Text>
          <Text style={styles.check}>PDF</Text>
        </View>
        {lijst.rijen.map((rij) => (
          <View key={rij.briefVersieId} style={styles.tabelRij} wrap={false}>
            <Text style={styles.nr}>{rij.volgnummer}</Text>
            <Text style={styles.brief}>{rij.briefnummer}</Text>
            <Text style={styles.geadresseerde}>{rij.geadresseerde || '—'}</Text>
            <Text style={styles.plaats}>{rij.plaats}</Text>
            <Text style={styles.check}>{rij.adresGeverifieerd ? 'OK' : '—'}</Text>
            <Text style={styles.check}>{rij.pdfBeschikbaar ? 'OK' : '—'}</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}
