# BAG BUILD 2A.11 — selectie- en CRM-preflight

## Uitkomst

BUILD 2A.11 voegt lokale selectie toe aan de begrensde 2A.10-lijst. Selectie
veroorzaakt geen databasewrite. Een gebruiker moet afzonderlijk op
`Controleer selectie` klikken voordat de UI een kandidaat technisch gereed noemt.

## Fail-closed controles

De preflight blokkeert afzonderlijk:

- een BAG-pand-ID dat al voorkomt in Vastgoedkansen of Objecten;
- een genormaliseerde adres/postcodecombinatie die al in het CRM voorkomt;
- een rij waarvoor de bron geen volledig adres leverde en alleen de BAG-ID als
  visuele fallback wordt getoond;
- een selectie groter dan 250 panden.

Bekende of onvolledige panden blijven zichtbaar met hun blokkadereden, maar de
checkbox is uitgeschakeld. `Selecteer zichtbaar` is begrensd en voegt alleen
niet-geblokkeerde panden toe. Iedere wijziging aan selectie of geladen pagina's
maakt een eerder preflightresultaat ongeldig.

## Nog buiten scope

- geen `addKans`-aanroep;
- geen insert/update in Supabase;
- geen automatische promotie;
- geen eigenaar- of Kadasteractie;
- geen kaart.

BUILD 2A.12 mag uitsluitend een expliciete handmatige bevestigingsstap toevoegen
voor kandidaten uit een volledig groene preflight.
