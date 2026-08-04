# Object-ID inventarisatierapport — read-only

## Doel

De vijf afzonderlijke CRM-bronresultaten worden samengevoegd tot één controleerbaar stop/go-rapport vóór iedere muterende Object-ID-backfill.

## Vereiste bronnen

1. Vastgoedkansen
2. Objecten/Aanbod
3. Off-Market-signalen
4. Deals
5. Acquisitietargets

Alle vijf bronnen moeten uniek, afgerond en voorzien van een geldige inventarisatiesamenvatting zijn.

## Rapportage

Het rapport telt onder meer:

- gelezen records en pagina's;
- koppelbare records;
- BAG-identiteit;
- adresfallback;
- Objecten/Aanbod waarvoor BAG-verrijking nodig blijft;
- records voor handmatige beoordeling;
- geblokkeerde en mislukte bronnen.

## Stop/go-poort

`report_ready` betekent uitsluitend dat de read-only inventarisatie technisch volledig is gerapporteerd. Het geeft geen toestemming voor databasewrites, automatische samenvoeging of productieactivatie.

`report_blocked` wordt afgegeven bij een ontbrekende, dubbele, geblokkeerde of mislukte bron, ongeldige tellingen of een ontbrekende samenvatting.

## Veiligheidsgrens

- `readOnly = true`
- `writes = 0`
- `automaticMerges = 0`
- geen Kadastercall
- geen productiequery in deze BUILD
- geen shadowbackfill
