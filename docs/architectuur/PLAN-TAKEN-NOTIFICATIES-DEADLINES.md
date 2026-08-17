# PLAN — Taken, notificaties, deadlines, agenda & multi-device sync

## Doel

Bito CRM krijgt één consistente tijd- en actielaag die synchroon werkt op web en alle geregistreerde apparaten.

De gebruiker moet altijd kunnen onderscheiden:

1. **Taak** — iets dat iemand daadwerkelijk moet doen.
2. **Deadline** — uiterste datum/tijd waarop een taak of verplichting moet zijn afgehandeld.
3. **Afspraak / agendamoment** — gebeurtenis op een concrete datum/tijd.
4. **Follow-upmoment** — datum waarop opnieuw actie moet worden overwogen of uitgevoerd.
5. **Notificatie** — actieve waarschuwing over een relevante gebeurtenis; dit is geen bronrecord maar afgeleide delivery.
6. **Workflowstatus / werkbak** — waar een dossier zich procesmatig bevindt.
7. **Registratiedatum** — historische of administratieve datum zonder actie-intentie.
8. **Verwachte datum** — prognose, bijvoorbeeld verwachte closing; niet automatisch een taak of melding.

Kernregel: **een datum is nooit automatisch een notificatie**. Alleen een expliciete notificatiepolicy bepaalt of en wanneer een datum/event tot een in-app melding of pushbericht leidt.

---

## Harde architectuureis: multi-device synchronisatie

Alle relevante staat is server-side leidend en wordt per gebruiker gesynchroniseerd over:

- webapp;
- iPhone 1;
- iPhone 2;
- toekomstige apparaten/PWA-installaties.

Verwacht gedrag:

- melding gelezen op één apparaat = gelezen op alle apparaten;
- taak afgerond op één apparaat = direct afgerond in alle clients;
- notificatievoorkeur gewijzigd = geldt voor alle apparaten, tenzij expliciet device-specifiek;
- iedere push-subscription is device-specifiek en gekoppeld aan dezelfde gebruiker;
- een verwijderd of verlopen push-endpoint wordt veilig uitgeschreven;
- dubbele pushdelivery voor hetzelfde event naar hetzelfde device wordt voorkomen;
- één event mag bewust naar meerdere geregistreerde devices van dezelfde gebruiker worden verzonden;
- localStorage mag uitsluitend cache/optimistische UI zijn, nooit bron van waarheid.

---

## Huidige toestand — vastgesteld op main c4d4da67

### Centrale taken

De huidige taaklogica ondersteunt onder meer:

- titel;
- type;
- deadline;
- optionele deadline-tijd;
- prioriteit;
- status;
- koppeling aan relatie, object, deal en Off-Market-signaal.

Deadline zonder tijd wordt functioneel behandeld als einde van de dag. Open/wachtende taken kunnen als vandaag of verlopen worden geclassificeerd en worden op urgentie gesorteerd.

### Volgende actie

Off-Market kent naast centrale taken nog legacy-velden `volgende_actie_datum` en `volgende_actie_omschrijving`. De UI kiest eerst de eerstvolgende open centrale taak en valt alleen terug op de legacy-velden wanneer geen taak bestaat.

Dit is bruikbaar als compatibiliteitslaag, maar de semantiek moet uiteindelijk eenduidig worden: een echte uitvoerbare volgende actie hoort bij voorkeur als centrale taak te bestaan.

### In-app meldingen

De notificatiebel genereert momenteel client-side afgeleide meldingen voor onder meer:

- verlopen taken;
- taken die vandaag aflopen;
- nieuw aangemaakte hoge/urgente taken;
- aflopende biedingen;
- sterke matches;
- mogelijke dubbele relaties/objecten.

De meldingen worden lokaal opgeslagen en vervolgens als JSON-status naar `user_notification_state` gesynchroniseerd.

Beperking: dit is nog geen server-side notificatie-engine. Er bestaat geen centrale scheduled/delivery queue en geen device push-subscriptionmodel.

### Agenda / iCal

De huidige iCal-feed publiceert meerdere soorten gedateerde records, waaronder:

- bezichtigingen;
- taakdeadlines;
- deal-follow-ups;
- verwachte closings;
- pipeline-bezichtigingen;
- pipeline-volgende-acties;
- gewenste levering;
- NDA-datums;
- Vastgoedkans-volgende-acties/opvolgdatums.

De feed maakt dus terecht méér zichtbaar dan alleen taken. Dat bevestigt dat `datum`, `agenda-item`, `taak` en `melding` verschillende concepten moeten blijven.

---

## Probleemdefinitie

De huidige app bevat meerdere parallelle mechanismen voor tijd en actie:

- centrale taken;
- `volgende_actie_*` velden;
- `opvolgdatum` / `opvolgactie`;
- deal follow-upvelden;
- pipeline volgende actie;
- afspraakdatums;
- iCal-projectie;
- client-side notificatie-afleiding;
- workflowwerkbakken.

Daardoor is niet altijd zichtbaar of een veld:

- alleen registreert;
- sorteert/urgentie bepaalt;
- een taak vertegenwoordigt;
- in de agenda verschijnt;
- een in-app melding veroorzaakt;
- later een pushmelding veroorzaakt;
- de workflowstatus beïnvloedt.

---

## Doelmodel

### 1. Source entities blijven leidend

Taken, afspraken, biedingen, deals, acquisitiedossiers en andere domeinrecords blijven de functionele bron.

### 2. Eén centrale Action/Notification policy

Per gebeurtenistype wordt expliciet vastgelegd:

- `action_required`: ja/nee;
- `calendar_visible`: ja/nee;
- `notification_enabled`: ja/nee;
- standaard moment(en) van waarschuwing;
- prioriteit;
- deduplicatiesleutel;
- deep link;
- auto-resolve conditie;
- toegestane kanalen: in-app / push / eventueel e-mail.

### 3. Server-side notificatie-events

Een afgeleid notificatie-event krijgt minimaal:

- user_id;
- event_type;
- source_type;
- source_id;
- occurrence_key;
- title/body;
- priority;
- href/deep_link;
- scheduled_at;
- created_at;
- resolved_at;
- read_at;
- dismissed_at.

`occurrence_key` borgt dat bijvoorbeeld `taak_vandaag:<taak_id>:<datum>` maximaal één logische melding vormt.

### 4. Device subscriptions

Per geregistreerd apparaat/PWA-installatie:

- user_id;
- endpoint;
- p256dh/auth keys of equivalente Web Push subscriptiondata;
- device label;
- platform/browser;
- created_at;
- last_seen_at;
- revoked_at;
- eventueel push_enabled.

### 5. Delivery-log

Per notificatie-event × device:

- notification_event_id;
- subscription_id;
- queued_at;
- sent_at;
- failed_at;
- failure_code;
- retry_count.

Hiermee zijn multi-device levering, retries en deduplicatie controleerbaar.

### 6. Read state is gebruikersbreed

`read_at` en `dismissed_at` horen primair bij het notificatie-event voor de gebruiker, niet bij één device. Daardoor verdwijnt een gelezen melding overal uit de ongelezen teller.

Pushdelivery blijft wél per device geregistreerd.

---

## Semantische matrix — uitgangspunt

| Bron/gebeurtenis | Taak? | Agenda? | In-app? | Push? | Opmerking |
|---|---:|---:|---:|---:|---|
| Open taak zonder datum | Ja | Nee | Alleen bij hoge/urgente creatie | Policy | Geen deadline-alarm |
| Taakdeadline vandaag | Ja | Ja | Ja | Ja | Actieve waarschuwing |
| Taak verlopen | Ja | Verleden zichtbaar | Ja | Ja, eenmalig/escalatie-policy | Niet dagelijks spammen |
| Bezichtiging | Nee/optioneel | Ja | Eventueel vooraf | Ja indien voorkeur | Afspraak, geen gewone taak |
| Verwachte closing | Nee | Ja | Standaard nee | Standaard nee | Prognose |
| Bieding verloopt | Nee | Eventueel | Ja | Ja | Commerciële deadline |
| Registratiedatum brief | Nee | Nee | Nee | Nee | Historie |
| Opvolgdatum met concrete actie | Bij voorkeur Ja | Ja | Ja | Ja | Converteren naar centrale taak waar passend |
| Workflowadvies zonder datum | Niet automatisch | Nee | UI-signaal | Nee | Werkbak/advies, geen notificatie |
| Sterke match | Nee | Nee | Ja | Opt-in | Event, geen deadline |
| Mogelijke dubbele invoer | Nee | Nee | Ja | Alleen kritiek/opt-in | Datakwaliteit |

Deze matrix wordt per module volledig geïnventariseerd vóór implementatie.

---

## Gefaseerde uitvoering

### Fase A — Read-only inventarisatie

Per module alle velden en afleidingen classificeren:

- Taken;
- Objecten;
- Relaties;
- Deals/Dealflow;
- Biedingen;
- Object Pipeline;
- Vastgoedkansen;
- Off-Market Radar / Acquisitie;
- agenda/iCal;
- notificatiebel;
- eventuele dashboards/KPI's.

Output: complete matrix `bronveld/gebeurtenis → betekenis → actie → agenda → melding → push → resolve`.

### Fase B — Domeincontract

Bepalen welke legacy-acties centrale taken moeten worden en welke bewust zelfstandige datumvelden blijven.

Geen destructieve datamigratie zonder aparte controle.

### Fase C — Server-side notificatiekern

Nieuwe tabellen/contracten voor:

- notification_events;
- notification_preferences;
- push_subscriptions;
- notification_deliveries.

RLS per gebruiker. Idempotente eventgeneratie.

### Fase D — In-app bell migreren

De bel leest server-side notificatie-events in plaats van zelf de primaire logica te berekenen.

Client-side afleiding verdwijnt stapsgewijs zodra serverpariteit bewezen is.

### Fase E — PWA + Web Push

- web app manifest;
- service worker;
- iOS Home Screen compatibiliteit;
- push permission onboarding;
- device registratie;
- Web Push delivery;
- deep linking naar de juiste CRM-context.

### Fase F — Multi-device acceptatie

Minimaal testen:

1. web open + iPhone A + iPhone B;
2. dezelfde gebruiker op alle drie;
3. één taakdeadline genereert één logisch event;
4. beide iPhones krijgen de push;
5. melding lezen op A synchroniseert naar B en web;
6. taak afronden op web resolveert melding op beide telefoons;
7. offline/weer-online herstelt zonder duplicaten;
8. subscription intrekken op één telefoon raakt de andere niet;
9. push geweigerd laat in-app notificaties intact;
10. legacy iCal blijft functioneel zolang deze niet bewust wordt vervangen.

---

## Veiligheids- en scopegrenzen

- Geen Kadasterautomatisering.
- Geen wijziging aan BAG-logica.
- Geen destructieve migraties.
- Geen automatische omzetting van historische datumvelden zonder expliciet migratiecontract.
- Geen pushspam: defaults conservatief en deduplicatie verplicht.
- Eerst semantische inventarisatie en pariteit, daarna pas client-side logica verwijderen.

---

## Eerstvolgende stap

Voltooi Fase A als read-only code-audit en lever een module-voor-module matrix met:

- huidige velden;
- huidige betekenis;
- huidige UI-weergave;
- huidige agenda-impact;
- huidige notificatie-impact;
- gewenste canonieke betekenis;
- voorgestelde migratie/compatibiliteitsroute.
