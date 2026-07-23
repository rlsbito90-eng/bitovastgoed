# Vastgoedrekenen Fase 1.1 — werkstatus

Featurebranch: `feat/vastgoedrekenen-fase-1-1`
Draft-PR: #2

## Patch A — gerealiseerd op de branch

- Iedere onderliggende invoerwijziging maakt het scenario opslaanbaar (eerder afgerond en in de browser bevestigd).
- Componentontwikkelkosten worden als investering verwerkt en niet langer gesaldeerd met de verkoopopbrengst.
- Componentstrategie voedt de algemene KPI's voor bruto opbrengst, verkoopkosten, netto opbrengst, totale investering, marge en ROI.
- Zonder ingevoerde koopsom wordt geen misleidende marge of ROI getoond.
- Component-GDV geldt als geldige verkoopopbrengstbron in validatie.
- Mogelijke dubbele renovatie-, splitsings- en transformatiekosten worden gericht gesignaleerd.
- Handmatige waarde wordt expliciet als waarderingsaanname en niet als verkooptransactie benoemd.
- Mixed-use OVB en meerdere btw-behandelingen worden expliciet als biedingsrisico getoond.
- Scenario dupliceren kopieert scenario-inputs, componenten, kosten, WWS-units, strategie-units, risico's en exit-aannames; afgeleide outputs worden opnieuw berekend.
- WWS-statussen zijn geharmoniseerd naar Volledig, Indicatief en Incompleet.
- GBO, VVO en BVO worden afzonderlijk geregistreerd en weergegeven.
- Decimale metrages zoals 76,4 en 562,4 m² blijven zichtbaar.

## Verificatie

- Gerichte regressietests zijn toegevoegd voor reken-KPI's, validatie, duplicatie en decimale metrages.
- De PR bevat een verificatieworkflow voor TypeScript, volledige testsuite en productiebuild.

## Nog open binnen Fase 1.1

- Verificatieworkflow volledig groen krijgen en eventuele regressies herstellen.
- Visuele acceptatietest van de aangepaste scenario- en component-UX.
- Kengetallenregister met minimum/basis/maximum en onveranderlijke scenariosnapshots ontwerpen en bouwen.
- Daarna de Den Haag-proef opnieuw uitvoeren met 15% en 20% winst op GDV en winst op kosten als controlemaatstaf.
