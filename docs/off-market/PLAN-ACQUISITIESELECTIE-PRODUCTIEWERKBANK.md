# PLAN — Acquisitieselectie als productiewerkbank

## Doel

De Acquisitieselectie wordt de primaire operationele werkbak voor off-market briefproductie. De gebruiker moet tientallen dossiers efficiënt kunnen voorbereiden, controleren, formaliseren, batchen, printen en posten zonder per brief dezelfde handelingen te herhalen.

Kernprincipes:

1. Concept is uitsluitend voor controle.
2. Definitief betekent immutable BR-versie.
3. Formele printproductie komt uitsluitend uit definitieve BR's in een BAT.
4. Print/post-status wordt pas bevestigd nadat de fysieke handeling echt heeft plaatsgevonden.
5. Uitzonderingen verdwijnen niet uit beeld maar krijgen een expliciete reden onder `Aandacht vereist`.
6. Readiness wordt automatisch herberekend; na herstel keert een dossier vanzelf terug naar de eerstvolgende geldige fase.

## Doelworkflow

Voorbereiden → Controleren → Definitief → Batch → Print → Post

### Voorbereiden
- `Brieven voorbereiden`

### Controleren
- `Conceptbrieven downloaden`
- Concept-PDF's dragen zichtbaar watermerk `CONCEPT`.
- Conceptbestanden zijn controlebestanden en mogen niet de formele printworkflow voeden.

### Formaliseren
- `Brieven definitief maken`
- Bulkactie voert per brief dezelfde individuele atomische BR-finalisering uit.
- Elke brief behoudt eigen BR, immutable versie, audit event en idempotency.

### Batch
- `Printbatch maken`
- Alleen definitieve, nog niet gebatchte BR's komen in aanmerking.

### Productie
- `Productiebestanden downloaden`
- Definitieve brieven, adreslabels, controlelijst en batchvoorblad komen uit de formele BAT.

### Fysieke afhandeling
- `Print bevestigen`
- `Post bevestigen`

Deze acties mogen nooit impliciet plaatsvinden bij download of conceptgeneratie.

## Bulk-preflight

Voor iedere huidige selectie toont de werkbalk vóór een formele mutatie:

- gereed;
- aandacht vereist;
- al verwerkt/overgeslagen.

Redenen moeten menselijk leesbaar zijn, bijvoorbeeld:

- productiedossier nog niet gestart;
- postadres ontbreekt;
- eigenaar/geadresseerde onzeker;
- geen actief concept;
- concept gewijzigd;
- reeds definitief;
- reeds opgenomen in BAT;
- formeel integriteitsconflict.

Technische foutcodes zoals `dossier_niet_gestart` worden niet rechtstreeks aan de gebruiker getoond.

## Partial success

Bulkfinalisering is niet één alles-of-niets transactie over alle geselecteerde brieven. Iedere brief blijft individueel atomisch.

Voorbeeld:

- 18 van 20 succesvol definitief;
- 2 naar `Aandacht vereist` met reden;
- retry verwerkt alleen de resterende geldige dossiers;
- reeds geslaagde BR's worden idempotent overgeslagen.

## Aandacht vereist versus Geblokkeerd

`Aandacht vereist` betekent: de gebruiker kan of moet iets oplossen.

`Geblokkeerd` betekent: de formele workflow kan niet veilig verder door een hard technisch/procesmatig conflict of bewuste uitsluiting.

Na herstel wordt de eerstvolgende geldige fase automatisch bepaald.

## Terminologie

Huidig → gewenst:

- `Brieven-PDF` → `Conceptbrieven downloaden`
- `Brother-adreslabels exporteren` → `Adreslabels exporteren` zolang legacy export nog bestaat
- `Markeer geprint` → `Print bevestigen`
- `Markeer gepost` → `Post bevestigen`

In de eindroute worden formele adreslabels primair onderdeel van `Productiebestanden downloaden` uit de BAT.

## Uitvoertranches

### BUILD A — veilige UX/readmodel
- conceptwatermerk;
- heldere namen;
- technische fouten vooraf vertalen naar menselijk leesbare readiness;
- `dossier_niet_gestart` vóór BR-finalisering detecteren;
- nog geen nieuwe bulk-BR-mutatie.

### BUILD B — bulk BR-finalisering
- selectiepreflight;
- individuele atomische BR-finalisering;
- partial-success rapportage;
- idempotente retry.

### BUILD C — bulk BAT
- geselecteerde definitieve BR's → één BAT;
- geen dubbele koppelingen;
- duidelijke preflight/resultaatweergave.

### BUILD D — productie-UX opschonen
- legacy print/post-acties uit primaire route;
- formele BAT-downloads als bron voor print;
- print/post-bevestiging op batchniveau.

### BUILD E — acceptatie
- 1, 10 en tientallen brieven;
- geblokkeerde brief tussen geldige brieven;
- refresh halverwege;
- dubbele klik;
- retry;
- reeds definitief/reeds gebatcht;
- geen fysieke status zonder expliciete bevestiging.

## Veiligheidsgrenzen

- Geen automatische Kadasteractie.
- Geen BR-uitgifte door alleen openen, previewen of downloaden.
- Geen BAT zonder expliciete gebruikersactie.
- Geen print/post/verzendstatus zonder feitelijke fysieke handeling en expliciete bevestiging.
- Geen regeneratie van een bestaande geldige formele batch zonder afzonderlijk herstelpad.
