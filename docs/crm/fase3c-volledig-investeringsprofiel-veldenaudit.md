# Fase 3C — volledige dekking investeringsformulier binnen Relaties

**Bron:** succesvolle WordPress/Contact Form 7 proefinzending 8 november 2026 en bestaand schema Relaties; geen nieuwe afzonderlijke Zoekprofielen.

## Audit van alle formuliergegevens

| Websiteveld | Centrale CRM-verwerking |
| --- | --- |
| Naam, e-mail, telefoon, bedrijf | Relaties + primaire Contactpersoon |
| Type partij | Partijprofiel en technische classificatie (alleen expliciet herkend) |
| Vastgoedsegmenten | Propertytypes en asset classes; onbekende websitekeuze houdt auto-create tegen |
| Investeringsstrategie | Geverifieerde strategietaxonomie én letterlijke toelichting |
| Budgetkeuze(n) | **Nieuw:** bewerkbaar veld `budgetVoorkeurToelichting` met letterlijke band(en), naast bestaande `budgetMin/Max` |
| Zoekgebied | Provincies en aparte gemeenten/plaatsen als verifieerbaar; toelichting voor alle andere geografische voorwaarden |
| Objectomvang | Gewenste objectomvang |
| Verhuur- en objectsituatie | Meervoudige gewenste situaties |
| Rendementsdoel / BAR | **Nieuw:** bewerkbaar `rendementsdoelToelichting` met alle originele keuzes, naast harde rendementseis alleen indien expliciet |
| Aankooptermijn | Aankooptermijn |
| Financiering | Financieringsstructuur, financieringsstatus (zelfopgave) |
| Besluitvorming | Besluitvorming |
| Belangrijkste criteria | Aankoopcriteria |
| Uitsluitingen | Uitsluitingen |
| Overige toelichting | Overige toelichting |
| Privacyverklaring | Per originele inzending terug te vinden; niet gelijkstellen aan marketingtoestemming |
| Nieuwsbriefkeuze | Per originele inzending terug te vinden; **niet** een CRM-contact automatisch abonneren |
| Bito-herkomst (bron, medium, campagne, verwijzer, toestemming websitestatistieken, landings-/formulierpagina) | Read-only in de originele inzending op de relatiekaart |

## Gedrag in het CRM

- **Relaties** blijft het centrale bewerkbare profiel. Budget- en rendementkeuzes staan in zowel `RelatieFormDialog` als de inline-beheerkaart; zij beïnvloeden niet onbedoeld de matchlogica.
- De relatiekaart heeft een sectie **Website-investeringsprofiel — originele inzendingen**. Hierin staan alle 28 aangetroffen Contact Form 7-velden in leesbare taal, inclusief bronmetadata en eventueel meerdere inzendingen per relatie. Brongegevens zijn bewust niet bewerkbaar.
- Dezelfde veldlabels worden gebruikt in **Relaties → Website-investeringsprofielen**.
- Bij een bestaande relatie wordt de aangeleverde inzending pas op de relatiekaart zichtbaar zodra deze door de e-mailcontrole aan die relatie voorgesteld of definitief gekoppeld is. Een onbekend of dubbelzinnig contact blijft in de centrale beoordelingsinbox.
- Er worden geen gegevens afgeleid die niet expliciet in het formulier staan, bijvoorbeeld geen automatische radius-geocodering of minimale rendementseis uit rendementsbanden.

## Supabase

Migratie: `20261108215601_relaties_websiteprofiel_volledige_budget_en_rendementskeuzes_fase3c.sql`.

- Toegevoegd: `public.relaties.budget_voorkeur_toelichting text` en `public.relaties.rendementsdoel_toelichting text`.
- Aangepast: bestaande `process_website_investor_intake(uuid)` schrijft voortaan beide letterlijke waarden, ook wanneer meerdere rendementsbanden zijn geselecteerd.
- Historische bronnotities voor de **15 eerder geïmporteerde profielen** gecontroleerd overgezet: 15 budgetantwoorden, 7 expliciet ingevulde rendementsdoelen. Bestaande numerieke budgetten en rendementseisen niet overschreven.
- Beveiligings- en dubbele-contactcontroles van fase 3B blijven ongewijzigd; originele WordPress-inzending blijft in de RLS-afgeschermde intake.
- SQL-transactietest voor combinatie van budget €500k–€1m en rendementsbanden 6–8% en 8–10%: numerieke budgetgrenzen correct, letterlijke bronwaarden correct, harde rendementseis NULL, 1 contactpersoon; daarna ROLLBACK.

## Controlepunten

- CI: TypeScript, unit-tests en volledige productiebuild voordat frontend naar productie gaat.
- Functionele inspectie op mobiele en desktopbreedte blijft relevant, met name voor de uitklapbare brongegevens.
- Historische e-mails/pdf's van 15 relaties zijn deels als vrije brontekst vastgelegd: alleen de exact aangetroffen budget- en rendementsregels zijn naar nieuwe velden gekopieerd. Deze mogen later handmatig worden verfijnd, niet stilzwijgend herinterpreteerd.
