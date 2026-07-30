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
- geografische scope en optionele officiële CRM-gebiedssleutels;
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
8. een niet-systeembeheerd pakket een beoordelaar heeft;
9. de vastgelegde beoordelaar gelijk is aan de werkelijk aangemelde gebruiker.

Een normale geauthenticeerde client kan zichzelf niet als systeemmigratie markeren of een andere gebruiker als beoordelaar opgeven. Deze regels worden zowel client-side als door PostgreSQL afgedwongen.

## Vergrendeling

Na goedkeuring zijn zowel het pakket als de gekoppelde registerregels onveranderlijk. Wijzigen, verwijderen, koppelen of ontkoppelen is dan niet toegestaan.

De beheerder moet een regulier pakket eerst archiveren. Daarna kan een nieuwe pakketversie met gewijzigde brondata worden aangemaakt. Een gearchiveerd pakket blijft zelf als historische bronversie onveranderlijk. Het systeembeheerde interne quickscanpakket kan niet via de gebruikersinterface worden gearchiveerd.

Het Vastgoedrekenen-overzicht toont hoeveel registerregels door goedgekeurde pakketten zijn vergrendeld. Mutaties worden vooraf door de applicatielaag en definitief door PostgreSQL geblokkeerd.

## Scenario-snapshots

Bij het toepassen van een gekoppeld kengetal vult een databasetrigger automatisch in:

- `bronpakket_id`;
- `bronpakket_snapshot`.

De JSON-momentopname bevat onder andere pakketcode, versie, bronreferentie, prijspeil, geldigheid, geografische scope, meetgrondslag, scope en goedkeuringsdatum.

Bij het dupliceren van een scenario blijft een bestaande momentopname behouden en wordt deze niet opnieuw opgebouwd uit de actuele pakketversie. Bij een bewuste hernieuwde toepassing wordt de actuele goedgekeurde pakketcontext opnieuw vastgelegd.

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

## Validatie

De hoofdmigratie is volledig binnen een PostgreSQL-transactie tegen de actuele productiegegevens uitgevoerd en daarna teruggedraaid. Daarmee zijn tabellen, constraints, triggers, de koppeling van de 28 standaardregels en de systeemgoedkeuring zonder blijvende mutatie getest.

De actor-guard is afzonderlijk transactioneel getest met een gesimuleerde aangemelde gebruiker. Het aanmaken van een systeembeheerd pakket en het vastleggen van een andere beoordelaar werden geblokkeerd; goedkeuring door de werkelijk aangemelde gebruiker werd toegestaan. Ook deze test is volledig teruggedraaid.

## Vervolg

Fase 6D.2 kan vervolgens een gecontroleerd importcontract toevoegen voor echte bronbestanden en projectspecifieke ramingen. Pas daarna worden inhoudelijke kosten-, opbrengst- en rendementsets als afzonderlijke bronpakketversies ingevoerd.
