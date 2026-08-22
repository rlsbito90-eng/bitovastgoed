# Vastgoed Intelligence — Energie & Planologie

## Doel

Eén gedeelde bronlaag voor Off-Market Radar, Pandenverkennen, Vastgoedkansen en Objecten.

De verrijkingen zijn BAG-gecentreerd. Een energielabel of planologische context hoort bij een BAG-object/locatie en wordt niet per CRM-module opnieuw opgehaald.

## Principes

- BAG is de technische sleutel tussen objectgerichte databronnen.
- Brondata eerst, interpretatie daarna.
- Geen AI nodig om EP-Online of DSO brondata op te halen.
- API-integraties staan standaard uit en fail-closed.
- API-sleutels uitsluitend als Supabase Edge Function secrets; nooit in frontend, databaseconfig of GitHub.
- Kadaster blijft altijd handmatig; energie/planologie mogen nooit een betaalde Kadasteractie triggeren.
- Historische snapshots blijven bewaard zodat bronwijzigingen controleerbaar zijn.

## Energie

Doelbron: publieke EP-Online API.

Voorkeursroute:
1. BAG-verrijking bepaalt geselecteerd verblijfsobject/nummeraanduiding/pand.
2. Energieverrijking zoekt primair op BAG adresseerbaar object / VBO.
3. Adreszoeking is alleen fallback.
4. Resultaat wordt als snapshot opgeslagen in `vastgoed_energielabel_snapshots`.

Beoogde bronvelden:
- energielabel;
- gebouwklasse / gebruiksfunctie;
- energie-index indien beschikbaar;
- primair fossiel energiegebruik indien beschikbaar;
- registratie- en geldigheidsdatum;
- bronreferentie;
- ruwe providerpayload;
- matchkwaliteit.

Afgeleide commerciële interpretatie hoort niet in de brontabel. Later kan een deterministische of AI-laag signalen maken zoals verduurzamingspotentie, capex-risico en value-add indicatie.

## Planologie

Doelbron: DSO / Omgevingswet API's voor omgevingsdocumenten, locaties en regels.

Voorkeursroute:
1. Gebruik BAG-pand/VBO + GEO-coördinaten.
2. Bepaal toepasbare omgevingsdocumenten op de locatie.
3. Haal relevante functies, activiteiten, regels en beperkingen op.
4. Sla brondata als snapshot op in `vastgoed_planologie_snapshots`.

Belangrijk: sinds de Omgevingswet is "bestemmingsplan" te smal. De productlaag heet daarom **Planologische context** en kan zowel omgevingsplan als andere relevante omgevingsdocumenten tonen.

## Productwaarde

De gecombineerde keten wordt:

`Signaal / pand -> BAG -> GEO -> Energie -> Planologie -> commerciële analyse`

Voor value-add analyse kunnen later onder meer worden afgeleid:
- verduurzamingspotentie;
- transformatiepotentie;
- functiewijzigingsrisico;
- gebruiksconflict of afwijkingsbehoefte;
- combinatie splitsing + slechte energieprestatie + planologisch woongebruik;
- waarschijnlijkheid dat renovatie/herpositionering meer waarde creëert dan core-exploitatie.

## Activatie

Fase 1: schema + broncontracten, switches standaard uit.
Fase 2: EP-Online adapter + gecontroleerde één-object smoketest.
Fase 3: DSO adapter + gecontroleerde één-locatie smoketest.
Fase 4: UI-kaarten in Radar/Pandenverkennen.
Fase 5: commerciële value-add analyse en eventuele AI-input.

## Secrets

Voorlopige server-side namen:
- `EP_ONLINE_API_KEY`
- `DSO_API_KEY`

De exacte secretnaam kan worden aangepast aan het officiële authenticatiecontract zodra de adapter wordt gebouwd. Sleutels worden nooit als clientconfig opgeslagen.
