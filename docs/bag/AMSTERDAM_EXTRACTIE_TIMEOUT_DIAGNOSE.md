# Amsterdam BAG-extractie — timeoutdiagnose en reparatie

## Vastgestelde uitkomst van run 30899205626

- de officiële landelijke BAG-bron is succesvol gedownload;
- bronbestand: 3.610.187.048 bytes;
- SHA-256: `fe2c5b7d7a264dd74ca7bfee72e7edd07d43dd99a90a34c8317e21ab6d79335c`;
- de workflowjob is na de ingestelde jobgrens van 240 minuten geannuleerd;
- de extractiestap is niet afgerond;
- validatie en capaciteitsrapportage zijn niet uitgevoerd;
- er is geen Supabase- of database-write uitgevoerd;
- Amsterdam is niet geïmporteerd, gepubliceerd of geactiveerd.

Het bewijsartifact bevat uitsluitend de vóór de extractie geschreven bronchecksum en bestandsgrootte. Er bestaat daarom geen geldig Amsterdam-extractie- of validatieresultaat uit deze run.

## Oorzaak in de oude implementatie

De oude extractor voerde maximaal vijf volledige closurepasses uit en daarna nog een volledige outputscan. Iedere pass:

1. opende opnieuw de landelijke ZIP;
2. kopieerde alle geneste ZIP-bestanden opnieuw naar tijdelijke bestanden;
3. parseerde opnieuw alle landelijke XML-records.

Daarmee kon dezelfde landelijke bron tot zes keer XML-inhoudelijk worden verwerkt. Voor een bron van circa 3,61 GB overschreed dit de workflowgrens.

## Reparatie

De nieuwe extractor gebruikt:

1. één volledige bronscan om een compacte metadata-index te bouwen;
2. relatieclosure over die lokale index, zonder de landelijke XML opnieuw te parseren;
3. één volledige bronscan om uitsluitend de geselecteerde Amsterdam-records te schrijven.

Aanvullend:

- geneste ZIP-bestanden worden chunked en nooit volledig in RAM geladen;
- iedere 50.000 records verschijnt een heartbeat/progressregel;
- de strategie en werkelijke doorlooptijd worden in het extractierapport vastgelegd;
- de extractiestap heeft een eigen grens van 300 minuten;
- bij overschrijding wordt een compact `amsterdam-extractie-timeout.json` gepubliceerd;
- de gehele job houdt 30 minuten over voor cleanup en artifactpublicatie.

## Veiligheidsgrenzen

- geen Supabase-toegang;
- geen productie-CRM-toegang;
- geen database-write;
- geen betaalde databron;
- geen import totdat extractie én validatie aantoonbaar groen zijn;
- de oude geannuleerde run geldt niet als bronacceptatie.
