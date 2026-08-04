# Tranche B — centrale Object-ID-laag — finalisering

## Status

Deze BUILD sluit de voorbereidende Tranche B-keten af. De keten kan:

1. vijf CRM-bronnen read-only inventariseren;
2. BAG-verblijfsobject-ID, BAG-pand-ID en adresfallback uniform beoordelen;
3. conflicten en meervoudige matches fail-closed blokkeren;
4. koppel- en nieuw-objectvoorstellen als dry-runpakket opbouwen;
5. een pakket met ID, SHA-256-hash, reviewer en vervaldatum laten beoordelen;
6. een harde shadow-only grens, write-limiet, auditvereiste en rollbackvereiste valideren;
7. voor iedere toekomstige write een deterministische herstelregel afleiden.

## Definitie van `tranche_b_ready`

`tranche_b_ready` betekent uitsluitend dat de architectuur, contracten en veiligheidsgrenzen compleet zijn voor een later afzonderlijk geautoriseerde shadowproef.

Het betekent nadrukkelijk niet:

- dat een productiebackfill is toegestaan;
- dat een shadowbackfill automatisch mag starten;
- dat adres-only matches automatisch gekoppeld mogen worden;
- dat handmatige beoordelingsdossiers in een mutatiepakket mogen zitten;
- dat bestaande CRM-data reeds is geïnventariseerd of gewijzigd.

De uitvoer blijft daarom:

```text
executionAllowed = false
productionAllowed = false
requiresSeparateExecutionAuthorization = true
```

## Harde uitvoeringsvoorwaarden

Een toekomstige shadow-only uitvoerings-BUILD moet minimaal aantonen:

- het pakket-ID en de SHA-256-hash komen exact overeen met het beoordeelde dry-runpakket;
- goedkeuring is niet verlopen;
- de omgeving is uitsluitend shadow;
- productie is technisch geblokkeerd;
- het aantal writes overschrijdt de vooraf goedgekeurde limiet niet;
- er zitten geen handmatige beoordelingsrecords in het pakket;
- iedere write levert vóór uitvoering een auditregel en rollbackregel op;
- uitvoering stopt volledig bij de eerste contractafwijking;
- na uitvoering volgt een read-after-write verificatie en een apart eindrapport.

## Open operationele afhankelijkheid

De shadowomgeving bevat niet automatisch de actuele productie-CRM-records. Daarom kan de echte broninventarisatie niet geloofwaardig op shadow worden uitgevoerd zonder een afzonderlijk, veilig gegevenspad of een expliciete read-only productie-inventarisatie.

Productie blijft in Tranche B ongewijzigd.

## Tranchegrens

Na merge van deze BUILD is Tranche B op code- en contractniveau afgerond. Een echte gegevensuitvoering valt onder een afzonderlijke geautoriseerde uitvoeringsstap en is geen impliciet onderdeel van deze finalisering.
