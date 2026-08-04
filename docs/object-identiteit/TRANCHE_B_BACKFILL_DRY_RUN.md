# Tranche B — centrale Object-ID-backfill dry-run

## Doel

Breng bestaande CRM-records deterministisch in kaart ten opzichte van de centrale objectregistratie, zonder records te wijzigen, samen te voegen of op te slaan.

## Matchvolgorde

1. BAG-verblijfsobject-ID;
2. BAG-pand-ID;
3. genormaliseerde adressleutel;
4. handmatige beoordeling bij ambiguïteit of tegenspraak.

Een BAG-verblijfsobject-ID heeft voorrang op pand-ID en adres. Een pandmatch heeft voorrang op een losse adresmatch.

## Fail-closed situaties

De dry-run maakt geen automatische koppeling bij:

- meerdere actieve registraties met hetzelfde BAG-verblijfsobject-ID;
- meerdere actieve registraties met hetzelfde BAG-pand-ID;
- meerdere actieve registraties met dezelfde adressleutel;
- een verblijfsobjectmatch die strijdig is met het opgegeven BAG-pand-ID;
- onvoldoende adresgegevens.

Deze gevallen krijgen `handmatige_beoordeling` met de kandidaat-objectregistraties.

## Uitvoer

Per bronrecord volgt precies één besluit:

- `koppelen`;
- `nieuw_object_voorstellen`;
- `handmatige_beoordeling`.

De samenvatting bevat aantallen per besluitcategorie en legt expliciet vast:

```text
databaseWriteUitgevoerd = false
automatischeSamenvoegingUitgevoerd = false
```

## Veiligheidsgrens

- geen productie-Supabase-write;
- geen shadowdata-backfill;
- geen automatische merge;
- geen verwijdering of wijziging van bestaande dossiers;
- geen Kadaster- of eigenaaractie;
- een latere uitvoerbare backfill vereist afzonderlijke broninventarisatie, rapportreview en expliciete goedkeuring.
