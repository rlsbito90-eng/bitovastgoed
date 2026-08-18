# AUDIT RESTSCAN — TIJD, ACTIE, CONTACTMOMENTEN EN RELATIES

Deze restscan vult `AUDIT-APP-BREED-TIJD-ACTIE-NOTIFICATIELOGICA.md` aan na repo-brede zoekslagen op `datum`, `deadline`, `opvolg`, `volgende_actie`, `geldigTot`, `verwachte_closingdatum`, `gewenste_levering` en relevante UI-/read-modelbestanden.

## 1. Relaties — referentiepatroon is al goed

`src/lib/relatieContact.ts` maakt drie betekenissen expliciet uit elkaar:

1. **Laatste contact** = alleen echte communicatiemomenten;
2. **Laatste activiteit** = ook administratieve/systeemactiviteit;
3. **Volgende actie** = eerstvolgende open centrale taak.

Dit is het gewenste app-brede patroon.

### Besluit
- behouden als referentie-architectuur;
- andere modules moeten naar hetzelfde onderscheid convergeren;
- een administratief event mag nooit stilzwijgend als echt contact of open actie tellen.

## 2. Contactmomenten — dubbele follow-upbron gevonden

`ContactMomentFormDialog` kent tegelijk:

- `followUpRequired`;
- `followUpDate`;
- `makeTaak`;
- `taakDeadline`;
- en maakt bij `makeTaak=true` een centrale taak aan.

Bij nieuwe contactmomenten wordt:

- `followUpRequired = makeTaak`;
- `followUpDate = taakDeadline` indien ingevuld;
- daarnaast een echte taak aangemaakt.

Hierdoor bestaan twee representaties van dezelfde vervolgactie.

### Extra probleem: impliciete deadline

Wanneer `makeTaak=true` en geen taakdeadline is gekozen, gebruikt de code:

`deadline = taakDeadline || momentDate`

Daardoor kan de historische datum van het contactmoment onbedoeld de deadline van een nieuwe vervolgtaak worden.

### Canoniek besluit

**Contactmoment = registratie.**  
**Vervolgactie = centrale taak.**

Doel:
- `followUpRequired/followUpDate` niet als tweede zelfstandige actiebron gebruiken;
- eventueel als compatibility/read-model zolang migratie loopt;
- nieuwe vervolgtaak zonder gekozen deadline blijft zonder deadline;
- contactmomentdatum nooit automatisch hergebruiken als taakdeadline;
- taak-ID of expliciete link terug naar broncontactmoment toevoegen indien nodig voor traceability.

## 3. Deadlinevelden — semantiek

Repo-brede deadlinescan bevestigt dat centrale taakdeadline de primaire algemene deadlineconstructie is.

Andere vermeldingen van deadline vallen hoofdzakelijk in:
- sortering/urgentie;
- taakpagina's;
- Off-Market taakweergave;
- cockpit/read models;
- test- en notificatielogica.

### Besluit
Geen nieuw parallel generiek deadlineconcept invoeren. Business deadlines die niet zelf taken zijn — bijvoorbeeld `bieding.geldigTot` — blijven domeinspecifiek en produceren notificatie-events via policy.

## 4. Datumvelden — niet alles is operationele tijd

De brede `datum`-scan raakt ook:
- BAG/source manifests;
- import/audit;
- PDF formatting;
- kostenbeheer;
- historie;
- funnel/KPI;
- registraties.

Deze vallen buiten taak/notificatiesemantiek tenzij een expliciete businesspolicy dat anders bepaalt.

### Hard filter
Een datumveld wordt alleen onderdeel van tijd-/actieorkestratie als het één van deze typen is:

- afspraak;
- concrete taakdeadline;
- follow-up;
- business deadline;
- prognose met agenda-relevantie;
- reminderbron met expliciete policy.

Historie-, bron-, import-, rapportage- en auditdatums blijven registratie.

## 5. Workflow Engine / Acquisitie

De restscan bevestigt dat acquisitieworkflowlogica eigen datumberekeningen kent. Deze zijn niet automatisch taken.

### Besluit
Workflow-engine mag:
- werkbakpositie afleiden;
- een aanbevolen volgende stap afleiden;
- een vervaldatum/urgentie voor procesweergave berekenen.

Workflow-engine mag niet zonder expliciete policy:
- een push sturen;
- een agenda-item creëren;
- een centrale taak creëren als slechts sprake is van advies.

Als een businessregel wél een verplichte actie definieert, moet de engine via één canonical task adapter een centrale taak creëren en daarna niet zelf nog een tweede notificatiebron worden.

## 6. Off-Market cockpit / briefsamenvattingen

Deadline- en volgende-actiepresentaties in cockpit/samenvatting zijn read models. Zij mogen urgentie tonen, maar moeten hun actie uiteindelijk uit de canonieke taakbron halen.

### Besluit
- UI-badges/read models mogen afgeleid zijn;
- nooit als aparte schrijvende bron gebruiken;
- `Geen actie` is een UI-uitkomst, geen taakstatus op zichzelf.

## 7. Aanvullende P0/P1-punten

### P0 — vóór notification-v2 activering
1. standaard `deadline=vandaag` uit nieuw taakformulier verwijderen;
2. contactmoment vervolgtaak zonder deadline niet op `momentDate` zetten;
3. notification-v2 alleen vanuit canonieke taak-/deadlinebronnen;
4. iCal deal/pipeline/Vastgoedkans follow-ups niet dubbel met centrale taak tonen;
5. `nda_datum` niet als generieke reminderbron behandelen;
6. Europe/Amsterdam DST correct maken.

### P1 — bronconvergentie
1. contactmoment follow-upvelden → centrale taak/read-model;
2. Deal follow-up → centrale taak;
3. Pipeline volgende actie → centrale taak;
4. Vastgoedkans volgende actie → centrale taak;
5. Off-Market legacy volgende actie → fallback-only, daarna uitfaseren;
6. acquisitie post-opvolging → atomische centrale taak.

## 8. Referentievoorbeelden

### Contactmoment vandaag, over drie dagen bellen
Correct:
- contactmoment `momentDate = vandaag`;
- taak `deadline = over drie dagen`;
- contactmoment toont gekoppelde vervolgtaak;
- alleen taak komt als actie in agenda/notificatie.

Fout:
- contactmomentdatum = vandaag;
- followUpDate en taakdeadline allebei apart opgeslagen;
- taakdeadline valt automatisch terug op vandaag.

### Contactmoment vandaag, ooit nog opvolgen maar nog geen datum
Correct:
- contactmoment opgeslagen;
- centrale taak zonder deadline, of expliciet geen taak totdat datum/actie bekend is;
- geen agenda-item;
- geen due-notificatie.

## 9. Restscan-eindoordeel

De restscan verandert het hoofdmodel niet; hij versterkt het.

Het meest consistente patroon bestaat al binnen Relaties: historie/activiteit en volgende actie worden onderscheiden en de volgende actie komt uit centrale taken.

Het grootste nieuwe conflict zit in Contactmomenten: registratie en vervolgactie worden tegelijk in het contactmoment én de centrale taak opgeslagen. Dit moet in de migratietranche worden rechtgetrokken.

Daarmee blijft het app-brede ontwerpprincipe:

> **Domeinrecords registreren wat er gebeurt; centrale taken registreren wat de gebruiker nog moet doen; notificaties leveren alleen aandacht af op basis van die canonieke toestand.**
