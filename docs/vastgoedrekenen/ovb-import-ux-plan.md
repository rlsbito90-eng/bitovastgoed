# Vastgoedrekenen — OVB-import en mixed-use UX

## Doel

Verminder dubbele invoer bij verkrijgingscomponenten zonder de fiscale scheiding tussen huidige verkrijging en toekomstige strategie te verliezen.

## Kernbesluit

Een mixed-use verkrijging hoeft niet volledig opnieuw handmatig te worden opgebouwd wanneer bruikbare projectcomponenten of units al bestaan.

Voeg in **Verkrijgingsstructuur & OVB** een knop toe:

> Importeer uit componenten

De import maakt uitsluitend **concept-verkrijgingscomponenten**. De gebruiker moet de huidige functie, toerekeningsmethode en OVB-classificatie controleren en bevestigen. Toekomstige strategie bepaalt de OVB nooit automatisch.

## Importwizard

### Stap 1 — bron selecteren

Toon bestaande projectcomponenten/units met minimaal:

- label;
- huidige type/functie indien beschikbaar;
- GBO, VVO en BVO;
- locatie of omschrijving;
- toekomstige strategie ter informatie, expliciet niet leidend voor OVB.

### Stap 2 — groeperen

Bied aan:

- één verkrijgingscomponent per geselecteerde component/unit;
- groeperen op huidige functie/type;
- handmatig samenvoegen of splitsen vóór import.

Mixed-use of onbekende huidige functies mogen niet stilzwijgend als één fiscale regel worden afgerond. Markeer deze als `Splitsen` of `Controle nodig`.

### Stap 3 — verdelingsmethode

Laat de gebruiker voor de geïmporteerde fiscale regels kiezen uit:

- `floor_area` — Op huidige m²;
- `percentage` — Op percentage;
- `value` — Indicatieve huidige waarde;
- `manual` — Handmatige fiscale grondslag.

Toon per methode alleen relevante velden.

- `floor_area`: kies één consistente meetbasis voor alle regels (GBO, VVO of BVO). Geen gemengde meetbasis binnen dezelfde verdeling.
- `percentage`: percentages moeten samen 100% zijn.
- `value`: bereken aandelen naar rato van indicatieve huidige waarden.
- `manual`: gebruiker voert fiscale grondslag per regel in.

## UX-aanpassingen drawer

- Hernoem `Verdeelwaarde / aandeel aankoopprijs (€)` naar een methode-afhankelijk label.
- `value`: `Indicatieve huidige waarde (€)`.
- `percentage`: `Aandeel aankoopprijs (%)`.
- `manual`: `Handmatige OVB-grondslag (€)`.
- `floor_area`: toon alleen de gekozen oppervlaktebasis als verdeelveld.
- Voeg informatietekst toe: `De gekozen methode is uitsluitend een verdeelsleutel voor de fiscale verkrijgingsdelen en vormt geen taxatie.`
- Toon betrouwbaarheid zichtbaar per methode, maar presenteer dit niet als juridische zekerheid.

## Synchronisatie en veiligheid

- Import is eenmalig; geen stille live-synchronisatie.
- Na import wijzigen projectcomponenten bestaande verkrijgingscomponenten niet automatisch.
- Bied optioneel `Opnieuw vergelijken` aan om afwijkingen te signaleren, zonder data automatisch te overschrijven.
- Bestaande verkrijgingscomponenten nooit dupliceren zonder bevestiging.
- Toon vóór import welke regels worden toegevoegd, overgeslagen of mogelijk samengevoegd.
- Fiscale classificatie en handmatige override blijven expliciete controlepunten voor notaris/fiscalist.

## Acceptatiecriteria

1. Gebruiker kan vanuit Verkrijgingsstructuur & OVB bestaande componenten importeren.
2. Import maakt conceptregels en rekent OVB pas definitief door nadat verplichte fiscale invoer compleet is.
3. Mixed-use brondata wordt niet automatisch als één fiscaal deel geaccepteerd.
4. Toekomstige strategie wordt nooit gebruikt om OVB-classificatie of tarief automatisch vast te stellen.
5. Alle vier verdelingsmethoden werken methode-afhankelijk en zonder irrelevante invoervelden.
6. Bestaande scenario's, berekeningen en migraties blijven intact.
7. Typecheck, volledige testsuite en productiebuild blijven groen.
