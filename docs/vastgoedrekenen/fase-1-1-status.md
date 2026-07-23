# Vastgoedrekenen Fase 1.1 — werkstatus

Featurebranch: `feat/vastgoedrekenen-fase-1-1`
Draft-PR: #2

## Patch A — praktijkfixes gerealiseerd

- Iedere onderliggende invoerwijziging maakt het scenario opslaanbaar (eerder afgerond en in de browser bevestigd).
- Componentontwikkelkosten worden als investering verwerkt en niet langer gesaldeerd met de verkoopopbrengst.
- Componentstrategie voedt de algemene KPI's voor bruto opbrengst, verkoopkosten, netto opbrengst, totale investering, marge en ROI.
- Zonder ingevoerde koopsom wordt geen misleidende marge of ROI getoond.
- Component-GDV geldt als geldige verkoopopbrengstbron in validatie.
- Mogelijke dubbele renovatie-, splitsings- en transformatiekosten worden gericht gesignaleerd.
- Handmatige waarde wordt expliciet als waarderingsaanname en niet als verkooptransactie benoemd.
- Mixed-use OVB en meerdere btw-behandelingen worden expliciet als biedingsrisico getoond.
- Scenario dupliceren kopieert scenario-inputs, componenten, kosten, WWS-units, strategie-units, risico's, exit-aannames en kengetal-snapshots; afgeleide outputs worden opnieuw berekend.
- WWS-statussen zijn geharmoniseerd naar Volledig, Indicatief en Incompleet.
- GBO, VVO en BVO worden afzonderlijk geregistreerd en weergegeven.
- Decimale metrages zoals 76,4 en 562,4 m² blijven zichtbaar.

## Patch B — kengetallenregister gerealiseerd

- Centraal register met minimum, basis en maximum.
- Bron(type), bronreferentie, peildatum, geldig-vanaf en vervaldatum.
- Toepassingsgebied, regio, projectfase en risicoklasse.
- Betrouwbaarheid, actief/archief en oplopende registerversie.
- Expliciete koppeling naar ondersteunde scenariovelden.
- Scenario-snapshot met alle gebruikte bron- en bandbreedtegegevens.
- Registerwijzigingen veranderen bestaande scenario-snapshots nooit automatisch.
- Waarschuwing wanneer een snapshot verlopen is of een nieuwere registerversie bestaat.
- Handmatige afwijking vereist een vastgelegde reden.
- Interne Den Haag-werkhypothese toegevoegd: 15% GDV basis en 20% GDV voorzichtig, expliciet laag betrouwbaar en niet als marktkengetal/RICS-taxatie gepresenteerd.

## Verificatie

- Gerichte regressietests voor reken-KPI's, validatie, duplicatie, decimale metrages en kengetal-snapshots.
- TypeScript-typecheck: geslaagd.
- Volledige Vitest-suite: geslaagd.
- Productiebuild: geslaagd.
- GitHub Actions-verificatie: groen.

## Nog vóór merge/publicatie

- Supabase-migratie in een veilige branch-/previewomgeving toepassen.
- Visuele acceptatietest uitvoeren voor scenario dupliceren, metrages, statussen, registerbeheer en scenario-snapshots.
- Geen productie-deployment of merge zonder afzonderlijke goedkeuring.

## Daarna

- Den Haag opnieuw uitvoeren met 15% en 20% winst op GDV.
- Winst op kosten ernaast gebruiken als controlemaatstaf.
- Pas daarna fasering, kasstromen, financiering, IRR en NCW uitbreiden.
