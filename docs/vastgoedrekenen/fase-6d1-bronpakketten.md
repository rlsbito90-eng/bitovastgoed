# Vastgoedrekenen — Fase 6D.1 bronpakketten en prijspeilbeheer

## Doel

Fase 6D.1 voegt de governance-laag toe waarmee externe, interne en projectspecifieke kengetallensets als één controleerbaar pakket kunnen worden beheerd.

De fase voegt bewust geen nieuwe marktwaarden toe. Zij voorkomt juist dat losse kosten-, opbrengst-, rendement- of doorlooptijdkengetallen zonder samenhangende broncontext in scenario’s terechtkomen.

## Bronpakket

Een bronpakket heeft minimaal:

- een vaste code en versienummer;
- pakketnaam en brontype;
- bronnaam, controleerbare referentie en eventuele bronversie;
- prijspeildatum;
- geldig-vanafdatum en vervaldatum;
- valutacode;
- geografische scope;
- meet- of rekengrondslag;
- inbegrepen en uitgesloten scope;
- indexerings- of vernieuwingsmethode;
- betrouwbaarheid;
- concept-, goedgekeurd- of archiefstatus.

## Goedkeuringscontract

Goedkeuring is alleen mogelijk wanneer:

1. alle verplichte pakketvelden zijn ingevuld;
2. minimaal één kengetal is gekoppeld;
3. alle gekoppelde regels actief en niet verlopen zijn;
4. iedere regel een vaste eenheid heeft;
5. een eurogrondslag ook een expliciete btw-behandeling heeft;
6. brontype en bronnaam overeenkomen met het pakket;
7. prijspeildatum en geldigheidsdata overeenkomen met het pakket;
8. een niet-systeembeheerd pakket een beoordelaar heeft.

Deze regels worden zowel client-side als door PostgreSQL afgedwongen.

## Vergrendeling

Na goedkeuring zijn de gekoppelde registerregels onveranderlijk. Wijzigen, verwijderen, koppelen of ontkoppelen is dan niet toegestaan.

De beheerder moet het pakket eerst archiveren. Daardoor wordt een inhoudelijke wijziging zichtbaar als een governancehandeling in plaats van een stille mutatie van een goedgekeurde bronset.

## Scenario-snapshots

Bij het toepassen van een gekoppeld kengetal vult een databasetrigger automatisch in:

- `bronpakket_id`;
- `bronpakket_snapshot`.

De JSON-momentopname bevat onder andere pakketcode, versie, bronreferentie, prijspeil, geldigheid, geografische scope, meetgrondslag, scope en goedkeuringsdatum.

Bij het dupliceren van een scenario blijft een bestaande momentopname behouden en wordt deze niet opnieuw opgebouwd uit de actuele pakketversie.

## Bestaand quickscanpakket

De 28 regels uit Fase 6C worden gekoppeld aan het systeembeheerde pakket:

- code: `bito_quickscan_internal`;
- versie: 1;
- status: goedgekeurd;
- brontype: interne werkhypothese;
- prijspeildatum: 30 juli 2026;
- vervaldatum: 30 januari 2027.

Deze goedkeuring bevestigt uitsluitend dat de set compleet, onderling consistent en reproduceerbaar is. Zij bevestigt niet dat de waarden marktconform zijn.

## Niet in deze fase

- actuele externe €/m²-kengetallen;
- automatische indexering;
- marktdata-import;
- automatische scenario-toepassing;
- wijziging van financiële formules;
- wijziging van bestaande scenario-uitkomsten;
- automatische Kadaster-, BAG- of vergelijkbaarobjectacties.

## Vervolg

Fase 6D.2 kan vervolgens een gecontroleerd importcontract toevoegen voor echte bronbestanden en projectspecifieke ramingen. Pas daarna worden inhoudelijke kosten-, opbrengst- en rendementsets als afzonderlijke bronpakketversies ingevoerd.
