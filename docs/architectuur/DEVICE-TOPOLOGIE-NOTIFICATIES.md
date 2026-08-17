# Device-topologie — taken, notificaties en push

## Actuele gebruikssituatie

De gebruiker werkt met dezelfde Bito CRM-accountcontext vanaf meerdere clients:

1. iPhone A — webapp/PWA op beginscherm;
2. iPhone B — webapp/PWA op beginscherm;
3. MacBook — webapp/PWA geïnstalleerd;
4. incidentele Safari-sessie;
5. incidentele Chrome-sessie.

## Architectuurregel

Er is één gebruikersbrede bron van waarheid voor taak- en notificatiestatus. Clients zijn projecties van die server-side toestand en nooit zelfstandig leidend.

Gebruikersbreed synchroniseren minimaal:

- taakstatus;
- deadlinewijzigingen;
- notificatie gelezen/ongelezen;
- dismissed/gesnoozed/opgelost;
- notificatievoorkeuren, tenzij expliciet device-specifiek;
- audit-/eventstatus waar relevant.

## Device-specifiek

Pushdelivery en browser/PWA-capabilities zijn per client/installatie apart geregistreerd.

Per push-capabele installatie bewaren we minimaal:

- user_id;
- subscription-id / endpoint;
- client/installatie-id;
- device-label;
- platform;
- browser/engine;
- installatiecontext: PWA/home-screen of browser;
- push-permissionstatus;
- push_enabled;
- created_at;
- last_seen_at;
- revoked_at.

De drie vaste PWA-installaties mogen dus ieder een eigen push-subscription hebben, maar verwijzen naar dezelfde gebruikersbrede notificatie-events.

## Verwacht synchronisatiegedrag

### Lezen

Een melding gelezen op iPhone A wordt server-side `read_at` en verschijnt daarna ook als gelezen op iPhone B, MacBook, Safari en Chrome.

### Afronden

Een taak afgerond op de MacBook wordt centraal afgerond. Openstaande notificaties waarvan die taak de bron is worden volgens de policy opgelost op alle clients.

### Push

Een logisch notificatie-event mag naar alle actieve, push-enabled subscriptions van dezelfde gebruiker worden bezorgd. Dit zijn afzonderlijke deliveries van hetzelfde event; er worden geen afzonderlijke logische notificaties per apparaat aangemaakt.

### Browsergebruik

Safari/Chrome krijgen altijd dezelfde server-side in-app toestand na authenticatie. Push wordt alleen gekoppeld wanneer die concrete browser/installatie push ondersteunt en de gebruiker daarvoor toestemming heeft gegeven.

### Offline

Een tijdelijk offline apparaat mag lokaal cachen/optimistisch tonen, maar bij reconnect wordt server-side toestand gereconcilieerd. Duplicaten worden voorkomen met event- en delivery-idempotency keys.

## Acceptatiematrix

Minimaal end-to-end testen:

| Scenario | Verwachting |
|---|---|
| Pushwaardig event ontstaat | Eén logisch server-event |
| iPhone A + iPhone B + MacBook push-enabled | Maximaal één delivery per actieve subscription |
| Melding lezen op iPhone A | Direct/zo snel mogelijk gelezen op overige clients |
| Taak afronden op MacBook | Status en gekoppelde notificatie overal opgelost |
| Safari openen na wijziging elders | Actuele serverstatus zichtbaar |
| Chrome openen na wijziging elders | Actuele serverstatus zichtbaar |
| Eén PWA-subscription intrekken | Andere apparaten blijven actief |
| Eén device offline tijdens event | Geen duplicaat-event; state herstelt bij reconnect |
| Push geweigerd op één client | In-app functionaliteit blijft volledig werken |
| Uitloggen/inloggen | Geen state-lek tussen gebruikers/sessies |

## Ontwerpconsequentie

`localStorage` of service-worker cache mag nooit de canonieke notificatiehistorie vormen. Deze opslag is uitsluitend geschikt als performance-/offline-laag. De server-side eventstatus, gebruikersstatus en device deliverystatus zijn leidend.
