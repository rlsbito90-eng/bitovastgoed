# AUDIT — APP-BREDE TIJD-, ACTIE-, AGENDA- EN NOTIFICATIELOGICA

Status: read-only logica-audit / implementatiecontract in voorbereiding  
Scope: Bito CRM app-breed  
Hoofdprincipes: LOGISCH — AUTOMATISCH — GEBRUIKSVRIENDELIJK

## 1. Doel

Deze audit inventariseert niet alleen welke datumvelden bestaan, maar welke zakelijke betekenis ze hebben en welk systeemgedrag daar logisch uit volgt.

Canonieke beslisketen:

`bron → betekenis → actie vereist? → centrale taak? → agenda? → in-app? → push? → resolve → historie/audit`

Hoofdregel:

> Een datum is nooit automatisch een taak, agenda-item of notificatie.

Een datum krijgt pas gedrag nadat de semantiek expliciet is geclassificeerd.

## 2. Canonieke semantische typen

### A. REGISTRATIE
Historisch feit: iets is gebeurd of vastgelegd.

Voorbeelden: brief verstuurd op, reactie ontvangen op, NDA getekend op, aangemaakt op.

Standaardgedrag:
- taak: nee;
- agenda: nee;
- notificatie: nee;
- push: nee;
- KPI/audit: ja.

### B. PROGNOSE / VERWACHTING
Verwachte zakelijke datum zonder intrinsieke gebruikersactie.

Voorbeelden: verwachte closing, gewenste levering.

Standaardgedrag:
- taak: nee;
- agenda: optioneel/ja indien operationeel nuttig;
- notificatie: standaard nee;
- push: nee;
- status: tentative;
- wijziging moet agenda-item bijwerken, niet een nieuwe taak maken.

### C. AFSPRAAK
Gebeurtenis die op een concreet moment plaatsvindt.

Voorbeelden: bezichtiging, afspraak, belafspraak met afgesproken tijd.

Standaardgedrag:
- taak: meestal nee; alleen voorbereiding als aparte actie nodig is;
- agenda: ja;
- reminder: afzonderlijke policy;
- push: reminder-policy, niet simpelweg omdat datum bestaat.

### D. TAAK
Concrete handeling die een gebruiker moet uitvoeren.

Voorbeelden: bellen, e-mailen, documenten opvragen, analyse maken.

Standaardgedrag:
- centrale `taken`: ja;
- deadline: optioneel;
- agenda: alleen bij concrete deadline/datum;
- in-app: afhankelijk van toestand/prioriteit;
- push: afhankelijk van policy;
- resolve: taak afgerond/geannuleerd.

### E. DEADLINE
Uiterste datum/tijd voor een taak of verplichting.

Standaardgedrag:
- hoort bij een taak of expliciete business deadline;
- agenda: ja wanneer concreet;
- in-app/push: ja volgens escalation policy;
- resolve: onderliggende verplichting vervalt of is afgerond.

### F. FOLLOW-UP
Moment waarop opnieuw contact of beoordeling nodig is.

Functioneel is dit vrijwel altijd een taak met type `Follow-up`, tenzij het uitsluitend een automatisch workflow-herbeoordelingsmoment is.

Standaardgedrag:
- centrale taak: ja;
- agenda: ja bij concrete datum;
- in-app/push: ja volgens task policy;
- bronveld mag tijdelijk als legacy mirror bestaan, maar niet blijvend parallel leidend zijn.

### G. WORKFLOWSTATUS / WERKBAK
Geeft procespositie aan, niet automatisch een moment of melding.

Voorbeelden: Onderzoeken, Brief voorbereiden, Opvolgen, Wachten.

Standaardgedrag:
- taak: alleen als concrete gebruikersactie nodig is;
- agenda: nee;
- notificatie: alleen bij betekenisvolle overgang of blokkade;
- push: normaal niet.

### H. SIGNAAL / ATTENTIE
Nieuwe informatie die aandacht verdient maar niet automatisch een taak is.

Voorbeelden: sterke match, mogelijke dubbele relatie.

Standaardgedrag:
- in-app: mogelijk;
- push: opt-in/alleen hoge relevantie;
- taak: pas na expliciete of geautomatiseerde businessregel.

## 3. App-brede hoofdbevinding

Er bestaan momenteel meerdere parallelle actieconcepten:

- `taken.deadline` + `deadline_tijd`;
- `deals.datum_follow_up` + `follow_up_tijd`;
- `vastgoedkansen.volgende_actie_datum` + `volgende_actie_omschrijving`;
- `vastgoedkansen.opvolgdatum` + `opvolgactie` (legacy);
- `object_pipeline.volgende_actie_datum` + `volgende_actie` + `volgende_actie_omschrijving`;
- Off-Market `volgende_actie_*`;
- acquisitie-/brievenopvolgreeksen;
- werkbak- en workflowadviezen.

Deze velden zijn niet allemaal fout. Het probleem is dat dezelfde zakelijke betekenis op meerdere plaatsen zelfstandig kan worden opgeslagen en geëvalueerd.

Doelmodel:

> Centrale taak is canoniek voor echte gebruikersacties. Domeinvelden mogen context, prognose of workflowstatus bevatten, maar mogen niet zelfstandig een tweede actie-administratie vormen.

## 4. Modulematrix

| Module / bron | Huidig concept | Classificatie | Centrale taak | Agenda | In-app | Push | Doelrichting |
|---|---|---|---|---|---|---|---|
| Taken | `deadline`, `deadline_tijd` | deadline | canoniek | ja indien datum | ja | ja volgens policy | behouden |
| Taken | taak zonder datum | taak | canoniek | nee | alleen prioriteit/nieuw indien policy | alleen urgent optioneel | deadline echt optioneel maken |
| Deals | `bezichtiging_gepland`, `bezichtiging_tijd` | afspraak | nee | ja | reminder optioneel | reminder optioneel | behouden als afspraak |
| Deals | `datum_follow_up`, `follow_up_tijd` | follow-up | ja | via taak | via taak | via taak | migreren naar centrale taak / legacy mirror |
| Deals | `verwachte_closingdatum` | prognose | nee | ja/tentative | standaard nee | nee | behouden als prognose |
| Object Pipeline | `bezichtiging_datum` | afspraak | nee | ja | reminder optioneel | reminder optioneel | behouden; tijdveld overwegen |
| Object Pipeline | `volgende_actie_datum` + actie | follow-up/taak | ja | via taak | via taak | via taak | centrale taak leidend maken |
| Object Pipeline | `gewenste_levering` | prognose/wens | nee | ja/tentative | nee | nee | behouden als prognose |
| Relaties | `nda_datum` | ambigu | niet automatisch | niet automatisch | nee | nee | semantiek opsplitsen/hernoemen |
| Vastgoedkansen | `volgende_actie_datum` + omschrijving | taak/follow-up | ja | via taak | via taak | via taak | centrale taak leidend |
| Vastgoedkansen | `opvolgdatum` + `opvolgactie` | legacy follow-up | ja | alleen fallback tijdens migratie | via taak | via taak | uitfaseren als zelfstandige bron |
| Off-Market | `volgende_actie_*` | legacy/taak | ja | via taak | via taak | via taak | bestaande fallback uitfaseren |
| Acquisitie brieven | post-opvolgdatum/opvolgreeks | follow-up | ja wanneer concrete actie | via taak | via taak | via taak | taak atomisch laten ontstaan bij gekozen opvolging |
| Biedingen | `geldigTot` | business deadline | niet per se | optioneel | ja bij actief bod | ja | behouden als deadline-event |
| Matching | sterke match | signaal | nee | nee | ja | standaard opt-in | geen taak tenzij gebruiker converteert |
| Datakwaliteit | mogelijke duplicaat | attentie | nee | nee | ja | standaard niet/opt-in | in-app attention center |
| Brief verstuurd op | verzenddatum | registratie | nee | nee | nee | nee | audit/KPI |
| Reactie ontvangen op | eventdatum | registratie + mogelijk vervolgtrigger | vervolgtaak afhankelijk uitkomst | nee voor bron-event | event mogelijk | alleen relevante reactie optioneel | bron-event en vervolgactie scheiden |
| Workflowadvies | ongedateerd advies | workflow | nee | nee | UI signaal | nee | nooit automatisch agenda/push |

## 5. Modulebevindingen

### 5.1 Taken — canonieke actielaag

**Goed**
- centrale taak heeft status, prioriteit, type, deadline en optionele tijd;
- overdue/today logica is al gecentraliseerd in taakhelpers;
- gekoppelde context kan relatie, object, deal, Off-Market-signaal en Vastgoedkans bevatten.

**Probleem**
Nieuwe taakformulieren vullen standaard `deadline = vandaag` in. Daardoor is een deadline momenteel feitelijk niet optioneel in de UX, ook al kan het datamodel technisch een lege string verwerken.

**Doelregel**
- nieuwe taak zonder expliciete datum => geen deadline;
- snelle keuzes in UI: `Vandaag`, `Morgen`, `Deze week`, `Geen deadline`, `Datum kiezen`;
- alleen een expliciet gekozen deadline mag agenda-/due-notificatie activeren.

### 5.2 Deals

#### Bezichtiging
Correct als afspraak. Een bezichtiging is geen taak op zichzelf. Eventueel kunnen voorbereiding en nabellen aparte taken zijn.

#### Follow-up
`datum_follow_up` beschrijft inhoudelijk een concrete gebruikersactie. Dit concurreert met centrale taken.

Doel:
- follow-up aanmaken = centrale taak maken of koppelen;
- deal mag een read-model / convenience veld tonen, maar bron van waarheid is taak;
- verplaatsen van follow-up wijzigt dezelfde taak;
- afronden van taak verwijdert open follow-upstatus.

#### Verwachte closing
Dit is een prognose. Agenda is nuttig, maar status moet `TENTATIVE` blijven zolang closing niet feitelijk is bevestigd.

Geen push alleen omdat de prognosedatum nadert. Als er vóór closing iets moet gebeuren, hoort dat in aparte taken.

### 5.3 Object Pipeline / kandidaten

Er zijn drie verschillende datumsoorten op één record en die moeten bewust verschillend blijven:

1. `bezichtiging_datum` = afspraak;
2. `volgende_actie_datum` = taak/follow-up;
3. `gewenste_levering` = prognose/wens van kandidaat.

Huidige iCal-feed maakt van alle drie agenda-items. Dat kan visueel nuttig zijn, maar ze mogen niet dezelfde reminder-/pushpolicy krijgen.

`volgende_actie_datum` moet naar centrale taaklogica convergeren.

### 5.4 Relaties / NDA

`nda_datum` is semantisch onvoldoende bepaald.

Mogelijke betekenissen:
- NDA verstuurd op;
- NDA getekend op;
- NDA ontvangen op;
- NDA verloopt op;
- NDA moet getekend zijn vóór.

Alleen de laatste twee zijn agenda/deadline-achtig. De eerste drie zijn registratie.

Doel:
- bestaande data eerst classificeren vóór migratie;
- niet langer generiek `nda_datum` automatisch in agenda zetten;
- toekomstige velden/events benoemen naar betekenis, bijvoorbeeld `nda_getekend_op`, `nda_verloopt_op`;
- indien `NDA opvolgen` nodig is: centrale taak.

### 5.5 Vastgoedkansen

Positief bestaand patroon:
- expliciete `volgende_actie_datum` wint van legacy `opvolgdatum`;
- afgesloten dossiers gebruiken legacy opvolgdatum niet opnieuw;
- wanneer op dezelfde Vastgoedkans/datum al een centrale taak bestaat, wint de taak in iCal.

Dit is de juiste migratierichting voor de hele app.

Doel:
- centrale taak uiteindelijk canoniek;
- `volgende_actie_*` wordt read model / compatibility mirror of verdwijnt na migratie;
- `opvolgdatum` wordt legacy-only;
- workflowadvies zonder datum blijft uitsluitend in werkbak/UI.

### 5.6 Off-Market Radar

Bestaande volgende-actie helper gebruikt al:
1. eerst open centrale taak gekoppeld aan signaal;
2. daarna pas legacy `volgende_actie_*`.

Dat is correct overgangsgedrag.

Doel:
- geen nieuwe zelfstandige legacy volgende acties meer schrijven zodra taakpariteit groen is;
- legacy alleen lezen voor oude records totdat backfill/migratie afgerond is;
- Kadaster-onderzoek blijft handmatige actie en mag nooit automatisch door een notificatie-engine worden uitgevoerd.

### 5.7 Acquisitie / brieven / opvolgreeksen

Brieven kennen registratiedata én vervolgacties. Die moeten strikt worden gescheiden.

- brief gegenereerd / vastgelegd / geprint / gepost / verstuurd = audit/registratie;
- gekozen opvolging na post = concrete taak;
- bewust geen opvolging = auditbesluit, geen verborgen taak;
- reactie ontvangen = registratie-event;
- inhoudelijke reactie kan automatisch een workflowadvies geven, maar niet zonder policy blind een push veroorzaken.

Post-opvolging hoort atomisch te zijn: wanneer gebruiker bij `Markeer gepost/verstuurd` kiest voor opvolgen, moeten registratie + taak in één consistente operatie ontstaan.

### 5.8 Biedingen

`geldigTot` is een echte business deadline, maar niet per definitie een taak.

Logica:
- alleen actieve biedingstatussen tellen;
- melding bijvoorbeeld T-1 dag en T-0 volgens policy;
- verlopen/ingetrokken/geaccepteerd/afgewezen => event automatisch resolved;
- geen dagelijkse herhaling van dezelfde occurrence;
- concrete actie `bod opvolgen` kan daarnaast een taak zijn.

### 5.9 Matching

Sterke match is een signaal, geen verplichting.

Logica:
- in-app attention: ja;
- push: standaard uit of expliciete opt-in;
- geen agenda;
- geen automatische taak;
- actieknop kan `Taak maken`, `Kandidaat toevoegen`, `Negeren` zijn.

### 5.10 Datakwaliteit

Mogelijke dubbele relatie/object is geen deadline en hoort niet in agenda.

In-app aandacht is logisch. Push alleen voor uitzonderlijk kritieke datakwaliteit, niet standaard.

## 6. iCal-audit

Huidige feed bevat:
- dealbezichtigingen;
- taakdeadlines;
- deal follow-ups;
- verwachte closings;
- pipelinebezichtigingen;
- pipeline volgende acties;
- gewenste leveringen;
- relatie-NDA-data;
- Vastgoedkans volgende acties/opvolging.

### Correct
- afspraken;
- expliciete taakdeadlines;
- prognoses als `TENTATIVE` wanneer agenda-inzicht nuttig is.

### Tijdelijk dubbel maar beheerst
- Vastgoedkans actie versus centrale taak: huidige deduplicatie is goed.

### Te herzien
- deal follow-up direct uit dealveld;
- pipeline volgende actie direct uit pipelineveld;
- generieke `nda_datum`;
- eventuele overige toekomstige datumvelden zonder semantisch contract.

### Technisch defect / verbeterpunt
`combineDateTimeAmsterdam` gebruikt een ruwe DST-regel `april t/m oktober = UTC+2`, anders UTC+1. Dat is fout rond de daadwerkelijke Europese zomertijdwissels eind maart/eind oktober.

Doel:
- timezone-aware conversie op echte Europe/Amsterdam-regels;
- geen maandheuristiek.

## 7. Notificatiebeleid

### Policyfamilie 1 — ACTION_CRITICAL
Voor concrete verplichtingen:
- task_due_today;
- task_overdue;
- bid_expiry;
- expliciete follow-up taak.

Kan in-app + push.

### Policyfamilie 2 — APPOINTMENT_REMINDER
Voor afspraken:
- bezichtiging;
- geplande afspraak.

Reminder is afzonderlijk instelbaar (bijv. dag ervoor / uur ervoor). De afspraak zelf is geen taak.

### Policyfamilie 3 — ATTENTION
Voor informatie die aandacht kan verdienen:
- sterke match;
- belangrijke nieuwe reactie;
- datakwaliteitsprobleem;
- relevante workflowtransitie.

In-app standaard; push alleen per policy/voorkeur.

### Policyfamilie 4 — FORECAST
- verwachte closing;
- gewenste levering.

Geen push standaard. Eventueel agenda.

### Policyfamilie 5 — REGISTRATION
- brief verstuurd;
- reactie geregistreerd;
- document aangemaakt;
- contactmoment voltooid.

Geen notificatie door het registratie-event zelf, tenzij dit event een apart action-required event veroorzaakt.

## 8. Read versus resolved

Hard onderscheid:

- `read_at`: gebruiker heeft melding gezien;
- `dismissed_at`: gebruiker heeft attentie handmatig uit de lijst verwijderd;
- `resolved_at`: onderliggende toestand bestaat niet meer.

Voorbeelden:
- verlopen taak gelezen maar niet afgerond => read, niet resolved;
- taak afgerond => resolved op alle apparaten;
- bieding ingetrokken => expiry-event resolved;
- prognosedatum gewijzigd => bestaand agenda-event wordt bijgewerkt, geen oude actieve waarschuwing.

## 9. Deduplicatie

Iedere logische occurrence krijgt één stabiele sleutel.

Voorbeelden:
- `task_due_today:{task_id}:{YYYY-MM-DD}`;
- `task_overdue:{task_id}:{deadline_revision}` of andere stabiele lifecycle key;
- `bid_expiry:{bid_id}:{geldig_tot}`;
- `strong_match:{object_id}:{zoekprofiel_id}:{match_revision}`.

Meerdere apparaten creëren geen nieuwe logische events; zij krijgen alleen aparte deliveries.

## 10. Canonieke bronhiërarchie

### Echte gebruikersactie
1. centrale `taken`;
2. legacy domeinactie alleen fallback zolang migratie loopt;
3. workflowadvies nooit stilzwijgend promoveren naar taak zonder expliciete businessregel.

### Afspraak
Domeinrecord met afspraaksemantiek is bron; geen duplicaat-taak nodig.

### Prognose
Domeinrecord is bron; niet kopiëren naar taak.

### Registratie
Append-only event/audittrail of expliciet registratieveld; geen taak/notificatie.

## 11. UX-contract

De gebruiker moet op ieder scherm aan vorm en taal kunnen zien wat iets betekent.

Aanbevolen labels:
- `Deadline` alleen voor uiterste actiedatum;
- `Afspraak` / `Bezichtiging` voor gebeurtenissen;
- `Volgende actie` alleen wanneer concrete actie bestaat;
- `Verwachte closing` expliciet als verwachting;
- `Gewenste levering` expliciet als wens/prognose;
- `Verstuurd op`, `Ontvangen op`, `Getekend op` voor registraties.

Vermijd generieke labels als alleen `Datum` wanneer de betekenis operationeel relevant is.

Waar een centrale taak bestaat, toon in domeinmodule bijvoorbeeld:

`Volgende actie: Bellen — 21 aug 10:00`  
`Bron: Taak`  
`Status: Open`

Niet daarnaast nog een tweede zelfstandig bewerkbaar `volgende_actie_datum` zonder duidelijke relatie.

## 12. Prioriteiten / gevonden inconsistenties

### P0 — vóór notificatie-v2 activeren
1. taakdeadline standaard vandaag verwijderen; deadline expliciet optioneel maken;
2. ontvanger/owner van taken correct houden;
3. notificatie-events server-authoritative;
4. voorkomen dat legacy actievelden én centrale taak dubbel pushen;
5. `nda_datum` niet zonder semantische verduidelijking naar push promoveren;
6. DST-conversie in iCal corrigeren.

### P1 — canonieke actieconvergentie
1. Deal follow-up → centrale taak;
2. Pipeline volgende actie → centrale taak;
3. Vastgoedkans volgende actie → centrale taak als bron;
4. Off-Market legacy volgende actie uitfaseren;
5. acquisitie post-opvolging altijd als centrale taak wanneer gekozen.

### P2 — afspraak/reminderlaag
1. uniforme afspraakreminders;
2. pipelinebezichtiging eventueel tijdveld;
3. reminderpreferenties per gebruiker.

### P3 — attentionlaag
1. matches;
2. reacties;
3. datakwaliteit;
4. workflowtransities;
5. digest versus directe push.

## 13. Veilige migratievolgorde

1. **Contract vastleggen** — deze audit + tests, geen gedrag wijzigen.
2. **Deadline UX repareren** — nieuwe taak zonder impliciete vandaag-deadline.
3. **Centrale task adapters** — domeinactievelden kunnen een taak aanmaken/updaten.
4. **Read-model pariteit** — schermen tonen dezelfde volgende actie vanuit centrale taak.
5. **iCal pariteit** — agenda gebruikt centrale taak waar het een actie betreft; domeinvelden alleen voor afspraak/prognose.
6. **Notification-v2 pariteit** — events uitsluitend vanuit canonieke bronnen.
7. **Legacy writes stoppen** — oude actievelden niet meer als tweede bron schrijven.
8. **Backfill/migratie** — alleen bewijsbaar veilige oude records koppelen.
9. **Legacy reads verwijderen** wanneer dekking bewezen is.
10. **Multi-device acceptatie** op 2× iPhone PWA, Mac PWA, Safari/Chrome.

## 14. Acceptatiecriteria

De architectuur is pas logisch consistent wanneer de volgende voorbeelden overal hetzelfde werken:

### Scenario A — losse taak zonder deadline
- taak zichtbaar in Taken;
- geen agenda-item;
- geen due push;
- hoge/urgente prioriteit kan wel afzonderlijke attention policy triggeren.

### Scenario B — taak met deadline
- één centrale taak;
- één agenda-item;
- één logisch due-event;
- meerdere apparaten krijgen deliveries van hetzelfde event;
- afronden op één apparaat resolved overal.

### Scenario C — Deal follow-up
- gebruiker plant follow-up;
- centrale taak ontstaat/wijzigt;
- Deal toont die taak als volgende actie;
- iCal gebruikt taak;
- geen dubbel deal-follow-up agenda-item.

### Scenario D — verwachte closing
- zichtbaar in Deal;
- tentative agenda-item;
- geen taak;
- geen push;
- aparte voorbereidingsacties zijn taken.

### Scenario E — brief verstuurd
- audit-/KPI-event;
- geen agenda;
- geen push;
- gekozen opvolging maakt afzonderlijke taak.

### Scenario F — NDA
- `getekend op` = registratie;
- `verloopt op` = agenda/deadline-event;
- `opvolgen` = taak;
- generieke `nda_datum` wordt niet meer als alle drie tegelijk geïnterpreteerd.

## 15. Eindoordeel eerste app-brede audit

De app heeft al meerdere goede lokale oplossingen, maar mist nog één volledig afgedwongen app-breed semantisch contract. Vooral Vastgoedkansen en Off-Market laten al de juiste overgangsrichting zien: **centrale taak eerst, legacy actieveld als fallback**.

De belangrijkste architectuurkeuze is daarom niet om alle datumvelden te centraliseren. Dat zou de domeinbetekenis juist beschadigen. De juiste keuze is:

> Centraliseer gebruikersacties en notificatiebeleid; laat afspraken, prognoses en registraties in hun eigen domein bestaan met een expliciet semantisch type.

Daarmee wordt de CRM voorspelbaar:
- een taak betekent dat de gebruiker iets moet doen;
- een deadline betekent dat het uiterlijk dan moet gebeuren;
- een afspraak betekent dat iets dan plaatsvindt;
- een prognose betekent dat iets rond die datum wordt verwacht;
- een registratie betekent dat iets op die datum is gebeurd;
- een notificatie is alleen een afgeleide deliverybeslissing, nooit de bron van waarheid.
