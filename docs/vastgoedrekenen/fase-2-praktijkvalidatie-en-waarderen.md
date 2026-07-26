# Vastgoedrekenen — Fase 2: praktijkvalidatie en waarderen

## Doel

Vastgoedrekenen moet voor uiteenlopende echte proposities een controleerbare aankoopwaarde, maximale koopsom of bandbreedte opleveren. De uitkomst moet verdedigbaar zijn tegenover koper, verkoper, makelaar, taxateur, ontwikkelaar, financier en toekomstige samenwerkingspartner.

De module belooft geen taxatie. Zij maakt zichtbaar:

- welke waarderings- en rendementsmethoden zijn gebruikt;
- welke bedragen uit projectspecifieke bronnen komen;
- welke bedragen uit het kengetallenregister komen;
- welke aannames handmatig zijn ingevoerd;
- welke onzekerheden de uitkomst bepalen;
- bij welke koopsom het scenario nog wel of niet rond te rekenen is.

## Hoofdarchitectuur

Eén gestandaardiseerde rekenkern ondersteunt meerdere propositie-archetypen. Een archetype bepaalt de relevante invoer, controles, waarderingssporen en rapportage, maar krijgt niet automatisch een losstaand rekenmodel.

```text
Object / propositie
├── Verkrijgingsstructuur
│   └── Fiscale verkrijgingsdelen en OVB
├── Huidige situatie
│   └── Gebruik, verhuur, leegstand en exploitatie
├── Componentenstrategie
│   └── Behouden, renoveren, transformeren, slopen, nieuwbouw, optoppen, verkopen
├── Kosten en fasering
├── Opbrengsten en waardering
├── Financiering en partnership (latere laag)
└── Uitkomst, gevoeligheid, risico en bronnen
```

## Propositie-archetypen

De module moet ten minste de volgende archetypen kunnen ondersteunen:

1. verhuurde woning of commercieel beleggingsobject;
2. leegstaand woning- of commercieel object;
3. renoveren en doorverkopen;
4. uitponden;
5. transformatie;
6. sloop-nieuwbouw;
7. optoppen / uitbreiden;
8. mixed-use;
9. meerdere objecten of portefeuille;
10. hotelvastgoed verhuurd aan een exploitant;
11. hotelvastgoed inclusief exploitatie;
12. grond- of ontwikkelpositie.

### Terminologie hotel

In de Nederlandse UI, rapportages en uitleg wordt consequent **exploitant** gebruikt. `Operator` is geen primaire gebruikersbenaming.

Er blijft een inhoudelijk onderscheid tussen:

- hotelvastgoed verhuurd aan een exploitant;
- hotelvastgoed inclusief exploitatie;
- eigen exploitatie;
- managementovereenkomst met een exploitant;
- huurovereenkomst met een exploitant;
- wisseling of aantrekken van een nieuwe exploitant.

## Waarderingssporen

Afhankelijk van archetype en strategie kunnen een of meer sporen actief zijn:

- huurwaardekapitalisatie: BAR / NAR;
- DCF / kasstromen;
- verkoopwaarde na renovatie;
- componentstrategie;
- residuele object- of grondwaarde;
- uitpondwaarde;
- hotelvastgoed op huur;
- hotelexploitatie op genormaliseerde kasstroom;
- scenario-exit;
- referentie- of vergelijkingswaarde als onderbouwing, niet als automatische taxatie.

De module toont expliciet welk spoor leidend is en welke sporen alleen als controlemaatstaf worden gebruikt.

## Praktijkvalidatie Den Haag

De propositie zonder vraagprijs in Den Haag is de eerste volledige praktijkproef voor residueel waarderen.

### Vereiste werkstroom

1. huidige situatie en verkrijgingsstructuur controleren;
2. huidig en toekomstig programma per component vastleggen;
3. bruto en netto opbrengsten onderbouwen;
4. ontwikkel-, transactie-, advies-, financierings- en verkoopkosten onderbouwen;
5. vereiste winst op GDV en winst op kosten afzonderlijk beoordelen;
6. residuele maximale koopsom berekenen;
7. conservatief, realistisch en optimistisch scenario doorrekenen;
8. gevoeligheid op de belangrijkste opbrengsten en kosten uitvoeren;
9. onzekerheden, ontbrekende bronnen en kritieke afhankelijkheden benoemen;
10. een biedings- of gespreksrange formuleren.

### Gewenste uitkomst

De uitkomst bestaat niet alleen uit één bedrag, maar minimaal uit:

- indicatieve aankooprange;
- realistische rekenwaarde;
- maximale robuuste koopsom;
- grens waarboven het project onvoldoende robuust wordt;
- winst op GDV;
- winst op kosten;
- grootste positieve en negatieve waardedrijvers;
- betrouwbaarheid en status van de belangrijkste aannames;
- expliciete melding dat de uitkomst geen taxatie is.

## Renoveren en doorverkopen

Dit is een afzonderlijke hoofdstrategie en niet hetzelfde als uitponden.

```text
Aankoop woning
→ renovatie
→ verkoop aan particuliere eindkoper
```

Minimale invoer:

- koopsom, OVB en aankoopkosten;
- leeg, verhuurd of gedeeltelijk verhuurd;
- renovatiebegroting per kostencategorie;
- onvoorzien;
- renovatie- en verkoopduur;
- financierings- en holdingkosten;
- verwachte verkoopwaarde na renovatie;
- verkoopkosten.

Minimale uitkomsten:

- totale investering;
- netto verkoopopbrengst;
- nettowinst;
- winst op kosten;
- winst op verkoopwaarde / GDV;
- break-evenverkoopprijs;
- maximale aankoopprijs;
- gevoeligheid voor verkoopwaarde, bouwkosten en looptijd.

Wanneer een verhuurde woning na leegkomst wordt gerenoveerd en verkocht, kunnen uitponden/leegkomrisico en renovatie-doorverkoop gecombineerd worden.

## Optoppen / uitbreiden

Optoppen wordt gemodelleerd als strategie binnen een bestaand object:

```text
Bestaand gebouw behouden
+
nieuw volume / nieuwe units toevoegen
```

Specifieke invoer en controles:

- bestaand gebruik en bestaande waarde;
- toe te voegen BVO, GBO en verkoopbaar/verhuurbaar oppervlak;
- constructieve versterking en fundering;
- ontsluiting, lift, trappenhuis en installaties;
- huurderving, overlast en compensatie;
- vergunning en planologische procedure;
- bouwplaatslogistiek;
- bouwkosten optopping;
- verkoop- of verhuurwaarde van nieuwe units;
- waarde-effect op bestaand vastgoed;
- VvE-, erfpacht- en eigendomsbeperkingen;
- ontwikkelrecht of residuele waarde van het optoprecht.

## Hotelproposities

### Hotelvastgoed verhuurd aan een exploitant

Dit spoor lijkt op commerciële belegging en vraagt onder meer:

- huur en huursystematiek;
- indexatie;
- resterende huurtermijn;
- kredietwaardigheid van de exploitant;
- onderhouds- en capexverdeling;
- eventuele omzetgerelateerde huur;
- rendementseis en exit yield.

### Hotelvastgoed inclusief exploitatie

Aanvullende operationele invoer:

- aantal kamers en beschikbare kamernachten;
- bezettingsgraad;
- ADR;
- RevPAR;
- kameromzet;
- F&B- en overige omzet;
- personeels-, energie- en overige exploitatiekosten;
- management-, franchise- en reserveringskosten;
- GOP en genormaliseerd exploitatiekasresultaat;
- FF&E-reserve;
- renovatie en herpositionering;
- stabilisatieperiode;
- exit yield of multiple.

De uitkomst scheidt waar mogelijk:

1. vastgoedwaarde;
2. inventaris / FF&E;
3. exploitatie;
4. goodwill;
5. toekomstige capexverplichtingen.

## Kengetallenregister

Waar zaken gestandaardiseerd kunnen worden, worden zij niet uit het hoofd ingevoerd maar vanuit een centraal register voorgesteld.

Per kengetal worden minimaal vastgelegd:

- naam en categorie;
- eenheid;
- minimum, basis en maximum;
- assettype en strategie;
- regio en toepassingsgebied;
- projectfase en risicoklasse;
- bron en bronreferentie;
- peildatum;
- geldig vanaf en vervaldatum;
- betrouwbaarheid;
- registerversie;
- verantwoordelijke en laatste controle;
- toelichting en uitzonderingen.

Een scenario bewaart een onveranderlijke snapshot van de daadwerkelijk gebruikte registerwaarden. Latere registerwijzigingen veranderen bestaande berekeningen niet stilzwijgend.

### Indicatieve reviewcycli

| Gegeven | Controlefrequentie |
|---|---|
| Belastingen en wettelijke tarieven | jaarlijks en bij wetswijziging |
| Financieringsrente | maandelijks of per kwartaal |
| Bouwkosten | per kwartaal |
| Huren en verkoopprijzen | per kwartaal en projectspecifiek |
| Aanvangsrendementen | per kwartaal |
| Hotel ADR, bezetting en RevPAR | maandelijks of per kwartaal |
| Advies- en transactiekosten | jaarlijks |
| Interne risico-opslagen | halfjaarlijks |
| Projectspecifieke offertes | bij iedere nieuwe offerte |

Statussen:

- Actueel;
- Binnenkort controleren;
- Verlopen;
- Projectspecifieke bron nodig.

## Eigen aankopen en partnerships

De rekenkern moet later ook eigen acquisities met partners ondersteunen.

### Financieringslaag

- LTV en LTC;
- rente, afsluitkosten en aflossing;
- bouwdepot;
- eigen vermogen;
- rente tijdens ontwikkeling;
- DSCR;
- herfinanciering;
- liquiditeitsbehoefte per periode;
- buffers, garanties en zekerheden.

### Partnershiplaag

- inleg per partner;
- eigendomspercentage;
- dealinbreng en projectmanagement;
- acquisitie- en ontwikkelfee;
- preferred return;
- winstverdeling / promote / carry;
- verliesverdeling;
- aanvullende kapitaalstortingen;
- garanties;
- resultaat en rendement per partner.

Deze lagen volgen pas nadat statische residuele waardering, fasering en kasstromen betrouwbaar zijn.

## Implementatievolgorde

### Fase 2A — praktijkvalidatie en residuele uitkomst

- bestaande residuele engine volledig doorlopen met Den Haag;
- leidende opbrengst- en kostenposten verklaren;
- winst op GDV en winst op kosten naast elkaar tonen;
- bandbreedte en robuustheidsgrens vastleggen;
- ontbrekende velden of rekenfouten uitsluitend op basis van de praktijkproef aanpassen.

### Fase 2B — archetypen en strategiegestuurde UX

- archetype als expliciete scenariokeuze introduceren;
- relevante secties en controles per archetype bepalen;
- `renoveren en doorverkopen` als afzonderlijke strategie;
- optoppen als uitbreidingsstrategie;
- eenvoudige proposities niet belasten met irrelevante ontwikkelvelden.

### Fase 2C — hotelbasis

- onderscheid verhuurd hotelvastgoed versus inclusief exploitatie;
- Nederlandse terminologie met `exploitant`;
- basis hotel-KPI’s en genormaliseerde exploitatie;
- scheiding vastgoed, FF&E, exploitatie en goodwill.

### Fase 2D — tijd, financiering en rendement

- fasering;
- periodieke kasstromen;
- financiering;
- IRR en NCW;
- liquiditeitsbehoefte en buffers.

### Fase 2E — partnerships

- kapitaalinleg;
- preferred return;
- winstwaterfall;
- rendement per partner;
- scenariovergelijking voor structuren.

## Acceptatienorm

Fase 2 is inhoudelijk geslaagd wanneer meerdere echte proposities aantoonbaar en reproduceerbaar kunnen worden doorgerekend, waaronder minimaal:

- één woningrenovatie en doorverkoop;
- één verhuurd beleggingsobject;
- één mixed-use transformatie;
- één optoppropositie;
- één hotelpropositie;
- één kleine portefeuille of meerdere objecten.

Voor ieder geval moet de module:

- een controleerbare aankoopwaarde of bandbreedte geven;
- de leidende methode tonen;
- bron en peildatum van kritieke aannames tonen;
- onzekerheden en gevoeligheden tonen;
- geen schijnzekerheid of impliciete taxatie suggereren;
- reproduceerbaar blijven na wijzigingen in het kengetallenregister.

## Scopebeheersing

- `main` blijft onaangeraakt totdat afzonderlijk tot merge wordt besloten;
- bestaande berekeningen en migraties blijven behouden;
- geen marktkengetal wordt zonder bron als algemene waarheid toegevoegd;
- Kadasterhandelingen blijven handmatig;
- nieuwe formules worden eerst met tests en minimaal één echte propositie gevalideerd;
- hotel, financiering en partnerships worden niet in één grote wijziging tegelijk gebouwd.
