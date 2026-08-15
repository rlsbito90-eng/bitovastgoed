# TRACK-3/5 — Acquisitie meetlaag

Datum: 15 augustus 2026

## Doel

Bouw één automatische meetlaag boven bestaande acquisitiebronnen, zonder parallelle administratietabel of backfill.

## Bronnen

- `off_market_brief_events` — bestaande append-only communicatie- en responsfeiten;
- `kadaster_kosten_events` — bestaande Kadaster kostenledger;
- `off_market_productie_events` — BR/BAT-productiefeiten.

## Nieuwe readmodellen

### `acquisitie_tracking_events_v1`

Normaliseert de drie bronlogs naar één acquisitie-eventmodel. Gegenereerde/geprinte communicatie telt niet als verzonden; `geen_reactie` telt niet als inbound reactie; hergebruikte Kadasterdata telt niet als nieuwe aanvraag.

### `acquisitie_tracking_kpis_maand_v1`

Maandelijkse activiteit per acquisitiebron: Kadasteraanvragen/-leveringen en kosten, verzonden communicatie, reacties, positieve reacties, retourpost, opvolging, definitieve brieven en geprinte batches.

### `acquisitie_tracking_funnel_cohort_v1`

Conversie wordt op verzendcohort berekend. Een reactie in augustus op een in juli verzonden brief blijft daardoor bij het juli-cohort horen. Dit voorkomt misleidende maandresponspercentages.

## Productiebeveiliging

TRACK-2A heeft uitsluitend least-privilege toegang geactiveerd:

- negen publieke productiekern-RPC's voor `authenticated`;
- nul execute-rechten op interne functies;
- vier productiekern read-policies;
- nul directe write-grants op de vier client-readtabellen;
- geen backfill;
- geen productiekern-datarijen aangemaakt tijdens activatie.

De trackingviews gebruiken `security_invoker = true` en blijven daardoor onderliggende RLS/rechten respecteren.

## Productieproof na installatie

Direct na TRACK-3/5:

- `acquisitie_tracking_events_v1`: 376 bestaande bronfeiten;
- juni 2026: 25 verzonden communicaties;
- juli 2026: 35 verzonden communicaties, 2 reacties, 1 positieve reactie;
- augustus 2026: 2 reacties in de activiteitstijdlijn;
- cohortview toegevoegd zodat late reacties aan de oorspronkelijke verzendmaand worden toegerekend.

Kadasterkosten in de huidige projectie zijn alleen aanwezig wanneer de bestaande kostenledger daarvoor feitelijke rijen bevat; er worden geen tarieven of kosten verzonnen.

## Niet uitgevoerd

- geen betaalde Kadasteractie;
- geen backfill;
- geen automatische briefverzending;
- geen nieuw parallel eventregister;
- geen historische respons herschreven.

## Source-control notitie

De CRM-productiedatabase bevat voorafgaand aan deze PR al zes TRACK-2 release-migratieversies (`20260815145628` t/m `20260815145832`). De inhoudelijke releasebronnen staan als bewezen drafts in de repository, maar de zes toegepaste versiebestanden ontbreken op `main`. Dat historische migratieboekhoudkundige verschil wordt separaat gereconcilieerd, zodat deze TRACK-3/5-PR uitsluitend de nieuw toegepaste activatie- en meetlaagversies bevat.
