# Vastgoedrekenen — UX-audit augustus 2026

## Doel

Deze audit beoordeelt de volledige gebruikersreis van Vastgoedrekenen. De audit wijzigt geen financiële rekenlogica, database, Supabase-schema, snapshots, auditdata of Kadaster-processen.

## Hoofdconclusie

De module bevat veel professionele functionaliteit, maar de gebruiker moet nog te vaak zelf afleiden:

- wat de volgende stap is;
- welke invoer werkelijk wordt gebruikt;
- welke invoer ontbreekt;
- welke waarde uit objectdata, een kengetal, een default of handmatige invoer komt;
- waarom een onderdeel niet leidend of niet relevant is;
- of een scenario inhoudelijk compleet genoeg is om te vergelijken of als biedingsgrens te gebruiken.

De verbetering moet daarom niet bestaan uit meer kaarten of meer uitleg, maar uit een consequente taakstructuur, duidelijke statussen en progressieve ontsluiting.

## UX-principes

1. **Werktaak vóór datastructuur** — groepeer op wat de gebruiker probeert te doen, niet op technische opslagvelden.
2. **Eén primaire actie per werkblad** — voorkom concurrerende knoppen en onduidelijke opslaacties.
3. **Relevantie, volledigheid en betrouwbaarheid afzonderlijk tonen** — deze begrippen mogen niet in één statuslabel worden samengevoegd.
4. **Volledige breedte voor inhoud** — navigatie mag geen permanente lege stroken veroorzaken.
5. **Progressieve ontsluiting** — toon eerst kernvelden en aandachtspunten; details blijven beschikbaar.
6. **Geen stille defaults** — defaults en kengetallen moeten herkenbaar zijn als bron, niet als gewone handmatige invoer.
7. **Vergelijk alleen vergelijkbare scenario’s** — afwijkende doelwinstgrondslagen en incomplete scenario’s moeten expliciet worden gemarkeerd.

## Gebruikersreis en bevindingen

### 1. Analyse aanmaken en selecteren

**Sterk**
- Analyses zijn nu horizontaal selecteerbaar.
- Nieuwe analyse is direct bereikbaar.

**Verbeterpunten**
- Het verschil tussen analyse, quickscan, case en scenario is terminologisch nog niet overal helder.
- Een gebruiker ziet niet direct welke analyse het meest recent is gewijzigd of welke nog aandacht nodig heeft.
- De weergavemodi Begeleid, Compact en Expert zijn beschikbaar, maar hun effect en doelgroep zijn niet vooraf duidelijk.

**Aanbevolen**
- Kies één primaire term: `Analyse` of `Case`; gebruik `Quickscan` alleen als propositietype/fase.
- Toon per analyse: status, aantal scenario’s, laatst gewijzigd en aandachtstelling.
- Geef bij de weergavemodus één regel uitleg.

### 2. Overzicht en case-uitgangspunten

**Sterk**
- De hoofdwerkbladen bieden een herkenbare structuur.
- Objectstructuur en propositie zijn zichtbaar.

**Verbeterpunten**
- Overzicht toont vooral metadata en nog weinig beslisinformatie.
- De gebruiker krijgt niet direct te zien welke basisinformatie ontbreekt voordat scenario’s betrouwbaar kunnen worden doorgerekend.

**Aanbevolen**
- Maak het overzicht een beslis- en voortgangspagina met:
  - casevolledigheid;
  - ontbrekende objectdata;
  - actieve scenario’s en hun status;
  - belangrijkste uitkomst per scenario;
  - eerstvolgende aanbevolen actie.

### 3. Scenario aanmaken, wisselen en dupliceren

**Sterk**
- De horizontale scenariokeuze gebruikt de schermbreedte beter.
- Dupliceren is direct beschikbaar.

**Verbeterpunten**
- Scenariokaarten tonen nog niet of het scenario compleet, vergelijkbaar of verouderd is.
- Een nieuw scenario start mogelijk met impliciete defaults zonder dat de gebruiker die als zodanig herkent.

**Aanbevolen**
- Toon op elke scenariokaart: compleetheidsstatus, laatste wijziging en primaire uitkomst.
- Geef na dupliceren aan welke gegevens zijn gekopieerd: scenario-invoer, componenten en snapshots.

### 4. Opzet en classificatie

**Sterk**
- Businesscase, fysieke ingreep, exploitatie en exit worden afzonderlijk vastgelegd.
- Compatibiliteit met de bestaande rekenkern is zichtbaar.

**Verbeterpunten**
- De relatie tussen classificatie en actieve rekenvelden is nog abstract.
- De melding `Nieuwe rekenadapter nodig` is technisch en niet handelingsgericht.

**Aanbevolen**
- Vertaal technische compatibiliteit naar gebruikersimpact: `Deze combinatie wordt nog niet volledig doorgerekend`.
- Toon concreet welke rekenonderdelen hierdoor niet beschikbaar of niet leidend zijn.

### 5. Kengetallen en aannames

**Sterk**
- Marktwaardering, invoerprofiel en register zijn nu gescheiden.
- Snapshots leggen bron, peildatum en versie vast.

**Verbeterpunten**
- Het is niet altijd direct zichtbaar welke kengetallen werkelijk naar scenariovelden schrijven.
- Veel niet-passende registerwaarden blijven zichtbaar en verhogen cognitieve belasting.
- De gebruiker moet het verschil tussen profiel, voorstel, snapshot en scenarioveld zelf reconstrueren.

**Aanbevolen**
- Toon standaard alleen toepasselijke kengetallen; plaats overige waarden achter `Overige registerwaarden`.
- Gebruik per waarde een bronlabel: `Objectdata`, `Profiel`, `Kengetal`, `Handmatig` of `Default`.
- Toon vóór toepassen welk scenarioveld wordt overschreven.

### 6. Doorrekenen

**Sterk**
- De full-width werkruimte benut het scherm aanzienlijk beter.
- Hoofdstukken zijn logisch genummerd en inklapbaar.
- De werkstroom kan naar onderdelen navigeren.

**Verbeterpunten**
- Statussen `Leidend`, `Informatief` en `Niet relevant` vermengen rol en gebruik.
- Een ingevuld onderdeel kan buiten de actuele rekenroute vallen zonder duidelijke uitleg.
- De gebruiker mist een snelle modus voor alleen ontbrekende of conflicterende invoer.

**Eerste proef in deze branch**
- `OK` wordt vertaald naar `Gebruikt`;
- `Aandacht` naar `Controleren`;
- `Blocker` naar `Ontbreekt`;
- `Niet relevant` naar `Niet gebruikt`;
- bovenaan worden aantallen gebruikt/compleet, ontbrekend, controleren en niet gebruikt getoond;
- filter `Alleen aandachtspunten` verbergt complete en niet-gebruikte onderdelen.

**Vervolgadvies**
- Voeg later een tweede, afzonderlijke rol-indicator toe: `Leidend`, `Ondersteunend`, `Niet leidend`.
- Gebruik `Niet relevant` alleen wanneer een onderdeel semantisch niet bij het scenario hoort. Gebruik anders `Niet gebruikt in huidige rekenroute` of `Overruled door componentstrategie`.

### 7. Opslaan en wijzigingsstatus

**Verbeterpunten**
- Opslaan is niet overal uniform: sommige velden committen direct, andere hebben een knop.
- `Opgeslagen` en `Berekeningen live bijgewerkt` zijn niet hetzelfde, maar kunnen hetzelfde aanvoelen.

**Aanbevolen**
- Gebruik één modulebreed patroon:
  - `Niet opgeslagen` bij lokale wijzigingen;
  - `Opslaan` als expliciete actie;
  - `Opgeslagen om HH:MM` na succes;
  - `Berekening bijgewerkt` als afzonderlijke, subtiele status.
- Voorkom dat een opslagknop alleen door een naamwijziging actief wordt.

### 8. Resultaten en vergelijking

**Sterk**
- Residuele maximale koopsom, investering, opbrengst, marge en ROI zijn aanwezig.
- Scenario’s kunnen naast elkaar worden beoordeeld.

**Verbeterpunten**
- Scenario’s met verschillende doelwinstgrondslagen lijken vergelijkbaar terwijl zij dat inhoudelijk niet volledig zijn.
- De gebruiker ziet niet altijd waarom een scenario buiten rangschikking valt.
- Veel financiële kengetallen concurreren visueel om aandacht.

**Aanbevolen**
- Groepeer scenario’s op vergelijkingsgrondslag.
- Toon maximaal vier primaire beslis-KPI’s; overige uitkomsten achter details.
- Geef per scenario een expliciete conclusie en reden van uitsluiting.

### 9. Taal en terminologie

**Aanbevolen normalisatie**

| Huidig | Voorkeur |
|---|---|
| Quickscan / analyse / case door elkaar | Analyse als container; scenario als variant; quickscan als fase/type |
| Niet relevant | Niet gebruikt, niet leidend, overruled of werkelijk niet relevant |
| Blocker | Benodigde invoer ontbreekt |
| Aandacht | Controleren |
| Canoniek opgeslagen | Classificatie opgeslagen |
| Nieuwe rekenadapter nodig | Deze combinatie wordt nog niet volledig doorgerekend |

## Prioriteiten

### P0 — betrouwbaarheid en begrijpelijkheid
- zichtbaar maken wat gebruikt, ontbrekend en niet gebruikt is;
- uniforme opslagstatus;
- tegenstrijdige labels bij verkoop/exit corrigeren;
- incomplete scenario’s niet als volwaardig vergelijkbaar presenteren.

### P1 — taakgericht werken
- overzicht ombouwen tot voortgangs- en beslispagina;
- alleen-aandachtspuntenmodus;
- bronlabels bij relevante invoervelden;
- toepasselijke kengetallen standaard filteren.

### P2 — verfijning
- laatste wijziging en eigenaar per scenario;
- begeleide scenario-wizard voor nieuwe gebruikers;
- persoonlijke voorkeuren voor ingeklapte hoofdstukken;
- toetsing op tablet en mobiel.

## Acceptatiecriteria voor de statusproef

De proef is geslaagd wanneer een gebruiker zonder secties te openen binnen tien seconden kan beantwoorden:

1. Welke onderdelen worden in dit scenario gebruikt?
2. Welke benodigde invoer ontbreekt?
3. Welke onderdelen vragen controle?
4. Welke onderdelen zijn wel aanwezig maar worden niet gebruikt?
5. Waar moet ik als eerste naartoe?

De proef moet eenvoudig kunnen worden teruggedraaid door de commit op `SectionRail.tsx` te verwijderen. Er zijn geen datamigraties of permanente gegevenswijzigingen.